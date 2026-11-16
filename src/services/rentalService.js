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
  const appNumber = await generateApplicationNumber();
  
  let officialLetterUrl = null;
  if (file) {
    const rawPath = file.secure_url || file.path || '';
    officialLetterUrl = rawPath ? rawPath.replaceAll('\\', '/') : null;
  }

  let specificNeeds = null;
  if (payload.extend_from_contract_id) {
    specificNeeds = { extend_from_contract_id: Number.parseInt(payload.extend_from_contract_id, 10) };
  }

  return await prisma.rental_applications.create({
    data: {
      application_number: appNumber,
      tenant_id: Number.parseInt(tenantId, 10),
      asset_id: null, // intentionally null at step 1
      application_type: payload.application_type || null,
      official_letter_url: officialLetterUrl,
      purpose: payload.purpose,
      specific_needs: specificNeeds,
      status: 'Menunggu Verifikasi Kadis' // Step 1 status
    },
    include: {
      assets: true
    }
  });
};

const createPayungContractForApplication = async (app) => {
  const currentYear = new Date().getFullYear();
  const countThisYear = await prisma.contracts.count({
    where: {
      contract_type: 'Payung',
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
      contract_number: `PKS-PAYUNG/${currentYear}/${sequenceNumber.toString().padStart(3, '0')}`,
      contract_type: 'Payung',
      tenant_id: app.tenant_id,
      status: 'Menunggu TTD Tenant',
      start_date: startDate,
      end_date: endDate,
      jenis_pemanfaatan: 'Perjanjian Kerja Sama Induk (Kontrak Payung) Sewa Hanggar & Fasilitas',
      fasilitas: masterTariffs
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

  const isHanggar = Boolean(
    app.application_type?.toLowerCase().includes('hanggar') ||
    app.assets?.kategori?.toLowerCase().includes('hanggar')
  );

  // Hanya permohonan Hanggar yang menggunakan alur Kontrak Payung
  if (isHanggar) {
    const activePayung = await prisma.contracts.findFirst({
      where: {
        tenant_id: app.tenant_id,
        contract_type: 'Payung',
        status: { in: ['Aktif', 'Active'] }
      },
      orderBy: { created_at: 'desc' }
    });

    if (activePayung) {
      // Tenant sudah memiliki kontrak payung aktif: hubungkan contract_id dan bypass langsung ke 'Surat Disetujui'
      return await prisma.rental_applications.update({
        where: { id: appId },
        data: {
          status: 'Surat Disetujui',
          contract_id: activePayung.id
        },
        include: { tenants: true, contracts: contractInclude }
      });
    }

    // Tenant belum memiliki Kontrak Payung aktif: otomatis buat draf Kontrak Payung baru
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

  // Untuk Sewa Ruangan (dan layanan non-hanggar lainnya):
  // Status langsung menjadi 'Surat Disetujui' agar tenant memilih ruangan di tahap 3.
  // Draft Kontrak Sewa (Surat PKS) akan dibuat setelah detail aset ruangan divalidasi oleh Admin di tahap 4/5.
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

  // Update the rental application with new details
  const updatedApp = await prisma.rental_applications.update({
    where: { id: appId },
    data: {
      application_type: payload.application_type,
      asset_id: payload.asset_id ? Number.parseInt(payload.asset_id, 10) : null,
      specific_needs: payload.specific_needs,
      start_date: payload.start_date ? new Date(payload.start_date) : null,
      end_date: payload.end_date ? new Date(payload.end_date) : null,
      status: 'Menunggu Validasi Admin'
    },
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

exports.getAllApplications = async (airportId) => {
  let whereClause = {};
  if (airportId) {
    whereClause = {
      assets: {
        airport_id: Number.parseInt(airportId, 10)
      }
    };
  }

  return await prisma.rental_applications.findMany({
    where: whereClause,
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

exports.updateApplicationStatus = async (id, status, assetIdOverride) => {
  const app = await exports.getApplicationById(id);
  const updateData = { status };
  if (assetIdOverride) {
    updateData.asset_id = Number.parseInt(assetIdOverride, 10);
  }

  const isHangar = (app.application_type || '').toLowerCase().includes('hanggar') || 
                   (app.assets?.kategori || '').toLowerCase().includes('hanggar') || 
                   app.contracts?.contract_type === 'Payung';

  if (status === 'Aktif' && isHangar) {
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
    where: { status: 'Signed' }, // Only Signed applications can be checked in by Warden
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
      status: 'Signed'
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
