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

  // Generate invoice number
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const count = await prisma.invoices.count();
  const seq = String(count + 1).padStart(3, '0');
  const invoiceNumber = `SKRD/${year}/${month}/${seq}`;

  // Set due date (e.g., 14 days from now)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  return await prisma.invoices.create({
    data: {
      invoice_number: invoiceNumber,
      contract_id: contract.id,
      tenant_id: contract.tenant_id,
      amount: contract.total_amount, // or we can add deposit here
      due_date: dueDate,
      status: 'Unpaid'
    }
  });
};

exports.payInvoice = async (id) => {
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
