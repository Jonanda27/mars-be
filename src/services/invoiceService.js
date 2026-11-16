const prisma = require('../config/db');

exports.getAllInvoices = async () => {
  return await prisma.invoices.findMany({
    include: {
      contracts: {
        include: {
          assets: {
            include: { master_tariffs: true }
          },
          tenants: true
        }
      },
      tenants: true,
      operational_logs: true
    },
    orderBy: {
      created_at: 'desc'
    }
  });
};

exports.getTenantInvoices = async (tenantId) => {
  return await prisma.invoices.findMany({
    where: { tenant_id: Number.parseInt(tenantId, 10) },
    include: {
      contracts: {
        include: {
          assets: {
            include: { master_tariffs: true }
          },
          tenants: true
        }
      },
      tenants: true,
      operational_logs: true
    },
    orderBy: {
      created_at: 'desc'
    }
  });
};

exports.getInvoiceById = async (id) => {
  return await prisma.invoices.findUnique({
    where: { id: Number.parseInt(id, 10) },
    include: {
      contracts: {
        include: {
          assets: {
            include: { master_tariffs: true }
          },
          tenants: true
        }
      },
      tenants: true,
      operational_logs: true
    }
  });
};

const findExistingInvoice = async (contract, isPeriodic) => {
  if (!isPeriodic) {
    return await prisma.invoices.findFirst({
      where: { contract_id: contract.id }
    });
  }

  // For periodic, just ensure we don't generate multiple invoices on the EXACT same day for the same contract
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return await prisma.invoices.findFirst({
    where: { 
      contract_id: contract.id,
      created_at: { gte: today }
    }
  });
};

const createRoomRentalUpfrontInvoice = async (contract, year, month) => {
  let calculatedAmount = Number(contract.total_amount) || 0;
  if (contract.deposit_jaminan) {
    calculatedAmount += Number(contract.deposit_jaminan);
  }

  const count = await prisma.invoices.count();
  const seq = String(count + 1).padStart(3, '0');
  const invoiceNumber = `SKRD/${year}/${month}/${seq}`;

  // Tanggal jatuh tempo penetapan SKRD: 30 hari kalender sejak penetapan diawal
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  return await prisma.invoices.create({
    data: {
      invoice_number: invoiceNumber,
      contract_id: contract.id,
      tenant_id: contract.tenant_id,
      invoice_type: 'Sewa Ruangan',
      amount: calculatedAmount,
      due_date: dueDate,
      status: 'Unpaid'
    },
    include: {
      contracts: {
        include: {
          assets: {
            include: { master_tariffs: true }
          },
          tenants: true
        }
      },
      tenants: true
    }
  });
};

const createMonthlyInvoices = async (contract, year, month) => {
  let calculatedAmount = Number(contract.total_amount) || 0;
  const start = new Date(contract.start_date);
  const end = new Date(contract.end_date);
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months -= start.getMonth();
  months += end.getMonth();
  if (months <= 0) months = 1; 
  calculatedAmount /= months;

  const count = await prisma.invoices.count();
  const invoicesToCreate = [];
  const invType = contract.jenis_pemanfaatan?.includes('Ruangan') || contract.contract_number?.includes('PKS-RG') 
    ? 'Sewa Ruangan' 
    : 'Sewa Hanggar';

  for (let i = 0; i < months; i++) {
    // Calculate due date for the i-th month
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);
    dueDate.setDate(dueDate.getDate() + 14); // 14 days after start of that month

    // Invoice number
    const seq = String(count + i + 1).padStart(3, '0');
    const invNumber = `SKRD/${year}/${month}/${seq}`;

    const status = i === 0 ? 'Unpaid' : 'Scheduled';
    let amount = calculatedAmount;
    if (i === 0 && contract.deposit_jaminan) {
      amount += Number(contract.deposit_jaminan);
    }

    invoicesToCreate.push({
      invoice_number: invNumber,
      contract_id: contract.id,
      tenant_id: contract.tenant_id,
      invoice_type: invType,
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
};

const createSingleInvoice = async (contract, year, month, isPeriodic) => {
  let calculatedAmount = Number(contract.total_amount) || 0;
  if (contract.periode_pembayaran === 'Tahunan' && contract.start_date && contract.end_date) {
    const start = new Date(contract.start_date);
    const end = new Date(contract.end_date);
    let years = end.getFullYear() - start.getFullYear();
    if (years <= 0) years = 1;
    calculatedAmount /= years;
  }
  
  if (!isPeriodic && contract.deposit_jaminan) {
    calculatedAmount += Number(contract.deposit_jaminan);
  }

  const count = await prisma.invoices.count();
  const seq = String(count + 1).padStart(3, '0');
  const invoiceNumber = `SKRD/${year}/${month}/${seq}`;
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  const invType = contract.jenis_pemanfaatan?.includes('Ruangan') || contract.contract_number?.includes('PKS-RG') 
    ? 'Sewa Ruangan' 
    : 'Sewa Hanggar';

  return await prisma.invoices.create({
    data: {
      invoice_number: invoiceNumber,
      contract_id: contract.id,
      tenant_id: contract.tenant_id,
      invoice_type: invType,
      amount: calculatedAmount,
      due_date: dueDate,
      status: 'Unpaid'
    }
  });
};

exports.generateInvoice = async (contractId, isPeriodic = false) => {
  const contract = await prisma.contracts.findUnique({
    where: { id: Number.parseInt(contractId, 10) },
    include: {
      assets: {
        include: { master_tariffs: true }
      },
      tenants: true
    }
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  const existingInvoice = await findExistingInvoice(contract, isPeriodic);
  if (existingInvoice) {
    return existingInvoice;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');

  // Khusus Sewa Ruangan: Penetapan SKRD ditetapkan diawal untuk keseluruhan periode (tanggal mulai s.d. tanggal berakhirnya)
  const isRuangan = Boolean(
    (contract.assets?.jenis_aset || '').toLowerCase().includes('ruang') ||
    (contract.assets?.kategori || '').toLowerCase().includes('ruang') ||
    contract.contract_type !== 'Payung' ||
    contract.periode_pembayaran === 'Sekaligus di Awal'
  );

  if (isRuangan) {
    return await createRoomRentalUpfrontInvoice(contract, year, month);
  }

  if (contract.periode_pembayaran === 'Bulanan' && contract.start_date && contract.end_date) {
    return await createMonthlyInvoices(contract, year, month);
  }

  return await createSingleInvoice(contract, year, month, isPeriodic);
};

exports.uploadReceipt = async (id, filename, method) => {
  return await prisma.invoices.update({
    where: { id: Number.parseInt(id, 10) },
    data: {
      status: 'Pending Verification',
      payment_receipt: filename,
      payment_method: method
    }
  });
};

exports.verifyPayment = async (id) => {
  const invoice = await prisma.invoices.update({
    where: { id: Number.parseInt(id, 10) },
    data: {
      status: 'Paid',
      payment_date: new Date()
    }
  });

  // Activate contract when paid
  const updatedContract = await prisma.contracts.update({
    where: { id: invoice.contract_id },
    data: {
      status: 'Active'
    },
    include: {
      rental_applications: true
    }
  });

  // Link aircrafts to the asset if applicable
  if (updatedContract.rental_applications?.specific_needs) {
    const specificNeeds = updatedContract.rental_applications.specific_needs;
    if (Array.isArray(specificNeeds.aircraft_ids) && specificNeeds.aircraft_ids.length > 0) {
      const aircraftIds = specificNeeds.aircraft_ids.map(aid => Number.parseInt(aid, 10));
      await prisma.aircrafts.updateMany({
        where: { id: { in: aircraftIds } },
        data: { 
          asset_id: updatedContract.asset_id,
          status: 'In Use' 
        }
      });
    }
  }

  return invoice;
};

exports.generateOverstaySkrd = async (logId) => {
  const log = await prisma.operational_logs.findUnique({
    where: { id: Number.parseInt(logId, 10) },
    include: {
      contracts: true,
      tenants: true
    }
  });

  if (!log?.is_overstay || !log?.overstay_days) {
    throw new Error('Log not valid for overstay billing');
  }
  
  if (log.billing_status !== 'Unbilled') {
    throw new Error('Overstay is already billed');
  }

  const contract = log.contracts;
  
  // Calculate amount based on daily rate = tarif_satuan / 30 roughly, 
  // or use tarif_satuan directly if it's daily.
  let dailyRate = 0;
  if (contract.periode_pembayaran === 'Bulanan') {
    dailyRate = Number(contract.tarif_satuan) / 30;
  } else if (contract.periode_pembayaran === 'Tahunan') {
    dailyRate = Number(contract.tarif_satuan) / 365;
  } else {
    dailyRate = Number(contract.tarif_satuan); // Default assume daily or fixed
  }

  const overstayAmount = dailyRate * log.overstay_days * Number(contract.luas || 1);

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const count = await prisma.invoices.count();
  const seq = String(count + 1).padStart(3, '0');
  const invoiceNumber = `SKRD-OVS/${year}/${month}/${seq}`;
  
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  // Use transaction to ensure both invoice creation and log update succeed
  const [invoice] = await prisma.$transaction([
    prisma.invoices.create({
      data: {
        invoice_number: invoiceNumber,
        contract_id: contract.id,
        tenant_id: log.tenant_id,
        amount: overstayAmount,
        due_date: dueDate,
        status: 'Unpaid'
      }
    }),
    prisma.operational_logs.update({
      where: { id: log.id },
      data: { billing_status: 'Billed' }
    })
  ]);

  return invoice;
};

// =========================================================================
// FITUR PENETAPAN & PENERBITAN SKRD SEWA HANGGAR (SLIDE 4, 5, 9 PPT)
// =========================================================================

const calculateHanggarLogDetails = async (log) => {
  // 1. Ambil seluruh data catatan tutup hari terverifikasi untuk log ini
  const overnightItems = await prisma.daily_overnight_items.findMany({
    where: { operational_log_id: log.id },
    include: { report: true },
    orderBy: { created_at: 'asc' }
  });

  const verifiedNights = overnightItems.length;

  // Jika belum ada rekaman tutup hari spesifik, gunakan selisih hari tanggal keluar vs masuk
  let calculatedNights = verifiedNights;
  if (calculatedNights === 0) {
    const entryDate = new Date(log.entry_time);
    const exitDate = log.exit_time ? new Date(log.exit_time) : new Date();
    const diffTime = Math.abs(exitDate.getTime() - entryDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    calculatedNights = log.is_overnight ? Math.max(1, diffDays) : 1;
  }

  // 2. Cari Master Tarif berdasarkan Nomor Registrasi & Tipe Armada
  const aircraft = await prisma.aircrafts.findUnique({
    where: { registration_number: log.registration_number },
    include: {
      aircraft_types: {
        include: {
          master_tariffs: {
            where: { status: 'Active' }
          }
        }
      }
    }
  });

  let aircraftTypeStr = aircraft?.aircraft_types?.jenis_pesawat || 'Standar / Ad-hoc';
  let ratePerNight = 3500000; // default standar hanggar
  let tariffCode = 'TRF-HGR-STD';

  if (aircraft?.aircraft_types?.master_tariffs && aircraft.aircraft_types.master_tariffs.length > 0) {
    const mt = aircraft.aircraft_types.master_tariffs[0];
    ratePerNight = Number(mt.tarif);
    tariffCode = mt.kode_tarif;
    aircraftTypeStr = mt.objek || aircraftTypeStr;
  } else if (log.parking_location === 'Apron') {
    const apronTariff = await prisma.master_tariffs.findFirst({
      where: { jenis_layanan: 'Sewa Apron', status: 'Active' }
    });
    if (apronTariff) {
      ratePerNight = Number(apronTariff.tarif);
      tariffCode = apronTariff.kode_tarif;
      aircraftTypeStr = 'Parkir Apron';
    }
  }

  const subtotal = calculatedNights * ratePerNight;

  return {
    log_id: log.id,
    registration_number: log.registration_number,
    aircraft_type: aircraftTypeStr,
    tariff_code: tariffCode,
    parking_location: log.parking_location || 'Hanggar',
    entry_time: log.entry_time,
    exit_time: log.exit_time,
    is_overnight: log.is_overnight,
    verified_nights: verifiedNights,
    total_nights: calculatedNights,
    rate_per_night: ratePerNight,
    subtotal: subtotal,
    evidence_photos: overnightItems.map(i => i.evidence_photo).filter(Boolean),
    tenant_id: log.tenant_id,
    tenant_name: log.tenants?.nama_perusahaan || 'Maskapai / Operator Tamu'
  };
};

exports.calculateHanggarLogDetails = calculateHanggarLogDetails;

exports.getUnbilledHanggarLogs = async (filters = {}) => {
  const where = {
    billing_status: 'Unbilled'
  };

  if (filters.tenant_id) {
    where.tenant_id = Number.parseInt(filters.tenant_id, 10);
  }

  if (filters.start_date || filters.end_date) {
    where.entry_time = {};
    if (filters.start_date) {
      where.entry_time.gte = new Date(filters.start_date);
    }
    if (filters.end_date) {
      const end = new Date(filters.end_date);
      end.setHours(23, 59, 59, 999);
      where.entry_time.lte = end;
    }
  }

  const logs = await prisma.operational_logs.findMany({
    where,
    include: {
      tenants: true,
      contracts: true,
      officer: {
        select: { username: true }
      },
      overnight_items: {
        include: { report: true }
      }
    },
    orderBy: { entry_time: 'desc' }
  });

  const enrichedLogs = await Promise.all(logs.map(log => calculateHanggarLogDetails(log)));
  return enrichedLogs;
};

// OPSI A: Penetapan SKRD Instan Saat Pesawat Check-Out
exports.generateHanggarCheckoutInvoice = async (logId, customRate) => {
  const log = await prisma.operational_logs.findUnique({
    where: { id: Number.parseInt(logId, 10) },
    include: {
      tenants: true,
      contracts: true
    }
  });

  if (!log) throw new Error('Log operasional tidak ditemukan');
  if (log.billing_status === 'Billed') throw new Error('Log pesawat ini sudah memiliki tagihan SKRD');

  const calc = await calculateHanggarLogDetails(log);
  const effectiveRate = customRate ? Number(customRate) : calc.rate_per_night;
  const totalAmount = calc.total_nights * effectiveRate;

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const count = await prisma.invoices.count();
  const seq = String(count + 1).padStart(3, '0');
  const invoiceNumber = `SKRD-HGR/${year}/${month}/${seq}`;

  // Jatuh tempo standar 30 hari kalender
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const detailItem = {
    ...calc,
    rate_per_night: effectiveRate,
    subtotal: totalAmount,
    exit_time: log.exit_time || new Date()
  };

  // Hubungkan ke kontrak payung tenant jika ada
  let contractId = log.contract_id;
  if (!contractId) {
    const activePayung = await prisma.contracts.findFirst({
      where: {
        tenant_id: log.tenant_id,
        contract_type: 'Payung',
        status: { in: ['Aktif', 'Active'] }
      },
      orderBy: { id: 'desc' }
    });
    if (activePayung) contractId = activePayung.id;
  }

  const [newInvoice] = await prisma.$transaction([
    prisma.invoices.create({
      data: {
        invoice_number: invoiceNumber,
        contract_id: contractId,
        tenant_id: log.tenant_id,
        invoice_type: 'Sewa Hanggar',
        amount: totalAmount,
        due_date: dueDate,
        status: 'Unpaid',
        details: [detailItem]
      },
      include: {
        tenants: true,
        contracts: true
      }
    }),
    prisma.operational_logs.update({
      where: { id: log.id },
      data: {
        billing_status: 'Billed',
        amount: totalAmount,
        exit_time: log.exit_time || new Date()
      }
    })
  ]);

  await prisma.operational_logs.update({
    where: { id: log.id },
    data: { invoice_id: newInvoice.id }
  });

  return newInvoice;
};

// OPSI B: Penetapan SKRD Terkonsolidasi / Rekapitulasi Batch Cut-Off Bulanan
exports.generateHanggarPeriodicInvoice = async (payload) => {
  const { tenant_id, log_ids, custom_rates = {} } = payload;
  if (!tenant_id || !Array.isArray(log_ids) || log_ids.length === 0) {
    throw new Error('Tenant ID dan minimal satu armada (log_id) wajib dipilih');
  }

  const tenantIdInt = Number.parseInt(tenant_id, 10);
  const parsedLogIds = log_ids.map(id => Number.parseInt(id, 10));

  const logs = await prisma.operational_logs.findMany({
    where: {
      id: { in: parsedLogIds },
      tenant_id: tenantIdInt,
      billing_status: 'Unbilled'
    },
    include: {
      tenants: true,
      contracts: true
    }
  });

  if (logs.length === 0) {
    throw new Error('Tidak ada armada valid yang berstatus Unbilled untuk ditagihkan');
  }

  const detailsList = [];
  let grandTotal = 0;

  for (const log of logs) {
    const calc = await calculateHanggarLogDetails(log);
    const effectiveRate = custom_rates[log.id] ? Number(custom_rates[log.id]) : calc.rate_per_night;
    const subtotal = calc.total_nights * effectiveRate;
    grandTotal += subtotal;

    detailsList.push({
      ...calc,
      rate_per_night: effectiveRate,
      subtotal
    });
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const count = await prisma.invoices.count();
  const seq = String(count + 1).padStart(3, '0');
  const invoiceNumber = `SKRD-HGR/${year}/${month}/${seq}`;

  // Jatuh tempo standar 30 hari kalender
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  // Hubungkan ke kontrak payung aktif jika ada
  const activePayung = await prisma.contracts.findFirst({
    where: {
      tenant_id: tenantIdInt,
      contract_type: 'Payung',
      status: { in: ['Aktif', 'Active'] }
    },
    orderBy: { id: 'desc' }
  });

  const contractId = activePayung ? activePayung.id : (logs[0]?.contract_id || null);

  const [newInvoice] = await prisma.$transaction([
    prisma.invoices.create({
      data: {
        invoice_number: invoiceNumber,
        contract_id: contractId,
        tenant_id: tenantIdInt,
        invoice_type: 'Sewa Hanggar',
        amount: grandTotal,
        due_date: dueDate,
        status: 'Unpaid',
        details: detailsList
      },
      include: {
        tenants: true,
        contracts: true
      }
    }),
    prisma.operational_logs.updateMany({
      where: { id: { in: logs.map(l => l.id) } },
      data: {
        billing_status: 'Billed'
      }
    })
  ]);

  await prisma.operational_logs.updateMany({
    where: { id: { in: logs.map(l => l.id) } },
    data: { invoice_id: newInvoice.id }
  });

  return newInvoice;
};

/**
 * Penerbitan SKRD Denda (Slide 5, 6, 9 PPT)
 * Diterbitkan oleh Dinas ketika SKRD pokok belum dibayar melewati jatuh tempo (>30 hari).
 * Besaran denda: 2% per bulan dari nilai pokok yang tertunggak.
 * Kode Rekening: 4.1.4.01.01 (Pendapatan Denda Retribusi Daerah)
 */
exports.generatePenaltyInvoice = async (principalInvoiceId, dinasUserId, payload = {}) => {
  const principalId = Number.parseInt(principalInvoiceId, 10);
  const principalInvoice = await prisma.invoices.findUnique({
    where: { id: principalId },
    include: {
      tenants: true,
      contracts: true
    }
  });

  if (!principalInvoice) {
    throw new Error('SKRD Pokok tidak ditemukan');
  }

  if (principalInvoice.status === 'Paid') {
    throw new Error('SKRD Pokok ini sudah Lunas, tidak dapat dikenakan SKRD Denda');
  }

  if (principalInvoice.status === 'Cancelled') {
    throw new Error('SKRD Pokok ini telah Dibatalkan');
  }

  // Hitung durasi keterlambatan
  const today = new Date();
  const dueDate = principalInvoice.due_date ? new Date(principalInvoice.due_date) : new Date(principalInvoice.created_at);
  
  // Lewat berapa hari
  const diffTime = today.getTime() - dueDate.getTime();
  const overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  if (overdueDays <= 0) {
    throw new Error(`SKRD ini belum melewati tanggal jatuh tempo (${dueDate.toLocaleDateString('id-ID')}). SKRD Denda hanya dapat diterbitkan untuk tagihan yang telah lewat jatuh tempo.`);
  }

  // Hitung jumlah bulan keterlambatan (pembulatan ke atas per bulan kalender sesuai PP/Perda Retribusi Daerah)
  const monthsOverdue = Math.max(1, Math.ceil(overdueDays / 30));
  const ratePct = 2; // 2% per bulan
  const principalAmount = Number(principalInvoice.amount);
  
  // Custom penalty amount or auto 2% per month
  const calculatedPenalty = Math.round(principalAmount * (ratePct / 100) * monthsOverdue);
  const penaltyAmount = payload.custom_amount ? Number(payload.custom_amount) : calculatedPenalty;

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const count = await prisma.invoices.count();
  const seq = String(count + 1).padStart(3, '0');
  const invoiceNumber = `SKRD-DND/${year}/${month}/${seq}`;

  // Jatuh tempo SKRD denda 30 hari kalender
  const penaltyDueDate = new Date();
  penaltyDueDate.setDate(penaltyDueDate.getDate() + 30);

  const referenceNote = payload.notes || `Denda atas keterlambatan pembayaran SKRD Nomor ${principalInvoice.invoice_number} tgl ${dueDate.toLocaleDateString('id-ID')}`;

  const penaltyDetails = {
    type: 'PENALTY_INVOICE',
    principal_invoice_id: principalInvoice.id,
    principal_invoice_number: principalInvoice.invoice_number,
    principal_amount: principalAmount,
    overdue_days: overdueDays,
    months_overdue: monthsOverdue,
    rate_percent_per_month: ratePct,
    reference_note: referenceNote,
    created_by_dinas_id: Number.parseInt(dinasUserId, 10) || null,
    account_code: '4.1.4.01.01'
  };

  const newPenaltyInvoice = await prisma.invoices.create({
    data: {
      invoice_number: invoiceNumber,
      contract_id: principalInvoice.contract_id,
      tenant_id: principalInvoice.tenant_id,
      invoice_type: 'SKRD Denda',
      amount: penaltyAmount,
      penalty_amount: 0,
      due_date: penaltyDueDate,
      status: 'Unpaid',
      details: penaltyDetails
    },
    include: {
      tenants: true,
      contracts: true
    }
  });

  return newPenaltyInvoice;
};

/**
 * Pembatalan SKRD (Slide 6 PPT)
 * Status SKRD diubah menjadi 'Cancelled' dengan catatan alasan pembatalan.
 */
exports.cancelInvoice = async (invoiceId, dinasUserId, reason) => {
  const invId = Number.parseInt(invoiceId, 10);
  const invoice = await prisma.invoices.findUnique({
    where: { id: invId }
  });

  if (!invoice) {
    throw new Error('Tagihan SKRD tidak ditemukan');
  }

  if (invoice.status === 'Paid') {
    throw new Error('SKRD yang sudah Lunas tidak dapat dibatalkan.');
  }

  const existingDetails = typeof invoice.details === 'object' && invoice.details !== null ? invoice.details : {};
  const updatedDetails = {
    ...existingDetails,
    cancellation: {
      reason: reason || 'Pembatalan SKRD oleh Dinas',
      cancelled_at: new Date(),
      cancelled_by_dinas_id: Number.parseInt(dinasUserId, 10) || null
    }
  };

  return await prisma.invoices.update({
    where: { id: invId },
    data: {
      status: 'Cancelled',
      details: updatedDetails
    },
    include: {
      tenants: true,
      contracts: true
    }
  });
};

/**
 * Koreksi & Terbitkan SKRD Pengganti (Slide 6 PPTX)
 * Membatalkan SKRD lama dan otomatis menerbitkan SKRD baru dengan nomor baru,
 * mencatat referensi koreksi secara transparan (Audit Trail).
 */
exports.reissueCorrectedInvoice = async (invoiceId, dinasUserId, payload = {}) => {
  const invId = Number.parseInt(invoiceId, 10);
  const oldInvoice = await prisma.invoices.findUnique({
    where: { id: invId },
    include: {
      tenants: true,
      contracts: true
    }
  });

  if (!oldInvoice) {
    throw new Error('Tagihan SKRD tidak ditemukan');
  }

  if (oldInvoice.status === 'Paid') {
    throw new Error('SKRD yang sudah Lunas tidak dapat dikoreksi/dibatalkan.');
  }

  const reason = payload.reason || 'Koreksi administratif penetapan SKRD';
  const newAmount = payload.new_amount ? Number(payload.new_amount) : Number(oldInvoice.amount);
  const newDueDate = payload.new_due_date ? new Date(payload.new_due_date) : new Date(oldInvoice.due_date);

  // 1. Batalkan SKRD Lama
  const existingDetails = typeof oldInvoice.details === 'object' && oldInvoice.details !== null ? oldInvoice.details : {};
  const updatedOldDetails = {
    ...existingDetails,
    cancellation: {
      reason: reason,
      cancelled_at: new Date(),
      cancelled_by_dinas_id: Number.parseInt(dinasUserId, 10) || null,
      status: 'CANCELLED_AND_REISSUED'
    }
  };

  await prisma.invoices.update({
    where: { id: invId },
    data: {
      status: 'Cancelled',
      details: updatedOldDetails
    }
  });

  // 2. Generate Nomor SKRD Baru untuk Pengganti (Koreksi)
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const count = await prisma.invoices.count();
  const seq = String(count + 1).padStart(3, '0');
  
  let prefix = 'SKRD-KOR';
  if (oldInvoice.invoice_type === 'SKRD Denda') prefix = 'SKRD-DND-KOR';
  const newInvoiceNumber = `${prefix}/${year}/${month}/${seq}`;

  // 3. Simpan rincian koreksi di details SKRD baru
  const newDetails = {
    ...existingDetails,
    correction: {
      is_corrected_invoice: true,
      corrected_from_invoice_id: oldInvoice.id,
      corrected_from_invoice_number: oldInvoice.invoice_number,
      correction_reason: reason,
      reissued_at: new Date(),
      reissued_by_dinas_id: Number.parseInt(dinasUserId, 10) || null,
      original_amount: Number(oldInvoice.amount)
    }
  };

  const newInvoice = await prisma.invoices.create({
    data: {
      invoice_number: newInvoiceNumber,
      contract_id: oldInvoice.contract_id,
      tenant_id: oldInvoice.tenant_id,
      invoice_type: oldInvoice.invoice_type || 'Sewa Hanggar',
      amount: newAmount,
      penalty_amount: 0,
      due_date: newDueDate,
      status: 'Unpaid',
      details: newDetails
    },
    include: {
      tenants: true,
      contracts: true
    }
  });

  return newInvoice;
};
