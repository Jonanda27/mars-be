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
          
          // Guard clause: Check if any other non-expired contract uses this asset
          if (contract.asset_id) {
            const otherActiveContracts = await prisma.contracts.count({
              where: {
                asset_id: contract.asset_id,
                id: { not: contract.id },
                status: { notIn: ['Expired', 'Terminated', 'Rejected'] }
              }
            });

            if (otherActiveContracts === 0) {
              // Release the asset back to Available
              await prisma.assets.update({
                where: { id: contract.asset_id },
                data: { status: 'Available' }
              });
            }

            // Guard clause for aircraft: Check if THIS tenant has another active contract for this asset
            const sameTenantOtherContracts = await prisma.contracts.count({
              where: {
                asset_id: contract.asset_id,
                tenant_id: contract.tenant_id,
                id: { not: contract.id },
                status: { notIn: ['Expired', 'Terminated', 'Rejected'] }
              }
            });

            if (sameTenantOtherContracts === 0) {
              // Release tied aircraft for this tenant
              await prisma.aircrafts.updateMany({
                where: { 
                  asset_id: contract.asset_id,
                  tenant_id: contract.tenant_id
                },
                data: { 
                  asset_id: null,
                  status: 'Active' 
                }
              });
            }
          }
          expiredCount++;
        }
      } 
      // Check dynamic expiration threshold based on total lease duration
      else if (contract.start_date) {
        const startDate = new Date(contract.start_date);
        startDate.setHours(0, 0, 0, 0);
        
        // Calculate total duration and remaining days
        const totalDurationMs = endDate.getTime() - startDate.getTime();
        const totalDurationDays = Math.ceil(totalDurationMs / (1000 * 60 * 60 * 24));
        
        const remainingMs = endDate.getTime() - today.getTime();
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        
        let threshold = 30; // Default
        if (totalDurationDays > 90) threshold = 30;
        else if (totalDurationDays >= 30) threshold = 7;
        else if (totalDurationDays >= 7) threshold = 3;
        else threshold = 1;
        
        if (remainingDays <= threshold) {
          if (contract.status !== 'Expiring') {
            await prisma.contracts.update({
              where: { id: contract.id },
              data: { status: 'Expiring' }
            });
            expiringCount++;
          }
        }
      }
    }

    console.log(`Cron Complete: Marked ${expiringCount} as Expiring, ${expiredCount} as Expired.`);
  } catch (error) {
    console.error('Error running contract monitor cron job:', error);
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
    checkArrearsAndGenerateWarnings();
  });
  console.log('Cron Jobs Initialized: Contract Monitor & Risk Control (runs daily at midnight)');
};

module.exports = {
  initCronJobs,
  checkContractExpirations,
  checkArrearsAndGenerateWarnings
};
