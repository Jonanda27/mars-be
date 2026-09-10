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
    const lastNum = parseInt(parts[parts.length - 1], 10);
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

// Map asset type to document code
const getDocumentCode = (jenisAset) => {
  const map = {
    'Hanggar': 'SKH',     // Surat Kontrak Hanggar
    'Kantor': 'SKK',      // Surat Kontrak Kantor
    'Office': 'SKK',
    'Apron': 'SKA',       // Surat Kontrak Apron
    'Gudang': 'SKG',      // Surat Kontrak Gudang
    'Kargo': 'SKG',
    'Lahan': 'SKL',       // Surat Kontrak Lahan
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
    // When using Cloudinary, file.path contains the direct URL.
    // Replace backslashes just in case it's a local fallback.
    officialLetterUrl = file.path.replace(/\\/g, '/');
  }

  return await prisma.rental_applications.create({
    data: {
      application_number: appNumber,
      tenant_id: parseInt(tenantId),
      asset_id: null, // intentionally null at step 1
      application_type: payload.application_type || null,
      official_letter_url: officialLetterUrl,
      purpose: payload.purpose,
      status: 'Menunggu Verifikasi Kadis' // Step 1 status
    },
    include: {
      assets: true
    }
  });
};

exports.verifyLetter = async (id, status) => {
  return await prisma.rental_applications.update({
    where: { id: parseInt(id) },
    data: {
      status: status // 'Surat Disetujui' or 'Ditolak'
    }
  });
};

exports.completeDetails = async (id, payload) => {
  return await prisma.rental_applications.update({
    where: { id: parseInt(id) },
    data: {
      application_type: payload.application_type,
      asset_id: payload.asset_id ? parseInt(payload.asset_id) : null,
      specific_needs: payload.specific_needs,
      start_date: payload.start_date ? new Date(payload.start_date) : null,
      end_date: payload.end_date ? new Date(payload.end_date) : null,
      status: 'Menunggu Validasi Admin'
    }
  });
};

exports.approveAndDraftContract = async (id, user) => {
  const application = await prisma.rental_applications.findUnique({
    where: { id: parseInt(id) },
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
  
  // Calculate values based on application dates and master tariffs
  let totalAmount = 0;
  let tarifSatuan = 0;
  
  if (application.start_date && application.end_date) {
    const diffTime = Math.abs(new Date(application.end_date).getTime() - new Date(application.start_date).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const months = Math.max(1, Math.ceil(diffDays / 30));
    
    const isHanggar = asset.jenis_aset?.toLowerCase().includes('hanggar');
    
    if (isHanggar && application.specific_needs) {
      // Calculate per aircraft per night for Hanggar
      let totalTarifPerMalam = 0;
      const specificNeeds = typeof application.specific_needs === 'string' 
        ? JSON.parse(application.specific_needs) 
        : application.specific_needs;
        
      if (Array.isArray(specificNeeds.aircraft_details)) {
        for (const detail of specificNeeds.aircraft_details) {
          if (detail.aircraft_type_id) {
            const masterTariff = await prisma.master_tariffs.findFirst({
              where: { aircraft_type_id: parseInt(detail.aircraft_type_id) }
            });
            if (masterTariff) {
              totalTarifPerMalam += Number(masterTariff.tarif);
            }
          }
        }
      } else if (Array.isArray(specificNeeds.aircraft_ids)) {
        for (const acId of specificNeeds.aircraft_ids) {
          const aircraft = await prisma.aircrafts.findUnique({
            where: { id: parseInt(acId) }
          });
          if (aircraft && aircraft.aircraft_type_id) {
            const masterTariff = await prisma.master_tariffs.findFirst({
              where: { aircraft_type_id: parseInt(aircraft.aircraft_type_id) }
            });
            if (masterTariff) {
              totalTarifPerMalam += Number(masterTariff.tarif);
            }
          }
        }
      }
      totalAmount = diffDays * totalTarifPerMalam;
      tarifSatuan = totalTarifPerMalam; // Total per malam
    } else if (asset.master_tariff_id) {
      // Calculate per month for other assets
      const masterTariff = await prisma.master_tariffs.findUnique({
        where: { id: parseInt(asset.master_tariff_id) }
      });
      if (masterTariff) {
        tarifSatuan = Number(masterTariff.tarif);
        totalAmount = months * tarifSatuan;
      }
    }
  }

  // Start transaction to update application and create draft contract
  return await prisma.$transaction(async (tx) => {
    // 1. Create Draft Contract
    const draftContract = await tx.contracts.create({
      data: {
        contract_number: contractNum,
        contract_type: application.application_type && application.application_type.includes('Perpanjangan') ? 'Perpanjangan' : 'Sewa Baru',
        tenant_id: tenant.id,
        asset_id: asset.id,
        status: 'Draft',
        start_date: application.start_date,
        end_date: application.end_date,
        jenis_pemanfaatan: application.purpose,
        luas: asset.luas,
        tarif_satuan: tarifSatuan,
        periode_pembayaran: 'Bulanan', // Default
        total_amount: totalAmount,
      }
    });

    // 2. Update Application Status & link contract
    const updatedApp = await tx.rental_applications.update({
      where: { id: parseInt(id) },
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

    return updatedApp;
  });
};

exports.getApplicationsByTenant = async (tenantId) => {
  return await prisma.rental_applications.findMany({
    where: { tenant_id: parseInt(tenantId) },
    include: {
      assets: true,
      contracts: true
    },
    orderBy: { id: 'desc' }
  });
};

exports.getAllApplications = async (airportId) => {
  let whereClause = {};
  if (airportId) {
    whereClause = {
      assets: {
        airport_id: parseInt(airportId)
      }
    };
  }

  return await prisma.rental_applications.findMany({
    where: whereClause,
    include: {
      tenants: true,
      assets: true,
      contracts: true
    },
    orderBy: { id: 'desc' }
  });
};

exports.getApplicationById = async (id) => {
  const app = await prisma.rental_applications.findUnique({
    where: { id: parseInt(id) },
    include: {
      tenants: true,
      assets: true,
      contracts: true
    }
  });
  if (!app) throw new Error('Application not found');
  
  if (app.specific_needs && Array.isArray(app.specific_needs.aircraft_ids) && app.specific_needs.aircraft_ids.length > 0) {
    const aircraftIds = app.specific_needs.aircraft_ids.map(aid => parseInt(aid));
    const aircrafts = await prisma.aircrafts.findMany({
      where: { id: { in: aircraftIds } },
      include: { aircraft_types: true }
    });
    
    app.specific_needs.aircraft_details = aircrafts;
  }
  
  return app;
};

exports.updateApplicationStatus = async (id, status, assetIdOverride) => {
  const app = await exports.getApplicationById(id);
  
  if (status === 'Approved') {
    const finalAssetId = assetIdOverride ? parseInt(assetIdOverride) : app.asset_id;
    if (!finalAssetId) throw new Error('Asset ID must be assigned before approval');
    
    const asset = await prisma.assets.findUnique({ where: { id: finalAssetId } });
    
    // Validasi Kapasitas Hanggar berdasarkan Luas Efektif Pesawat
    if (asset.jenis_aset === 'Hanggar') {
      let requestedArea = 0;
      if (app.specific_needs && Array.isArray(app.specific_needs.aircraft_ids)) {
        for (const acId of app.specific_needs.aircraft_ids) {
          const aircraft = await prisma.aircrafts.findUnique({
            where: { id: parseInt(acId) },
            include: { aircraft_types: true }
          });
          if (aircraft && aircraft.aircraft_types) {
            requestedArea += parseFloat(aircraft.aircraft_types.luas_efektif_m2 || 0);
          }
        }
      }

      // Gunakan service kalkulator kapasitas terpusat
      const capacity = await assetService.getHangarCapacity(finalAssetId);

      if (requestedArea > capacity.remainingArea) {
        throw new Error(`Kapasitas Hanggar tidak mencukupi. Sisa ruang: ${capacity.remainingArea} m2, Dibutuhkan: ${requestedArea} m2.`);
      }
    }
  }

  const updateData = { status };
  if (assetIdOverride) {
    updateData.asset_id = parseInt(assetIdOverride);
  }

  // Find active umbrella contract for the tenant
  let activeContractId = null;
  if (status === 'Approved') {
    const activeContract = await prisma.contracts.findFirst({
      where: {
        tenant_id: app.tenant_id,
        contract_type: 'Payung',
        status: { in: ['Active', 'Approved'] }
      },
      orderBy: { created_at: 'desc' }
    });
    
    // Create new Kontrak Sewa for this application
    const currentYear = new Date().getFullYear();
    const contractCountThisYear = await prisma.contracts.count({
      where: { created_at: { gte: new Date(`${currentYear}-01-01T00:00:00.000Z`) } }
    });
    const sequenceNumber = contractCountThisYear + 1;
    
    const newContract = await prisma.contracts.create({
      data: {
        contract_number: `PKS-SEWA/${currentYear}/${sequenceNumber.toString().padStart(3, '0')}`,
        contract_type: 'Sewa',
        tenant_id: app.tenant_id,
        status: 'Menunggu TTD Tenant',
        start_date: app.start_date,
        end_date: app.end_date,
        jenis_pemanfaatan: 'Kontrak Sewa',
        asset_id: finalAssetId
      }
    });

    if (activeContract) {
      activeContractId = activeContract.id;
    }
    updateData.contract_id = newContract.id;
  }

  const updatedApp = await prisma.rental_applications.update({
    where: { id: parseInt(id) },
    data: updateData,
    include: {
      assets: {
        include: {
          master_tariffs: true
        }
      },
      tenants: true
    }
  });

  // Since it's a booking under an umbrella contract, we NO LONGER create a new PKS document.
  return updatedApp;
};

exports.getApprovedApplications = async () => {
  return await prisma.rental_applications.findMany({
    where: { status: 'Signed' }, // Only Signed applications can be checked in by Warden
    include: {
      tenants: true,
      assets: true,
      contracts: true
    },
    orderBy: { created_at: 'desc' }
  });
};

exports.updateSignature = async (id, filePath) => {
  return await prisma.rental_applications.update({
    where: { id: parseInt(id) },
    data: { 
      signed_document_url: filePath,
      status: 'Signed'
    }
  });
};
