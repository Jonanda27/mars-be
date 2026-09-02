const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllInvoices = async () => {
  return await prisma.invoices.findMany({
    include: {
      contracts: {
        include: {
          assets: true
        }
      },
      tenants: true
    },
    orderBy: {
      created_at: 'desc'
    }
  });
};

exports.getTenantInvoices = async (tenantId) => {
  return await prisma.invoices.findMany({
    where: { tenant_id: parseInt(tenantId) },
    include: {
      contracts: {
        include: {
          assets: true
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  });
};

exports.getInvoiceById = async (id) => {
  return await prisma.invoices.findUnique({
    where: { id: parseInt(id) },
    include: {
      contracts: true,
      tenants: true
    }
  });
};

exports.generateInvoice = async (contractId, isPeriodic = false) => {
  const contract = await prisma.contracts.findUnique({
    where: { id: parseInt(contractId) }
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  // Check if invoice already exists
  if (!isPeriodic) {
    const existingInvoice = await prisma.invoices.findFirst({
      where: { contract_id: contract.id }
    });
    if (existingInvoice) {
      return existingInvoice;
    }
  } else {
    // For periodic, just ensure we don't generate multiple invoices on the EXACT same day for the same contract
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingInvoiceToday = await prisma.invoices.findFirst({
      where: { 
        contract_id: contract.id,
        created_at: { gte: today }
      }
    });
    if (existingInvoiceToday) {
      return existingInvoiceToday;
    }
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  let calculatedAmount = Number(contract.total_amount) || 0;
  
  let invoicesToCreate = [];
  
  if (contract.periode_pembayaran === 'Bulanan' && contract.start_date && contract.end_date) {
    const start = new Date(contract.start_date);
    const end = new Date(contract.end_date);
    let months = (end.getFullYear() - start.getFullYear()) * 12;
    months -= start.getMonth();
    months += end.getMonth();
    if (months <= 0) months = 1; 
    calculatedAmount = calculatedAmount / months;

    const count = await prisma.invoices.count();

    for (let i = 0; i < months; i++) {
      // Calculate due date for the i-th month
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + i);
      dueDate.setDate(dueDate.getDate() + 14); // 14 days after start of that month

      // Invoice number
      const seq = String(count + i + 1).padStart(3, '0');
      const invNumber = `SKRD/${year}/${month}/${seq}`;

      let status = i === 0 ? 'Unpaid' : 'Scheduled';
      let amount = calculatedAmount;
      if (i === 0 && contract.deposit_jaminan) {
         amount += Number(contract.deposit_jaminan);
      }

      invoicesToCreate.push({
        invoice_number: invNumber,
        contract_id: contract.id,
        tenant_id: contract.tenant_id,
        amount: amount,
        due_date: dueDate,
        status: status,
        created_at: dueDate // Set created_at to due date so they show up chronologically
      });
    }

    // Insert all
    await prisma.invoices.createMany({
      data: invoicesToCreate
    });

    // Return the first one
    return await prisma.invoices.findFirst({
       where: { contract_id: contract.id },
       orderBy: { due_date: 'asc' }
    });

  } else {
    // Single invoice logic (Sekaligus or Harian or missing dates)
    if (contract.periode_pembayaran === 'Tahunan' && contract.start_date && contract.end_date) {
      const start = new Date(contract.start_date);
      const end = new Date(contract.end_date);
      let years = end.getFullYear() - start.getFullYear();
      if (years <= 0) years = 1;
      calculatedAmount = calculatedAmount / years;
    }
    
    if (!isPeriodic && contract.deposit_jaminan) {
      calculatedAmount += Number(contract.deposit_jaminan);
    }

    const count = await prisma.invoices.count();
    const seq = String(count + 1).padStart(3, '0');
    const invoiceNumber = `SKRD/${year}/${month}/${seq}`;
    
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    return await prisma.invoices.create({
      data: {
        invoice_number: invoiceNumber,
        contract_id: contract.id,
        tenant_id: contract.tenant_id,
        amount: calculatedAmount,
        due_date: dueDate,
        status: 'Unpaid'
      }
    });
  }
};

exports.uploadReceipt = async (id, filename, method) => {
  const invoice = await prisma.invoices.update({
    where: { id: parseInt(id) },
    data: {
      status: 'Pending Verification',
      payment_receipt: filename,
      payment_method: method
    }
  });
  return invoice;
};

exports.verifyPayment = async (id) => {
  const invoice = await prisma.invoices.update({
    where: { id: parseInt(id) },
    data: {
      status: 'Paid',
      payment_date: new Date()
    }
  });

  // Activate contract when paid
  await prisma.contracts.update({
    where: { id: invoice.contract_id },
    data: {
      status: 'Active'
    }
  });

  return invoice;
};
