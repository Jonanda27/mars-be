const prisma = require('../config/db');
const assetService = require('./assetService');

// Generate Application Number: REQ/MARS/YYYY/MM/XXXX
const generateApplicationNumber = async () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  const lastApp = await prisma.rental_applications.findFirst({
    where: {
      application_number: {
        startsWith: `REQ/MARS/${year}/${month}/`
      }
    },
    orderBy: {
      id: 'desc'
    }
  });

  let nextNum = 1;
  if (lastApp) {
    const parts = lastApp.application_number.split('/');
    const lastNum = Number.parseInt(parts[parts.length - 1], 10);
    nextNum = lastNum + 1;
  }
  
  const formattedNum = String(nextNum).padStart(4, '0');
  return `REQ/MARS/${year}/${month}/${formattedNum}`;
};

// Roman numeral helper
const toRoman = (num) => {
  const romanNumerals = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romanNumerals[num] || String(num);
};

const getDocumentCode = (jenisAset) => {
  const map = {
    'Hanggar': 'SKH',     // Surat Kontrak Hanggar
    'Kantor': 'PKS-KT',   // Perjanjian Kerja Sama Kantor
    'Office': 'PKS-KT',
    'Ruangan': 'PKS-RG',  // Perjanjian Kerja Sama Ruangan
    'Apron': 'PKS-AP',    // Perjanjian Kerja Sama Apron
    'Gudang': 'PKS-GD',   // Perjanjian Kerja Sama Gudang
    'Kargo': 'PKS-GD',
    'Lahan': 'PKS-LH',    // Perjanjian Kerja Sama Lahan
  };
  return map[jenisAset] || 'PKS'; // Default: Perjanjian Kerja Sama
};

// Extract company initials from tenant name
// "PT. Jaya Dirgantara" -> "PT.JD"
// "CV. Merpati Nusantara Airlines" -> "CV.MNA"
const getCompanyInitials = (companyName) => {
  if (!companyName) return 'XX';
  // Split prefix (PT., CV., etc.) from the rest
  const prefixMatch = companyName.match(/^(PT\.?|CV\.?|UD\.?)\s*/i);
  let prefix = '';
  let rest = companyName;
  if (prefixMatch) {
    prefix = prefixMatch[1].replace(/\.?$/, '.'); // Normalize to "PT."
    rest = companyName.substring(prefixMatch[0].length);
  }
  // Get initials from remaining words
  const initials = rest
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase())
    .join('');
  return prefix ? `${prefix}${initials}` : initials;
};

// Generate Contract Number: 045/SKH-PT.ABC/VIII/2026
const generateContractNumber = async (jenisAset, namaPerusahaan) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const romanMonth = toRoman(month);
  const docCode = getDocumentCode(jenisAset);
  const companyInitials = getCompanyInitials(namaPerusahaan);

  // Count existing contracts this year to get next sequence number
  const countThisYear = await prisma.contracts.count({
    where: {
      created_at: {
        gte: new Date(year, 0, 1),   // Jan 1st of current year
        lt: new Date(year + 1, 0, 1) // Jan 1st of next year
      }
    }
  });

  const nextNum = countThisYear + 1;
  const formattedNum = String(nextNum).padStart(3, '0');
  return `${formattedNum}/${docCode}-${companyInitials}/${romanMonth}/${year}`;
};

exports.createApplication = async (tenantId, payload, file) => {
  const parsedTenantId = Number.parseInt(tenantId, 10);
  const appNumber = await generateApplicationNumber();
  
  let officialLetterUrl = null;
  if (file) {
    const rawPath = file.secure_url || file.path || '';
    officialLetterUrl = rawPath ? rawPath.replaceAll('\\', '/') : null;
  }

  let specificNeeds = {};
  if (payload.specific_needs) {
    if (typeof payload.specific_needs === 'string') {
      try {
        specificNeeds = JSON.parse(payload.specific_needs);
      } catch (e) {
        specificNeeds = { raw: payload.specific_needs };
      }
    } else if (typeof payload.specific_needs === 'object') {
      specificNeeds = { ...payload.specific_needs };
    }
  }

  if (payload.extend_from_contract_id) {
    specificNeeds.extend_from_contract_id = Number.parseInt(payload.extend_from_contract_id, 10);
  }
  if (payload.airport_id) {
    specificNeeds.airport_id = Number.parseInt(payload.airport_id, 10);
  }
  if (payload.airport_code) {
    specificNeeds.airport_code = payload.airport_code;
  }
  if (payload.airport_name) {
    specificNeeds.airport_name = payload.airport_name;
  }
  if (payload.airport_location) {
    specificNeeds.airport_location = payload.airport_location;
  }

  const appType = payload.application_type || null;
  const isMini = Boolean(appType && appType.toLowerCase().includes('mini'));
  const isHanggar = Boolean(appType && appType.toLowerCase().includes('hanggar'));
  const isApron = Boolean(appType && appType.toLowerCase().includes('apron'));

  // Cek apakah tenant memiliki Kontrak Payung yang berstatus Aktif
  let contractId = null;
  if (!isMini && (isHanggar || isApron || !appType)) {
    const activePayung = await prisma.contracts.findFirst({
      where: {
        tenant_id: parsedTenantId,
        contract_type: { in: ['Payung', 'PKS Payung Mozes Kilangin'] },
        status: { in: ['Aktif', 'Active', 'Signed'] }
      },
      orderBy: { created_at: 'desc' }
    });
    if (activePayung) {
      contractId = activePayung.id;
    }
  }

  return await prisma.rental_applications.create({
    data: {
      application_number: appNumber,
      tenant_id: parsedTenantId,
      asset_id: null, // intentionally null at step 1
      application_type: appType,
      contract_id: contractId,
      official_letter_url: officialLetterUrl,
      purpose: payload.purpose,
      specific_needs: specificNeeds,
      status: 'Menunggu Verifikasi Kadis' // Step 1 status
    },
    include: {
      assets: true,
      contracts: true
    }
  });
};

const createPayungContractForApplication = async (app) => {
  const currentYear = new Date().getFullYear();
  const countThisYear = await prisma.contracts.count({
    where: {
      contract_type: { in: ['Payung', 'PKS Payung Mozes Kilangin'] },
      created_at: { gte: new Date(`${currentYear}-01-01T00:00:00.000Z`) }
    }
  });
  const sequenceNumber = countThisYear + 1;
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(startDate.getFullYear() + 1);

  const masterTariffs = await prisma.master_tariffs.findMany({
    where: { status: 'Active' },
    orderBy: { id: 'asc' }
  });

  return await prisma.contracts.create({
    data: {
      contract_number: `PKS-PAYUNG/MOZES/${currentYear}/${sequenceNumber.toString().padStart(3, '0')}`,
      contract_type: 'PKS Payung Mozes Kilangin',
      tenant_id: app.tenant_id,
      status: 'Menunggu TTD Tenant',
      start_date: startDate,
      end_date: endDate,
      jenis_pemanfaatan: 'Perjanjian Kerja Sama Induk (Kontrak Payung) Sewa Hanggar & Apron Bandara Mozes Kilangin',
      fasilitas: masterTariffs,
      ketentuan_pembayaran: 'Tarif retribusi sewa hanggar dan apron dihitung berdasarkan luas pemanfaatan (m2) dan masa pemakaian di Bandara Mozes Kilangin.'
    },
    include: {
      tenants: true,
      assets: true
    }
  });
};

const createMiniAirportPayungContractForApplication = async (app, airportInfo) => {
  const currentYear = new Date().getFullYear();
  const airportCode = (airportInfo?.kode_bandara || airportInfo?.airport_code || 'MINI').toUpperCase();
  const airportName = airportInfo?.nama_bandara || airportInfo?.airport_name || 'Mini Airport Perintis';
  const airportId = airportInfo?.id || airportInfo?.airport_id || null;

  const countThisYear = await prisma.contracts.count({
    where: {
      contract_type: 'PKS Payung Mini Airport',
      contract_number: { contains: `/${airportCode}/${currentYear}/` },
      created_at: { gte: new Date(`${currentYear}-01-01T00:00:00.000Z`) }
    }
  });
  const sequenceNumber = countThisYear + 1;
  const startDate = new Date();
  const endDate = new Date();
  endDate.setFullYear(startDate.getFullYear() + 1);

  const masterTaxes = await prisma.master_taxes.findMany({
    where: { status: 'Active' },
    include: { aircraft_types: true },
    orderBy: { id: 'asc' }
  });

  return await prisma.contracts.create({
    data: {
      contract_number: `PKS-PAYUNG/${airportCode}/${currentYear}/${sequenceNumber.toString().padStart(3, '0')}`,
      contract_type: 'PKS Payung Mini Airport',
      tenant_id: app.tenant_id,
      status: 'Menunggu TTD Tenant',
      start_date: startDate,
      end_date: endDate,
      jenis_pemanfaatan: `Perjanjian Kerja Sama Induk (PKS Payung) Pelayanan Penerbangan Bandara ${airportName} (${airportCode})`,
      fasilitas: {
        category: 'Mini Airport',
        mini_airport_id: airportId,
        airport_code: airportCode,
        airport_name: airportName,
        airport_location: airportInfo?.lokasi || airportInfo?.airport_location || 'Papua Tengah',
        master_taxes: masterTaxes
      },
      ketentuan_pembayaran: 'Pembayaran retribusi pelayanan kebandarudaraan berbasis realisasi fisik kedatangan (Tax Pendaratan, Pax, Airport, dan Parkir/Nginap) sesuai SKRD resmi dari Dinas Perhubungan.',
      periode_pembayaran: 'Per Realisasi Kedatangan (SKRD Pasca-Flight)'
    },
    include: {
      tenants: true,
      assets: true
    }
  });
};

exports.verifyLetter = async (id, status) => {
  const appId = Number.parseInt(id, 10);
  const app = await prisma.rental_applications.findUnique({
    where: { id: appId },
    include: { tenants: true }
  });
  if (!app) throw new Error('Permohonan tidak ditemukan');

  const contractInclude = {
    include: {
      tenants: true,
      assets: true
    }
  };

  if (status !== 'Surat Disetujui') {
    return await prisma.rental_applications.update({
      where: { id: appId },
      data: { status },
      include: { tenants: true, contracts: contractInclude }
    });
  }

  const isMini = Boolean(
    app.application_type?.toLowerCase().includes('mini')
  );
  const isHanggar = Boolean(
    app.application_type?.toLowerCase().includes('hanggar') ||
    app.assets?.kategori?.toLowerCase().includes('hanggar')
  );
  const isApron = Boolean(
    app.application_type?.toLowerCase().includes('apron') ||
    app.assets?.kategori?.toLowerCase().includes('apron')
  );

  // ALUR A: MINI AIRPORT (PKS Payung per Mini Airport Tujuan dengan Lampiran Master Tax)
  if (isMini) {
    let spec = app.specific_needs || {};
    if (typeof spec === 'string') {
      try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
    }
    const targetAirportId = spec.airport_id ? Number(spec.airport_id) : null;
    const targetAirportCode = spec.airport_code || '';

    let airportInfo = null;
    if (targetAirportId) {
      airportInfo = await prisma.mini_airports.findUnique({ where: { id: targetAirportId } });
    } else if (targetAirportCode) {
      airportInfo = await prisma.mini_airports.findFirst({ where: { kode_bandara: targetAirportCode } });
    }

    const today = new Date();
    const activeMiniContracts = await prisma.contracts.findMany({
      where: {
        tenant_id: app.tenant_id,
        contract_type: 'PKS Payung Mini Airport',
        status: { in: ['Aktif', 'Active', 'Signed'] },
        end_date: { gte: today }
      },
      orderBy: { created_at: 'desc' }
    });

    const activePayungForThisAirport = activeMiniContracts.find(c => {
      const f = (c.fasilitas && typeof c.fasilitas === 'object') ? c.fasilitas : {};
      const fId = f.mini_airport_id ? Number(f.mini_airport_id) : null;
      const fCode = (f.airport_code || '').toUpperCase();
      return (targetAirportId && fId === targetAirportId) || 
             (targetAirportCode && fCode === targetAirportCode.toUpperCase()) ||
             (targetAirportCode && c.contract_number.includes(`/${targetAirportCode.toUpperCase()}/`));
    });

    if (activePayungForThisAirport) {
      // Tenant SUDAH memiliki PKS Payung aktif untuk bandara ini: tautkan & langsung 'Surat Disetujui'
      return await prisma.rental_applications.update({
        where: { id: appId },
        data: {
          status: 'Surat Disetujui',
          contract_id: activePayungForThisAirport.id
        },
        include: { tenants: true, contracts: contractInclude }
      });
    }

    // Tenant BELUM memiliki PKS Payung aktif untuk bandara ini: buatkan Draf PKS Payung baru
    const newPayung = await createMiniAirportPayungContractForApplication(app, airportInfo || spec);
    return await prisma.rental_applications.update({
      where: { id: appId },
      data: {
        status: 'Menunggu TTD Kontrak Payung',
        contract_id: newPayung.id
      },
      include: { tenants: true, contracts: contractInclude }
    });
  }

  // ALUR B: MOZES KILANGIN (Hanggar / Apron)
  if (isHanggar || isApron) {
    const activePayungMozes = await prisma.contracts.findFirst({
      where: {
        tenant_id: app.tenant_id,
        contract_type: { in: ['Payung', 'PKS Payung Mozes Kilangin'] },
        status: { in: ['Aktif', 'Active', 'Signed'] },
        end_date: { gte: new Date() }
      },
      orderBy: { created_at: 'desc' }
    });

    if (activePayungMozes) {
      return await prisma.rental_applications.update({
        where: { id: appId },
        data: {
          status: 'Surat Disetujui',
          contract_id: activePayungMozes.id
        },
        include: { tenants: true, contracts: contractInclude }
      });
    }

    const payungContract = await createPayungContractForApplication(app);
    return await prisma.rental_applications.update({
      where: { id: appId },
      data: {
        status: 'Menunggu TTD Kontrak Payung',
        contract_id: payungContract.id
      },
      include: { tenants: true, contracts: contractInclude }
    });
  }

  // ALUR C: SEWA RUANGAN & LAINNYA
  return await prisma.rental_applications.update({
    where: { id: appId },
    data: {
      status: 'Surat Disetujui'
    },
    include: { tenants: true, contracts: contractInclude }
  });
};

exports.uploadPayungSignature = async (id, filePath) => {
  const appId = Number.parseInt(id, 10);
  const app = await prisma.rental_applications.findUnique({
    where: { id: appId },
    include: { contracts: true, tenants: true }
  });
  if (!app) throw new Error('Permohonan tidak ditemukan');
  if (!app.contract_id) throw new Error('Kontrak Payung belum terkait pada permohonan ini');

  // Perbarui kontrak payung: tandai berkas scan TTD basah terunggah dan status Menunggu Pengesahan Kadis
  await prisma.contracts.update({
    where: { id: app.contract_id },
    data: {
      signed_document_url: filePath,
      tenant_signature: new Date().toISOString(),
      status: 'Menunggu Pengesahan Kadis'
    }
  });

  // Perbarui status permohonan sewa menjadi 'Menunggu Pengesahan Kadis' (tahap pengesahan PKS Induk)
  return await prisma.rental_applications.update({
    where: { id: appId },
    data: {
      status: 'Menunggu Pengesahan Kadis'
    },
    include: {
      tenants: true,
      contracts: {
        include: {
          tenants: true,
          assets: true
        }
      },
      assets: true
    }
  });
};

exports.completeDetails = async (id, payload) => {
  const appId = Number.parseInt(id, 10);
  const existingApp = await prisma.rental_applications.findUnique({
    where: { id: appId }
  });

  let contractId = existingApp?.contract_id;
  if (!contractId && existingApp?.tenant_id) {
    const activePayung = await prisma.contracts.findFirst({
      where: {
        tenant_id: existingApp.tenant_id,
        contract_type: 'Payung',
        status: { in: ['Aktif', 'Active'] }
      },
      orderBy: { created_at: 'desc' }
    });
    if (activePayung) {
      contractId = activePayung.id;
    }
  }

  // Validasi: Pastikan armada pesawat tidak sedang digunakan/dipilih pada permohonan lain yang aktif (baik Sewa Hanggar maupun Mini Airport)
  const chosenIds = new Set();
  const chosenRegs = new Set();
  if (payload.specific_needs) {
    let spec = payload.specific_needs;
    if (typeof spec === 'string') {
      try { spec = JSON.parse(spec); } catch (e) {}
    }
    if (spec) {
      if (spec.aircraft_id) chosenIds.add(Number.parseInt(spec.aircraft_id, 10));
      if (spec.registration_number) chosenRegs.add(spec.registration_number.trim().toUpperCase());
      if (Array.isArray(spec.aircraft_ids)) {
        spec.aircraft_ids.forEach(id => {
          if (id) chosenIds.add(Number.parseInt(id, 10));
        });
      }
      if (Array.isArray(spec.aircraft_details)) {
        spec.aircraft_details.forEach(d => {
          if (d.aircraft_id || d.id) chosenIds.add(Number.parseInt(d.aircraft_id || d.id, 10));
          if (d.registration_number) chosenRegs.add(d.registration_number.trim().toUpperCase());
        });
      }
    }
  }

  if (chosenIds.size > 0 || chosenRegs.size > 0) {
    const conflictingApps = await prisma.rental_applications.findMany({
      where: {
        id: { not: appId },
        tenant_id: existingApp.tenant_id,
        status: { notIn: ['Ditolak', 'Rejected', 'Batal', 'Cancelled', 'Selesai', 'Expired'] }
      },
      select: {
        id: true,
        application_number: true,
        status: true,
        specific_needs: true
      }
    });

    for (const cApp of conflictingApps) {
      let cSpec = cApp.specific_needs;
      if (typeof cSpec === 'string') {
        try { cSpec = JSON.parse(cSpec); } catch (e) {}
      }
      if (cSpec) {
        const cIds = new Set();
        const cRegs = new Set();
        if (cSpec.aircraft_id) cIds.add(Number.parseInt(cSpec.aircraft_id, 10));
        if (cSpec.registration_number) cRegs.add(cSpec.registration_number.trim().toUpperCase());
        if (Array.isArray(cSpec.aircraft_ids)) {
          cSpec.aircraft_ids.forEach(id => {
            if (id) cIds.add(Number.parseInt(id, 10));
          });
        }
        if (Array.isArray(cSpec.aircraft_details)) {
          cSpec.aircraft_details.forEach(d => {
            if (d.aircraft_id || d.id) cIds.add(Number.parseInt(d.aircraft_id || d.id, 10));
            if (d.registration_number) cRegs.add(d.registration_number.trim().toUpperCase());
          });
        }

        // Cek irisan (conflict detection)
        let hasConflict = false;
        let conflictIdentifier = null;
        for (const cid of chosenIds) {
          if (cIds.has(cid)) {
            hasConflict = true;
            conflictIdentifier = `ID ${cid}`;
            break;
          }
        }
        if (!hasConflict) {
          for (const creg of chosenRegs) {
            if (cRegs.has(creg)) {
              hasConflict = true;
              conflictIdentifier = creg;
              break;
            }
          }
        }

        if (hasConflict) {
          const err = new Error(`Armada ${conflictIdentifier || 'tersebut'} sedang terhubung / digunakan pada permohonan lain (${cApp.application_number || 'ID ' + cApp.id} - Status: ${cApp.status}). Silakan pilih armada lain.`);
          err.statusCode = 400;
          throw err;
        }
      }
    }
  }

  const updateData = {
    application_type: payload.application_type,
    asset_id: payload.asset_id ? Number.parseInt(payload.asset_id, 10) : null,
    specific_needs: payload.specific_needs,
    start_date: payload.start_date ? new Date(payload.start_date) : null,
    end_date: payload.end_date ? new Date(payload.end_date) : null,
    status: 'Menunggu Validasi Admin'
  };

  if (contractId) {
    updateData.contract_id = contractId;
  }

  // Update the rental application with new details
  const updatedApp = await prisma.rental_applications.update({
    where: { id: appId },
    data: updateData,
    include: {
      tenants: true,
      assets: { include: { master_tariffs: true } },
      contracts: true
    }
  });

  return updatedApp;
};

const getTariffForAircraftType = async (typeId) => {
  if (!typeId) return 0;
  const masterTariff = await prisma.master_tariffs.findFirst({
    where: { aircraft_type_id: Number.parseInt(typeId, 10) }
  });
  return masterTariff ? Number(masterTariff.tarif) : 0;
};

const calculateFromAircraftDetails = async (aircraftDetails) => {
  let total = 0;
  for (const detail of aircraftDetails) {
    total += await getTariffForAircraftType(detail.aircraft_type_id);
  }
  return total;
};

const calculateFromAircraftIds = async (aircraftIds) => {
  let total = 0;
  for (const acId of aircraftIds) {
    const aircraft = await prisma.aircrafts.findUnique({
      where: { id: Number.parseInt(acId, 10) }
    });
    total += await getTariffForAircraftType(aircraft?.aircraft_type_id);
  }
  return total;
};

const calculateHanggarTariff = async (specificNeeds) => {
  if (!specificNeeds) return 0;

  const parsed = typeof specificNeeds === 'string'
    ? JSON.parse(specificNeeds)
    : specificNeeds;

  if (Array.isArray(parsed.aircraft_details)) {
    return calculateFromAircraftDetails(parsed.aircraft_details);
  }
  if (Array.isArray(parsed.aircraft_ids)) {
    return calculateFromAircraftIds(parsed.aircraft_ids);
  }

  return 0;
};

const calculateContractAmounts = async (application, asset) => {
  if (!application.start_date || !application.end_date) {
    return { totalAmount: 0, tarifSatuan: 0 };
  }

  const startDate = new Date(application.start_date);
  const endDate = new Date(application.end_date);
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let diffMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  if (endDate.getDate() > startDate.getDate()) {
    diffMonths += 1;
  }
  const months = Math.max(1, diffMonths);

  const isHanggar = asset.jenis_aset?.toLowerCase().includes('hanggar');
  if (isHanggar && application.specific_needs) {
    const totalTarifPerMalam = await calculateHanggarTariff(application.specific_needs);
    return {
      totalAmount: diffDays * totalTarifPerMalam,
      tarifSatuan: totalTarifPerMalam
    };
  }

  if (asset.master_tariff_id) {
    const masterTariff = await prisma.master_tariffs.findUnique({
      where: { id: Number.parseInt(asset.master_tariff_id, 10) }
    });
    if (masterTariff) {
      const tarifSatuan = Number(masterTariff.tarif);
      const isPerM2 = masterTariff.satuan?.toLowerCase().includes('m2');
      const totalAmount = isPerM2
        ? months * tarifSatuan * (asset.luas || 1)
        : months * tarifSatuan;
      return { totalAmount, tarifSatuan };
    }
  }

  return { totalAmount: 0, tarifSatuan: 0 };
};

exports.approveAndDraftContract = async (id, _user) => {
  const application = await prisma.rental_applications.findUnique({
    where: { id: Number.parseInt(id, 10) },
    include: {
      tenants: true,
      assets: true
    }
  });

  if (!application) throw new Error('Application not found');
  if (application.status === 'Disetujui' || application.contract_id) {
    throw new Error('Application is already approved or has a contract');
  }
  
  // We need asset details to draft the contract
  if (!application.asset_id || !application.assets) {
    throw new Error('Asset must be assigned before approval');
  }

  const asset = application.assets;
  const tenant = application.tenants;

  // Generate draft contract number
  const contractNum = await generateContractNumber(asset.jenis_aset, tenant.nama_perusahaan);
  const { totalAmount, tarifSatuan } = await calculateContractAmounts(application, asset);

  // Start transaction to update application and create draft contract
  return await prisma.$transaction(async (tx) => {
    // 1. Create Draft Contract
    const draftContract = await tx.contracts.create({
      data: {
        contract_number: contractNum,
        contract_type: application.application_type?.includes('Perpanjangan') ? 'Perpanjangan' : 'Sewa Baru',
        tenant_id: tenant.id,
        asset_id: asset.id,
        status: 'Draft',
        start_date: application.start_date,
        end_date: application.end_date,
        jenis_pemanfaatan: application.purpose,
        luas: asset.luas,
        tarif_satuan: tarifSatuan,
        periode_pembayaran: 'Sekaligus di Awal',
        total_amount: totalAmount,
      }
    });

    // 2. Update Application Status & link contract
    return await tx.rental_applications.update({
      where: { id: Number.parseInt(id, 10) },
      data: {
        status: 'Draft Kontrak',
        contract_id: draftContract.id
      },
      include: {
        contracts: true,
        tenants: true,
        assets: true
      }
    });
  });
};

exports.getApplicationsByTenant = async (tenantId) => {
  return await prisma.rental_applications.findMany({
    where: { tenant_id: Number.parseInt(tenantId, 10) },
    include: {
      tenants: true,
      assets: {
        include: { master_tariffs: true }
      },
      contracts: {
        include: {
          tenants: true,
          assets: {
            include: { master_tariffs: true }
          },
          invoices: {
            orderBy: { id: 'asc' }
          }
        }
      }
    },
    orderBy: { id: 'desc' }
  });
};

exports.getAllApplications = async (airportId, miniAirportId) => {
  const allApps = await prisma.rental_applications.findMany({
    include: {
      tenants: true,
      assets: {
        include: { master_tariffs: true }
      },
      contracts: {
        include: {
          tenants: true,
          assets: {
            include: { master_tariffs: true }
          },
          invoices: {
            orderBy: { id: 'asc' }
          }
        }
      }
    },
    orderBy: { id: 'desc' }
  });

  if (miniAirportId) {
    if (miniAirportId === 'ALL_MINI') {
      return allApps.filter((app) => (app.application_type || '').toLowerCase().includes('mini'));
    }
    const targetMiniId = Number.parseInt(miniAirportId, 10);
    return allApps.filter((app) => {
      const isMini = (app.application_type || '').toLowerCase().includes('mini');
      if (!isMini) return false;

      let spec = app.specific_needs;
      if (typeof spec === 'string') {
        try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
      }

      const appMiniId = spec?.mini_airport_id || spec?.airport_id;
      return Number(appMiniId) === targetMiniId;
    });
  }

  if (airportId) {
    const targetAirportId = Number.parseInt(airportId, 10);
    return allApps.filter((app) => {
      const isMini = (app.application_type || '').toLowerCase().includes('mini');
      if (isMini) return false;

      if (app.assets?.airport_id) {
        return Number(app.assets.airport_id) === targetAirportId;
      }
      return true;
    });
  }

  return allApps;
};

exports.getApplicationById = async (id) => {
  const app = await prisma.rental_applications.findUnique({
    where: { id: Number.parseInt(id, 10) },
    include: {
      tenants: true,
      assets: {
        include: { master_tariffs: true }
      },
      contracts: {
        include: {
          tenants: true,
          assets: {
            include: { master_tariffs: true }
          },
          invoices: {
            orderBy: { id: 'asc' }
          }
        }
      }
    }
  });
  if (!app) throw new Error('Application not found');
  
  if (app.specific_needs && Array.isArray(app.specific_needs.aircraft_ids) && app.specific_needs.aircraft_ids.length > 0) {
    const aircraftIds = app.specific_needs.aircraft_ids.map(aid => Number.parseInt(aid, 10));
    const aircrafts = await prisma.aircrafts.findMany({
      where: { id: { in: aircraftIds } },
      include: {
        aircraft_types: {
          include: {
            master_tariffs: true
          }
        }
      }
    });
    
    app.specific_needs.aircraft_details = aircrafts;
  }
  
  app.requires_payung = await checkAppRequiresPayung(app);

  return app;
};

const checkAppRequiresPayung = async (app) => {
  const isHangar = Boolean(
    app.application_type?.toLowerCase().includes('hanggar') ||
    app.assets?.kategori?.toLowerCase().includes('hanggar') ||
    app.contracts?.contract_type === 'Payung'
  );
  if (!isHangar) return false;

  if (app.status === 'Menunggu TTD Kontrak Payung') return true;
  if (app.contracts?.contract_type === 'Payung') return true;

  const activePayung = await prisma.contracts.findFirst({
    where: {
      tenant_id: app.tenant_id,
      contract_type: 'Payung',
      status: { in: ['Aktif', 'Active'] }
    }
  });
  return !activePayung;
};

const validateHangarCapacity = async (app, finalAssetId) => {
  const asset = await prisma.assets.findUnique({ where: { id: finalAssetId } });
  if (asset?.jenis_aset !== 'Hanggar') return;

  let requestedArea = 0;
  if (app.specific_needs && Array.isArray(app.specific_needs.aircraft_ids)) {
    for (const acId of app.specific_needs.aircraft_ids) {
      const aircraft = await prisma.aircrafts.findUnique({
        where: { id: Number.parseInt(acId, 10) },
        include: { aircraft_types: true }
      });
      if (aircraft?.aircraft_types) {
        requestedArea += Number.parseFloat(aircraft.aircraft_types.luas_efektif_m2 || 0);
      }
    }
  }

  const capacity = await assetService.getHangarCapacity(finalAssetId);
  if (requestedArea > capacity.remainingArea) {
    throw new Error(`Kapasitas Hanggar tidak mencukupi. Sisa ruang: ${capacity.remainingArea} m2, Dibutuhkan: ${requestedArea} m2.`);
  }
};

const createNewRentalContract = async (app, finalAssetId) => {
  const asset = await prisma.assets.findUnique({
    where: { id: finalAssetId },
    include: { master_tariffs: true }
  });
  const tenant = await prisma.tenants.findUnique({
    where: { id: app.tenant_id }
  });

  const contractNum = await generateContractNumber(asset?.jenis_aset || 'Ruangan', tenant?.nama_perusahaan);
  const { totalAmount, tarifSatuan } = await calculateContractAmounts(app, asset || {});

  return await prisma.contracts.create({
    data: {
      contract_number: contractNum,
      contract_type: app.application_type?.includes('Perpanjangan') ? 'Perpanjangan' : 'Sewa Baru',
      tenant_id: app.tenant_id,
      asset_id: finalAssetId,
      status: 'Menunggu TTD Tenant',
      start_date: app.start_date,
      end_date: app.end_date,
      jenis_pemanfaatan: app.purpose || `Sewa Ruangan - ${asset?.nama_aset || 'Aset'}`,
      luas: asset?.luas,
      tarif_satuan: tarifSatuan,
      periode_pembayaran: 'Sekaligus di Awal',
      total_amount: totalAmount
    }
  });
};

exports.updateApplicationStatus = async (id, status, assetIdOverride, allocatedStand) => {
  const app = await exports.getApplicationById(id);
  const updateData = { status };
  if (assetIdOverride) {
    updateData.asset_id = Number.parseInt(assetIdOverride, 10);
  }

  const isMini = (app.application_type || '').toLowerCase().includes('mini');
  const isHangar = (app.application_type || '').toLowerCase().includes('hanggar') || 
                   (app.assets?.kategori || '').toLowerCase().includes('hanggar') || 
                   app.contracts?.contract_type === 'Payung';

  if (isMini) {
    if (status === 'Aktif' || status === 'Approved') {
      updateData.status = 'Aktif';
    }
    // Pastikan contract_id terhubung ke Kontrak Payung aktif jika belum tersambung
    if (!app.contract_id && !updateData.contract_id) {
      const activePayung = await prisma.contracts.findFirst({
        where: {
          tenant_id: app.tenant_id,
          contract_type: 'Payung',
          status: { in: ['Aktif', 'Active'] }
        },
        orderBy: { created_at: 'desc' }
      });
      if (activePayung) {
        updateData.contract_id = activePayung.id;
      }
    }
    if (allocatedStand) {
      let spec = app.specific_needs;
      if (typeof spec === 'string') {
        try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
      } else if (!spec) {
        spec = {};
      }
      spec.allocated_stand = allocatedStand;
      updateData.specific_needs = spec;
    }
  } else if (status === 'Aktif' && isHangar) {
    const finalAssetId = assetIdOverride ? Number.parseInt(assetIdOverride, 10) : app.asset_id;
    if (finalAssetId) {
      await validateHangarCapacity(app, finalAssetId);
    }
  } else if (status === 'Approved' || status === 'Draft Kontrak') {
    const finalAssetId = assetIdOverride ? Number.parseInt(assetIdOverride, 10) : app.asset_id;
    if (!finalAssetId) throw new Error('Asset ID must be assigned before approval');

    if (isHangar) {
      await validateHangarCapacity(app, finalAssetId);
      updateData.status = 'Aktif';
    } else {
      const newContract = await createNewRentalContract(app, finalAssetId);
      updateData.contract_id = newContract.id;
      updateData.status = 'Draft Kontrak';
    }
  }

  return await prisma.rental_applications.update({
    where: { id: Number.parseInt(id, 10) },
    data: updateData,
    include: {
      assets: {
        include: {
          master_tariffs: true
        }
      },
      tenants: true,
      contracts: {
        include: {
          tenants: true,
          assets: true
        }
      }
    }
  });
};

exports.getApprovedApplications = async () => {
  return await prisma.rental_applications.findMany({
    where: { 
      status: { in: ['Signed', 'Aktif'] },
      application_type: { in: ['Sewa Hanggar', 'Sewa Apron'] }
    }, // Signed / Aktif Hanggar & Apron applications can be checked in by Petugas Mozes
    include: {
      tenants: true,
      assets: {
        include: { master_tariffs: true }
      },
      contracts: true
    },
    orderBy: { created_at: 'desc' }
  });
};

exports.updateSignature = async (id, filePath) => {
  return await prisma.rental_applications.update({
    where: { id: Number.parseInt(id, 10) },
    data: { 
      signed_document_url: filePath,
      status: 'Aktif'
    },
    include: {
      tenants: true
    }
  });
};

exports.uploadOfficialLetter = async (id, filePath) => {
  return await prisma.rental_applications.update({
    where: { id: Number.parseInt(id, 10) },
    data: { official_letter_url: filePath },
    include: { tenants: true, contracts: true, assets: true }
  });
};

// =========================================================================
// FITUR PERPANJANGAN MASA SEWA (LEASE EXTENSION & ASSET RELOCATION)
// =========================================================================

exports.requestExtension = async (applicationId, tenantId, payload) => {
  const { requested_end_date, reason } = payload;
  if (!requested_end_date) {
    throw new Error('Tanggal akhir perpanjangan (requested_end_date) wajib diisi');
  }
  if (!reason || !reason.trim()) {
    throw new Error('Alasan perpanjangan sewa wajib diisi');
  }

  const app = await prisma.rental_applications.findUnique({
    where: { id: parseInt(applicationId) },
    include: { tenants: true, assets: true, contracts: true }
  });

  if (!app) {
    throw new Error('Permohonan sewa tidak ditemukan');
  }

  if (tenantId && app.tenant_id !== parseInt(tenantId)) {
    throw new Error('Anda tidak memiliki izin untuk permohonan ini');
  }

  const currentEndDate = app.end_date ? new Date(app.end_date) : new Date();
  currentEndDate.setHours(0, 0, 0, 0);
  const newEndDate = new Date(requested_end_date);
  newEndDate.setHours(0, 0, 0, 0);

  if (newEndDate <= currentEndDate) {
    throw new Error(`Tanggal perpanjangan (${requested_end_date}) harus lebih besar dari tanggal akhir sewa saat ini (${app.end_date ? new Date(app.end_date).toISOString().split('T')[0] : 'N/A'})`);
  }

  const diffTime = newEndDate.getTime() - currentEndDate.getTime();
  const additionalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const spec = typeof app.specific_needs === 'string'
    ? JSON.parse(app.specific_needs)
    : (app.specific_needs || {});

  spec.extension_request = {
    status: 'Pending',
    original_end_date: app.end_date ? new Date(app.end_date).toISOString().split('T')[0] : null,
    requested_end_date: requested_end_date,
    additional_days: additionalDays,
    reason: reason.trim(),
    requested_at: new Date().toISOString()
  };

  const updatedApp = await prisma.rental_applications.update({
    where: { id: parseInt(applicationId) },
    data: {
      specific_needs: spec
    },
    include: { tenants: true, assets: true, contracts: true }
  });

  return updatedApp;
};

exports.getPendingExtensions = async (airportId) => {
  let whereClause = {
    status: {
      in: ['Aktif', 'Active', 'Approved', 'Disetujui', 'Signed', 'Draft Kontrak']
    }
  };

  const apps = await prisma.rental_applications.findMany({
    where: whereClause,
    include: {
      tenants: true,
      assets: {
        include: { master_tariffs: true }
      },
      contracts: true
    },
    orderBy: { updated_at: 'desc' }
  });

  return apps.filter(app => {
    const spec = typeof app.specific_needs === 'string'
      ? JSON.parse(app.specific_needs)
      : (app.specific_needs || {});
    return spec.extension_request && spec.extension_request.status === 'Pending';
  });
};

exports.getAssetAvailabilityForExtension = async (airportId, startDateStr, endDateStr, excludeApplicationId = null, category = null) => {
  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  const endDate = endDateStr ? new Date(endDateStr) : new Date(startDate.getTime() + 7 * 86400000);

  // 1. Dapatkan detail permohonan yang sedang di-review perpanjangannya jika excludeApplicationId ada
  let applicantApp = null;
  if (excludeApplicationId) {
    applicantApp = await prisma.rental_applications.findUnique({
      where: { id: parseInt(excludeApplicationId) },
      include: { assets: true, tenants: true }
    });
  }

  // Tentukan apakah permohonan ini bertipe Aviasi (Hanggar/Apron) atau Sewa Ruangan (Office, Gudang, Konter, Lahan, dsb.)
  let isAviation = true;
  if (category) {
    isAviation = category.toUpperCase() === 'HANGGAR' || category.toUpperCase() === 'AVIATION';
  } else if (applicantApp) {
    const ja = (applicantApp.assets?.jenis_aset || '').toLowerCase();
    const at = (applicantApp.application_type || '').toLowerCase();
    const isHangarOrApron = ja === 'hanggar' || ja === 'apron' || at.includes('hanggar') || at.includes('apron');
    isAviation = isHangarOrApron;
  }

  const effectiveAirportId = airportId || applicantApp?.assets?.airport_id || applicantApp?.airport_id || null;

  // 2. Cari semua permohonan aktif yang beririsan dengan rentang tanggal perpanjangan
  const allOverlappingApps = await prisma.rental_applications.findMany({
    where: {
      status: {
        in: [
          'Aktif', 'Active', 'Approved', 'Disetujui', 'Signed',
          'Draft Kontrak', 'Menunggu Validasi Admin'
        ]
      },
      AND: [
        { start_date: { lte: endDate } },
        {
          OR: [
            { end_date: null },
            { end_date: { gte: startDate } }
          ]
        }
      ]
    },
    include: { tenants: true }
  });

  // JALUR A: SEWA RUANGAN & FASILITAS LAIN (Bukan Hanggar / Apron)
  if (!isAviation) {
    let whereAsset = {
      jenis_aset: { notIn: ['Hanggar', 'Apron'] }
    };
    if (effectiveAirportId) {
      whereAsset.airport_id = parseInt(effectiveAirportId);
    }

    const roomAssets = await prisma.assets.findMany({
      where: whereAsset,
      include: { master_tariffs: true, airports: true },
      orderBy: { id: 'asc' }
    });

    // Pastikan aset saat ini ada di dalam daftar meskipun beda airport_id
    if (applicantApp?.assets && !roomAssets.some(a => a.id === applicantApp.assets.id)) {
      roomAssets.unshift(applicantApp.assets);
    }

    const results = [];
    for (const asset of roomAssets) {
      // Periksa apakah ruangan ini dipakai oleh penyewa lain pada periode tersebut
      let isConflicting = false;
      let conflictingTenant = null;
      let conflictingAppNumber = null;

      for (const app of allOverlappingApps) {
        if (excludeApplicationId && app.id === parseInt(excludeApplicationId)) {
          continue;
        }

        const spec = typeof app.specific_needs === 'string'
          ? JSON.parse(app.specific_needs)
          : (app.specific_needs || {});

        let effectiveAssetId = app.asset_id;
        if (Array.isArray(spec.relocations) && spec.relocations.length > 0) {
          for (const rel of spec.relocations) {
            const relFrom = rel.effective_from ? new Date(rel.effective_from) : null;
            const relTo = rel.effective_to ? new Date(rel.effective_to) : null;
            if (relFrom && relTo && startDate <= relTo && endDate >= relFrom) {
              effectiveAssetId = parseInt(rel.new_asset_id);
            }
          }
        }

        if (effectiveAssetId === asset.id) {
          isConflicting = true;
          conflictingTenant = app.tenants?.nama_perusahaan || 'Penyewa Lain';
          conflictingAppNumber = app.application_number;
          break;
        }
      }

      const isCurrent = applicantApp ? applicantApp.asset_id === asset.id : false;

      results.push({
        id: asset.id,
        nama_aset: asset.nama_aset,
        kode_aset: asset.kode_aset,
        jenis_aset: asset.jenis_aset, // e.g. "Ruang Office", "Gudang Warehouse", "Konter Tiket"
        lokasi: asset.lokasi,
        luas: parseFloat(asset.luas || 0),
        total_area: parseFloat(asset.luas || 0),
        is_available: !isConflicting,
        is_current: isCurrent,
        conflicting_tenant: conflictingTenant,
        conflicting_app_number: conflictingAppNumber,
        master_tariffs: asset.master_tariffs,
        airports: asset.airports,
        category: 'RUANGAN'
      });
    }

    // Urutkan agar aset saat ini muncul paling atas
    results.sort((a, b) => (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0));
    return results;
  }

  // JALUR B: SEWA HANGGAR & APRON (Aviasi / Pesawat)
  let whereAsset = {
    jenis_aset: { in: ['Hanggar', 'Apron'] }
  };
  if (effectiveAirportId) {
    whereAsset.airport_id = parseInt(effectiveAirportId);
  }

  const assets = await prisma.assets.findMany({
    where: whereAsset,
    include: { master_tariffs: true, airports: true },
    orderBy: { id: 'asc' }
  });

  // Dapatkan detail pesawat pemohon
  let applicantAircraft = null;
  let applicantArea = 0;
  if (applicantApp) {
    const applicantSpec = typeof applicantApp.specific_needs === 'string'
      ? JSON.parse(applicantApp.specific_needs)
      : (applicantApp.specific_needs || {});

    if (Array.isArray(applicantSpec.aircraft_details) && applicantSpec.aircraft_details.length > 0) {
      applicantAircraft = applicantSpec.aircraft_details[0];
      applicantArea = parseFloat(applicantAircraft.luas_efektif_m2 || 0);
    } else if (Array.isArray(applicantSpec.aircraft_ids) && applicantSpec.aircraft_ids.length > 0) {
      const ac = await prisma.aircrafts.findUnique({
        where: { id: parseInt(applicantSpec.aircraft_ids[0]) },
        include: { aircraft_types: true }
      });
      if (ac) {
        applicantArea = parseFloat(ac.aircraft_types?.luas_efektif_m2 || 250);
        applicantAircraft = {
          id: ac.id,
          registration_number: ac.registration_number,
          tipe_pesawat: ac.aircraft_types?.tipe_pesawat || 'Aircraft',
          luas_efektif_m2: applicantArea
        };
      }
    }
  }

  const results = [];
  for (const asset of assets) {
    const totalArea = parseFloat(asset.luas || 0);
    let usedArea = 0;
    let overlappingCount = 0;

    for (const app of allOverlappingApps) {
      if (excludeApplicationId && app.id === parseInt(excludeApplicationId)) {
        continue;
      }

      const spec = typeof app.specific_needs === 'string'
        ? JSON.parse(app.specific_needs)
        : (app.specific_needs || {});

      let effectiveAssetId = app.asset_id;
      if (Array.isArray(spec.relocations) && spec.relocations.length > 0) {
        for (const rel of spec.relocations) {
          const relFrom = rel.effective_from ? new Date(rel.effective_from) : null;
          const relTo = rel.effective_to ? new Date(rel.effective_to) : null;
          if (relFrom && relTo && startDate <= relTo && endDate >= relFrom) {
            effectiveAssetId = parseInt(rel.new_asset_id);
          }
        }
      }

      if (effectiveAssetId !== asset.id) {
        continue;
      }

      overlappingCount++;
      if (Array.isArray(spec.aircraft_details)) {
        for (const detail of spec.aircraft_details) {
          if (detail.luas_efektif_m2) {
            usedArea += parseFloat(detail.luas_efektif_m2);
          }
        }
      } else if (Array.isArray(spec.aircraft_ids)) {
        for (const acId of spec.aircraft_ids) {
          const ac = await prisma.aircrafts.findUnique({
            where: { id: parseInt(acId) },
            include: { aircraft_types: true }
          });
          if (ac?.aircraft_types?.luas_efektif_m2) {
            usedArea += parseFloat(ac.aircraft_types.luas_efektif_m2);
          }
        }
      } else {
        usedArea += 250;
      }
    }

    const availableBeforeApplicant = Math.max(0, totalArea - usedArea);
    const remainingAfterAllocation = Math.max(0, totalArea - usedArea - applicantArea);
    const isSufficient = asset.jenis_aset === 'Apron' ? true : (availableBeforeApplicant >= applicantArea);

    results.push({
      id: asset.id,
      nama_aset: asset.nama_aset,
      kode_aset: asset.kode_aset,
      jenis_aset: asset.jenis_aset,
      lokasi: asset.lokasi,
      total_area: totalArea,
      used_area: usedArea,
      applicant_area: applicantArea,
      applicant_aircraft: applicantAircraft,
      available_before: availableBeforeApplicant,
      remaining_area: remainingAfterAllocation,
      is_available: isSufficient,
      overlapping_count: overlappingCount,
      master_tariffs: asset.master_tariffs,
      airports: asset.airports,
      category: 'HANGGAR'
    });
  }

  return results;
};

exports.reviewExtension = async (applicationId, reviewerUser, payload) => {
  const { action, target_asset_id, admin_notes } = payload;
  if (!['APPROVE', 'REJECT'].includes(action)) {
    throw new Error("Action harus 'APPROVE' atau 'REJECT'");
  }

  const app = await prisma.rental_applications.findUnique({
    where: { id: parseInt(applicationId) },
    include: { tenants: true, assets: true, contracts: true }
  });

  if (!app) {
    throw new Error('Permohonan sewa tidak ditemukan');
  }

  const spec = typeof app.specific_needs === 'string'
    ? JSON.parse(app.specific_needs)
    : (app.specific_needs || {});

  if (!spec.extension_request || spec.extension_request.status !== 'Pending') {
    throw new Error('Tidak ada pengajuan perpanjangan berstatus Pending untuk permohonan ini');
  }

  if (!Array.isArray(spec.extension_history)) {
    spec.extension_history = [];
  }

  const nowIso = new Date().toISOString();
  let updatedData = {};

  if (action === 'APPROVE') {
    const newEndDateStr = spec.extension_request.requested_end_date;
    const originalEndDateStr = spec.extension_request.original_end_date;

    let allocatedAsset = app.assets;
    let isRelocated = false;
    if (target_asset_id && parseInt(target_asset_id) !== app.asset_id) {
      const newAsset = await prisma.assets.findUnique({
        where: { id: parseInt(target_asset_id) },
        include: { master_tariffs: true }
      });
      if (newAsset) {
        allocatedAsset = newAsset;
        isRelocated = true;
      }
    }

    const historyEntry = {
      ...spec.extension_request,
      status: 'Approved',
      reviewed_by: reviewerUser.username,
      reviewed_at: nowIso,
      admin_notes: admin_notes || '',
      allocated_asset_id: allocatedAsset?.id || app.asset_id,
      allocated_asset_name: allocatedAsset?.nama_aset || app.assets?.nama_aset,
      allocated_asset_type: allocatedAsset?.jenis_aset || app.assets?.jenis_aset,
      is_relocated: isRelocated
    };
    spec.extension_history.push(historyEntry);

    if (isRelocated && allocatedAsset) {
      if (!Array.isArray(spec.relocations)) {
        spec.relocations = [];
      }
      spec.relocations.push({
        previous_asset_id: app.asset_id,
        previous_asset_name: app.assets?.nama_aset,
        new_asset_id: allocatedAsset.id,
        new_asset_name: allocatedAsset.nama_aset,
        new_asset_type: allocatedAsset.jenis_aset,
        effective_from: originalEndDateStr,
        effective_to: newEndDateStr,
        reason: admin_notes || 'Relokasi penempatan perpanjangan sewa oleh Admin UPBU'
      });
    }

    spec.extension_request = {
      ...spec.extension_request,
      status: 'Approved',
      reviewed_by: reviewerUser.username,
      reviewed_at: nowIso,
      admin_notes: admin_notes || '',
      allocated_asset_id: allocatedAsset?.id || app.asset_id,
      allocated_asset_name: allocatedAsset?.nama_aset || app.assets?.nama_aset,
      allocated_asset_type: allocatedAsset?.jenis_aset || app.assets?.jenis_aset,
      is_relocated: isRelocated
    };

    let newAppType = app.application_type;
    if (allocatedAsset) {
      if (allocatedAsset.jenis_aset === 'Apron') {
        newAppType = 'Sewa Apron';
      } else if (allocatedAsset.jenis_aset === 'Hanggar') {
        newAppType = 'Sewa Hanggar';
      }
    }

    updatedData = {
      end_date: new Date(newEndDateStr),
      asset_id: allocatedAsset ? allocatedAsset.id : app.asset_id,
      application_type: newAppType,
      specific_needs: spec
    };

    // Update asset_id armada jika armada terdaftar dalam permohonan ini
    const aircraftIds = spec.aircraft_ids || (spec.aircraft_details || []).map(d => d.aircraft_id).filter(Boolean);
    if (Array.isArray(aircraftIds) && aircraftIds.length > 0 && allocatedAsset) {
      await prisma.aircrafts.updateMany({
        where: { id: { in: aircraftIds.map(id => parseInt(id)) } },
        data: { asset_id: allocatedAsset.id }
      }).catch(err => console.error('Failed to update aircrafts asset_id on relocation:', err));
    }
  } else {
    // REJECT
    const historyEntry = {
      ...spec.extension_request,
      status: 'Rejected',
      reviewed_by: reviewerUser.username,
      reviewed_at: nowIso,
      admin_notes: admin_notes || ''
    };
    spec.extension_history.push(historyEntry);

    spec.extension_request = {
      ...spec.extension_request,
      status: 'Rejected',
      reviewed_by: reviewerUser.username,
      reviewed_at: nowIso,
      admin_notes: admin_notes || ''
    };

    updatedData = {
      specific_needs: spec
    };
  }

  const updatedApp = await prisma.rental_applications.update({
    where: { id: parseInt(applicationId) },
    data: updatedData,
    include: { tenants: true, assets: true, contracts: true }
  });

  return updatedApp;
};

/**
 * Cek ketersediaan Stand Apron di Mini Airport pada tanggal tertentu secara real-time
 * Stand dianggap terisi (occupied) jika:
 * 1. Ada pesawat yang sedang terparkir aktif di lapangan (operational_logs)
 * 2. Ada permohonan landing lain yang sudah disetujui/aktif pada tanggal yang sama (rental_applications)
 */
exports.getMiniAirportStandAvailability = async (miniAirportId, dateStr, excludeApplicationId = null) => {
  const airportId = Number.parseInt(miniAirportId, 10);
  const targetDateStr = dateStr ? dateStr.substring(0, 10) : new Date().toISOString().substring(0, 10);

  const stands = [
    { stand: 'STAND 01', name: 'Apron Utama', is_occupied: false, occupied_by: null, aircraft_type: null, status: 'Tersedia / Kosong', source: null, notes: '' },
    { stand: 'STAND 02', name: 'Apron Cadangan', is_occupied: false, occupied_by: null, aircraft_type: null, status: 'Tersedia / Kosong', source: null, notes: '' }
  ];

  // 1. Cek realisasi operasional log parkir aktif di mini airport
  const logs = await prisma.operational_logs.findMany({
    where: {
      OR: [
        { parking_location: { contains: 'STAND' } },
        { notes: { contains: 'allocated_stand' } }
      ]
    },
    include: {
      rental_applications: true
    }
  });

  for (const log of logs) {
    let parsedNotes = {};
    if (typeof log.notes === 'string') {
      try { parsedNotes = JSON.parse(log.notes); } catch (e) {}
    }

    const logAirportId = Number(parsedNotes.mini_airport_id || parsedNotes.airport_id || log.rental_applications?.specific_needs?.airport_id);
    const isSameAirport = logAirportId === airportId || (log.parking_location && log.parking_location.toLowerCase().includes('ilaga') && airportId === 1);

    if (!isSameAirport) continue;

    // Cek apakah log ini aktif pada targetDate
    const entryDateStr = log.entry_time ? new Date(log.entry_time).toISOString().substring(0, 10) : null;
    const exitDateStr = log.exit_time ? new Date(log.exit_time).toISOString().substring(0, 10) : null;

    let isOverlapping = false;
    if (!log.exit_time) {
      // Belum checkout: masih parkir aktif di apron
      isOverlapping = true;
    } else {
      // Sudah checkout
      const exitTimeDate = new Date(log.exit_time);
      const now = new Date();
      // Jika pesawat sudah checkout dan lepas landas, stand sudah kosong dan bebas digunakan
      if (exitTimeDate <= now && targetDateStr === now.toISOString().substring(0, 10)) {
        isOverlapping = false;
      } else {
        isOverlapping = entryDateStr <= targetDateStr && targetDateStr <= exitDateStr;
      }
    }

    if (isOverlapping) {
      let standCode = null;
      if (log.parking_location.toUpperCase().includes('STAND 01') || parsedNotes.allocated_stand === 'STAND 01') {
        standCode = 'STAND 01';
      } else if (log.parking_location.toUpperCase().includes('STAND 02') || parsedNotes.allocated_stand === 'STAND 02') {
        standCode = 'STAND 02';
      }

      if (standCode) {
        const item = stands.find(s => s.stand === standCode);
        if (item) {
          item.is_occupied = true;
          item.occupied_by = log.registration_number;
          item.aircraft_type = parsedNotes.aircraft_type || 'Pesawat';
          item.status = 'Terisi di Lapangan';
          item.source = 'operational_log';
          item.notes = `Sedang terparkir di lapangan (Reg: ${log.registration_number})`;
        }
      }
    }
  }

  // 2. Cek permohonan lain yang sudah disetujui / aktif pada tanggal yang sama
  const approvedApps = await prisma.rental_applications.findMany({
    where: {
      application_type: 'Mini Airport',
      status: { in: ['Aktif', 'Disetujui', 'Approved', 'Signed'] },
      ...(excludeApplicationId ? { id: { not: Number.parseInt(excludeApplicationId, 10) } } : {})
    }
  });

  for (const app of approvedApps) {
    let spec = app.specific_needs;
    if (typeof spec === 'string') {
      try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
    }

    const appAirportId = Number(spec?.airport_id || spec?.mini_airport_id);
    const appLandingDate = spec?.landing_date ? spec.landing_date.substring(0, 10) : null;
    const appStand = spec?.allocated_stand;

    if (appAirportId === airportId && appLandingDate === targetDateStr && appStand) {
      const item = stands.find(s => s.stand === appStand);
      if (item && !item.is_occupied) {
        item.is_occupied = true;
        item.occupied_by = spec.registration_number || 'Pesawat';
        item.aircraft_type = spec.aircraft_type || 'Pesawat Perintis';
        item.status = 'Terjadwal / Izin Terbit';
        item.source = 'rental_application';
        item.notes = `Izin pendaratan terbit untuk ${spec.registration_number || 'armada'}`;
      }
    }
  }

  return stands;
};

