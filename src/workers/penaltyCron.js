const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');

// Run everyday at Midnight: '0 0 * * *'
const initPenaltyCron = () => {
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron] Running daily penalty check for Overdue invoices...');
    try {
      const today = dayjs().startOf('day');

      // Find all invoices that are Unpaid or Overdue and past their due_date
      const invoices = await prisma.invoices.findMany({
        where: {
          status: {
            in: ['Unpaid', 'Overdue']
          },
          due_date: {
            lt: today.toDate()
          }
        },
        include: {
          contracts: true
        }
      });

      let updatedCount = 0;

      for (const invoice of invoices) {
        if (!invoice.due_date) continue;
        
        // Hitung selisih hari keterlambatan
        const due = dayjs(invoice.due_date).startOf('day');
        const diffDays = today.diff(due, 'day');
        
        if (diffDays > 0) {
          // Rumus: ceil(hari / 30) -> minimal 1 bulan telat
          let bulanTelat = Math.ceil(diffDays / 30);
          
          // Batas maksimum denda 24 bulan
          bulanTelat = Math.min(bulanTelat, 24);

          // Hitung penalti (2% per bulan telat dari pokok)
          const baseAmount = Number(invoice.amount);
          const penaltyAmount = baseAmount * 0.02 * bulanTelat;

          await prisma.invoices.update({
            where: { id: invoice.id },
            data: {
              status: 'Overdue',
              penalty_amount: penaltyAmount
            }
          });
          
          updatedCount++;
        }
      }

      console.log(`[Cron] Penalty check completed. Updated ${updatedCount} invoices to Overdue with penalties.`);
    } catch (error) {
      console.error('[Cron Error] Failed to execute penalty check:', error);
    }
  });
  console.log('[Cron] Penalty & Overdue logic initialized (Runs daily at midnight).');
};

module.exports = { initPenaltyCron };
