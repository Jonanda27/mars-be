const prisma = require('../config/db');

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

exports.createApplication = async (tenantId, payload) => {
  const appNumber = await generateApplicationNumber();
  
  return await prisma.rental_applications.create({
    data: {
      application_number: appNumber,
      tenant_id: parseInt(tenantId),
      asset_id: payload.asset_id ? parseInt(payload.asset_id) : null,
      purpose: payload.purpose,
      specific_needs: payload.specific_needs,
      start_date: payload.start_date ? new Date(payload.start_date) : null,
      end_date: payload.end_date ? new Date(payload.end_date) : null,
      status: 'Pending'
    },
    include: {
      assets: true
    }
  });
};

exports.getApplicationsByTenant = async (tenantId) => {
  return await prisma.rental_applications.findMany({
    where: { tenant_id: parseInt(tenantId) },
    include: {
      assets: true
    },
    orderBy: { id: 'desc' }
  });
};

exports.getAllApplications = async () => {
  return await prisma.rental_applications.findMany({
    include: {
      tenants: true,
      assets: true
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
  return app;
};

exports.updateApplicationStatus = async (id, status, assetIdOverride) => {
  const app = await this.getApplicationById(id);
  
  const updateData = { status };
  if (assetIdOverride) {
    updateData.asset_id = parseInt(assetIdOverride);
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

  // If approved, create a draft contract
  if (status === 'Approved' && !app.contracts) {
    const finalAssetId = updatedApp.asset_id;
    if (!finalAssetId) throw new Error('Asset ID must be assigned before approval');
    
    const asset = updatedApp.assets;
    const tenantName = updatedApp.tenants ? updatedApp.tenants.nama_perusahaan : '';
    const contractNumber = await generateContractNumber(asset.jenis_aset, tenantName);
    
    // Auto calculate total based on months (rough estimation for draft)
    let totalAmount = 0;
    
    // Determine base tariff. For now, try to get it from master_tariffs if linked.
    let tarifSatuan = 0;
    let periodePembayaran = 'Bulanan';
    
    if (asset.master_tariffs && asset.master_tariffs.tarif) {
      tarifSatuan = parseFloat(asset.master_tariffs.tarif);
    } else if (asset.jenis_aset === 'Hanggar' && updatedApp.specific_needs && updatedApp.specific_needs.jenis_pesawat) {
      // Find tariff by aircraft type
      const jenisPesawat = updatedApp.specific_needs.jenis_pesawat;
      const aircraftTariff = await prisma.master_tariffs.findFirst({
        where: {
          jenis_layanan: 'Sewa Hanggar',
          objek: {
            contains: jenisPesawat
          }
        }
      });
      if (aircraftTariff) {
        tarifSatuan = parseFloat(aircraftTariff.tarif);
        periodePembayaran = 'Harian'; // Sewa hanggar biasanya harian/per malam
      }
    }

    // Basic calculation (can be improved later when Admin reviews the Draft)
    if (updatedApp.start_date && updatedApp.end_date && tarifSatuan > 0) {
      const start = new Date(updatedApp.start_date);
      const end = new Date(updatedApp.end_date);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive of start day
      
      if (periodePembayaran === 'Harian') {
        totalAmount = tarifSatuan * diffDays;
      } else {
        const months = diffDays / 30; // approx for Bulanan
        totalAmount = tarifSatuan * months;
      }
    }

    await prisma.contracts.create({
      data: {
        contract_number: contractNumber,
        application_id: updatedApp.id,
        tenant_id: updatedApp.tenant_id,
        asset_id: finalAssetId,
        status: 'Draft',
        start_date: updatedApp.start_date,
        end_date: updatedApp.end_date,
        jenis_pemanfaatan: updatedApp.purpose,
        luas: asset.luas,
        tarif_satuan: tarifSatuan,
        periode_pembayaran: periodePembayaran,
        deposit_jaminan: 0,
        total_amount: totalAmount
      }
    });
    
    // Also change asset status to Reserved
    await prisma.assets.update({
      where: { id: finalAssetId },
      data: { status: 'Reserved' }
    });
  }

  return updatedApp;
};
