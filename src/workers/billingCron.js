const cron = require('node-cron');
const prisma = require('../config/db');

// Function to run the billing logic
const generateMonthlyInvoices = async () => {
    console.log('[Cron] Starting monthly billing generation...');
    try {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        // 1. Ambil semua tagihan dengan status 'Scheduled' yang dijadwalkan untuk bulan ini (atau yang sudah lewat tapi belum diaktifkan)
        const nextMonthFirstDay = new Date(currentYear, currentMonth, 1);

        const scheduledInvoices = await prisma.invoices.findMany({
            where: {
                status: 'Scheduled',
                created_at: {
                    lt: nextMonthFirstDay // Semua tagihan terjadwal sebelum bulan depan
                }
            }
        });

        console.log(`[Cron] Found ${scheduledInvoices.length} scheduled invoices to awaken.`);
        let awakenedCount = 0;

        for (const invoice of scheduledInvoices) {
            // Update status menjadi Unpaid agar muncul tagihannya
            await prisma.invoices.update({
                where: { id: invoice.id },
                data: {
                    status: 'Unpaid'
                    // Integrasi pemicu panggil Payment Gateway (VA/QRIS) atau notifikasi email dapat dimasukkan di sini
                }
            });

            awakenedCount++;
            console.log(`[Cron] Awakened scheduled invoice ${invoice.invoice_number}.`);
        }

        console.log(`[Cron] Monthly billing awakening complete. Awakened ${awakenedCount} invoices.`);
        return { success: true, message: `Berhasil membangunkan ${awakenedCount} tagihan SKRD terjadwal (Scheduled) menjadi Unpaid untuk bulan ini.`, awakenedCount };
    } catch (error) {
        console.error('[Cron] Error awakening invoices:', error);
        return { success: false, error: error.message };
    }
};

// Initialize Cron Job
const initCronJobs = () => {
    // Menjalankan worker pada 0 0 1 * * (tanggal 1 setiap bulan pukul 00:00)
    cron.schedule('0 0 1 * *', () => {
        generateMonthlyInvoices();
    });
    console.log('[Cron] Billing Automation initialized (Scheduled for 1st of every month at 00:00).');
};

module.exports = {
    initCronJobs,
    generateMonthlyInvoices // Exported for manual trigger API
};
