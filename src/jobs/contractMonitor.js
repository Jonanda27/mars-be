const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const invoiceService = require('../services/invoiceService');

// Setup the cron job to run every day at midnight (00:00)
// '0 0 * * *'
const checkContractExpirations = async () => {
  console.log('--- CRON JOB: Checking contract expirations ---');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    // Get all contracts that are currently Active or Expiring
    const activeContracts = await prisma.contracts.findMany({
      where: {
        status: { in: ['Active', 'Expiring'] },
        end_date: { not: null }
      }
    });

    let expiredCount = 0;
    let expiringCount = 0;

    for (const contract of activeContracts) {
      const endDate = new Date(contract.end_date);
      endDate.setHours(0, 0, 0, 0);

      // Check if it's already expired
      if (endDate < today) {
        if (contract.status !== 'Expired') {
          await prisma.contracts.update({
            where: { id: contract.id },
            data: { status: 'Expired' }
          });
          expiredCount++;
        }
      } 
      // Check if it's expiring within 30 days
      else if (endDate <= thirtyDaysFromNow) {
        if (contract.status !== 'Expiring') {
          await prisma.contracts.update({
            where: { id: contract.id },
            data: { status: 'Expiring' }
          });
          expiringCount++;
        }
      }
    }

    console.log(`Cron Complete: Marked ${expiringCount} as Expiring, ${expiredCount} as Expired.`);
  } catch (error) {
    console.error('Error running contract monitor cron job:', error);
  }
};

const generatePeriodicBilling = async () => {
  console.log('--- CRON JOB: Generating Periodic Billing ---');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all active contracts
    const activeContracts = await prisma.contracts.findMany({
      where: { status: 'Active' }
    });

    let generatedCount = 0;

    for (const contract of activeContracts) {
      // Find the most recent invoice for this contract
      const latestInvoice = await prisma.invoices.findFirst({
        where: { contract_id: contract.id },
        orderBy: { created_at: 'desc' }
      });

      if (!latestInvoice) continue; // If no initial invoice exists, skip

      const lastBillingDate = new Date(latestInvoice.created_at);
      lastBillingDate.setHours(0, 0, 0, 0);

      let nextBillingDate = new Date(lastBillingDate);

      if (contract.periode_pembayaran === 'Bulanan') {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      } else if (contract.periode_pembayaran === 'Tahunan') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      } else {
        continue; // Unsupported period
      }

      // If today is equal or past the next billing date, generate a new invoice!
      if (today >= nextBillingDate) {
        // Ensure we don't generate after contract end date
        const endDate = contract.end_date ? new Date(contract.end_date) : null;
        if (endDate) {
          endDate.setHours(0, 0, 0, 0);
          if (today > endDate) continue;
        }

        console.log(`Generating periodic invoice for Contract ID: ${contract.id}`);
        await invoiceService.generateInvoice(contract.id, true);
        generatedCount++;
      }
    }

    console.log(`Periodic Billing Complete: Generated ${generatedCount} new invoices.`);
  } catch (error) {
    console.error('Error running periodic billing cron job:', error);
  }
};

const checkArrearsAndGenerateWarnings = async () => {
  console.log('--- CRON JOB: Checking arrears and generating warnings ---');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unpaidInvoices = await prisma.invoices.findMany({
      where: { status: 'Unpaid', due_date: { not: null } },
      include: { contracts: true }
    });

    let sp1Count = 0;
    let sp2Count = 0;

    for (const invoice of unpaidInvoices) {
      const dueDate = new Date(invoice.due_date);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = Math.abs(today - dueDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Overdue logic
      if (today > dueDate) {
        if (diffDays >= 60) {
          // Check if SP 2 already exists
          const existingSP2 = await prisma.warnings.findFirst({
            where: { invoice_id: invoice.id, type: 'SP 2' }
          });

          if (!existingSP2) {
            const warningNumber = `SP2-${Date.now()}-${invoice.id}`;
            await prisma.warnings.create({
              data: {
                warning_number: warningNumber,
                tenant_id: invoice.tenant_id,
                invoice_id: invoice.id,
                type: 'SP 2',
                message: `Tagihan No. ${invoice.invoice_number} telah menunggak lebih dari 60 hari. Akses layanan dibatasi.`,
                status: 'Sent'
              }
            });

            // Restrict tenant service
            await prisma.tenants.update({
              where: { id: invoice.tenant_id },
              data: { status_pembayaran: 'Restricted' }
            });

            sp2Count++;
          }
        } else if (diffDays >= 30) {
          // Check if SP 1 already exists
          const existingSP1 = await prisma.warnings.findFirst({
            where: { invoice_id: invoice.id, type: 'SP 1' }
          });

          if (!existingSP1) {
            const warningNumber = `SP1-${Date.now()}-${invoice.id}`;
            await prisma.warnings.create({
              data: {
                warning_number: warningNumber,
                tenant_id: invoice.tenant_id,
                invoice_id: invoice.id,
                type: 'SP 1',
                message: `Tagihan No. ${invoice.invoice_number} telah menunggak lebih dari 30 hari. Segera lakukan pelunasan untuk menghindari sanksi lanjutan.`,
                status: 'Sent'
              }
            });

            sp1Count++;
          }
        }
      }
    }

    console.log(`Arrears Check Complete: Generated ${sp1Count} SP1 and ${sp2Count} SP2.`);
  } catch (error) {
    console.error('Error running arrears check cron job:', error);
  }
};

const initCronJobs = () => {
  // Run every day at 00:00
  cron.schedule('0 0 * * *', () => {
    checkContractExpirations();
    generatePeriodicBilling();
    checkArrearsAndGenerateWarnings();
  });
  console.log('Cron Jobs Initialized: Contract Monitor, Periodic Billing & Risk Control (runs daily at midnight)');
};

module.exports = {
  initCronJobs,
  checkContractExpirations,
  generatePeriodicBilling,
  checkArrearsAndGenerateWarnings
};
