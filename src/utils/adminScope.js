/**
 * Utility untuk Manajemen Scope Multi-Admin Bandara Mozes Kilangin & Mini Airport
 * Mendukung pembagian hak akses:
 * - Admin Umum Mozes Kilangin (admin)
 * - Admin Sewa Hanggar (admin_hanggar)
 * - Admin Sewa Apron (admin_apron)
 * - Admin Sewa Ruangan (admin_ruangan)
 * - Admin Mini Airport (admin_mini_airport)
 * - Global (superadmin, dinas, kepala dinas)
 */

const ADMIN_SCOPES = {
  GLOBAL: 'GLOBAL',
  ALL_MOZES: 'ALL_MOZES',
  MINI: 'MINI',
  HANGGAR: 'HANGGAR',
  APRON: 'APRON',
  RUANGAN: 'RUANGAN'
};

/**
 * Menentukan Scope Admin berdasarkan profil / role user
 * @param {Object|string} user - Objek user atau string role
 * @returns {string} Salah satu dari ADMIN_SCOPES
 */
function getAdminScope(user) {
  const role = typeof user === 'string' ? user : (user?.role || '');
  const r = (role || '').trim().toLowerCase();

  if (['superadmin', 'super admin', 'kepala dinas', 'kadis', 'dinas'].includes(r)) {
    return ADMIN_SCOPES.GLOBAL;
  }
  if (r === 'admin_mini_airport' || r === 'adminminiairport' || (typeof user === 'object' && user?.mini_airport_id)) {
    return ADMIN_SCOPES.MINI;
  }
  if (r === 'admin_hanggar' || r === 'adminhanggar' || r === 'adminhangar') {
    return ADMIN_SCOPES.HANGGAR;
  }
  if (r === 'admin_apron' || r === 'adminapron') {
    return ADMIN_SCOPES.APRON;
  }
  if (r === 'admin_ruangan' || r === 'adminruangan') {
    return ADMIN_SCOPES.RUANGAN;
  }
  if (r === 'admin') {
    return ADMIN_SCOPES.ALL_MOZES;
  }

  return ADMIN_SCOPES.GLOBAL;
}

/**
 * Mengklasifikasikan kategori layanan dari Rental Application
 * @param {Object} app 
 * @returns {'MINI'|'HANGGAR'|'APRON'|'RUANGAN'}
 */
function classifyApplication(app) {
  if (!app) return 'RUANGAN';

  const appType = (app.application_type || '').toLowerCase();
  if (appType.includes('mini')) {
    return 'MINI';
  }

  const assetJenis = (app.assets?.jenis_aset || '').toLowerCase();
  const assetKategori = (app.assets?.kategori || '').toLowerCase();
  const assetNama = (app.assets?.nama_aset || '').toLowerCase();

  let specStr = '';
  if (app.specific_needs) {
    specStr = typeof app.specific_needs === 'string'
      ? app.specific_needs.toLowerCase()
      : JSON.stringify(app.specific_needs).toLowerCase();
  }

  // Cek HANGGAR
  const isHanggar = Boolean(
    appType.includes('hanggar') ||
    assetJenis.includes('hanggar') ||
    assetKategori.includes('hanggar') ||
    assetNama.includes('hanggar') ||
    specStr.includes('"hanggar"') ||
    specStr.includes('trf-hgr')
  );

  if (isHanggar) return 'HANGGAR';

  // Cek APRON
  const isApron = Boolean(
    appType.includes('apron') ||
    assetJenis.includes('apron') ||
    assetKategori.includes('apron') ||
    assetNama.includes('apron') ||
    specStr.includes('"apron"') ||
    specStr.includes('trf-apron')
  );

  if (isApron) return 'APRON';

  // Default untuk fasilitas non-aviasi Mozes
  return 'RUANGAN';
}

/**
 * Filter daftar Rental Applications sesuai hak akses user
 */
function filterApplicationsByScope(apps, user) {
  if (!Array.isArray(apps)) return [];
  const scope = getAdminScope(user);

  if (scope === ADMIN_SCOPES.GLOBAL) {
    return apps;
  }

  if (scope === ADMIN_SCOPES.MINI) {
    const targetMiniId = user?.mini_airport_id ? Number(user.mini_airport_id) : null;
    return apps.filter(app => {
      const isMini = (app.application_type || '').toLowerCase().includes('mini');
      if (!isMini) return false;
      if (!targetMiniId) return true;

      let spec = app.specific_needs;
      if (typeof spec === 'string') {
        try { spec = JSON.parse(spec); } catch (e) { spec = {}; }
      }
      const appMiniId = spec?.mini_airport_id || spec?.airport_id;
      return Number(appMiniId) === targetMiniId;
    });
  }

  // Semua admin Mozes Kilangin hanya melihat aplikasi non-mini
  const nonMiniApps = apps.filter(app => !(app.application_type || '').toLowerCase().includes('mini'));

  if (scope === ADMIN_SCOPES.ALL_MOZES) {
    return nonMiniApps;
  }

  if (scope === ADMIN_SCOPES.HANGGAR) {
    return nonMiniApps.filter(app => classifyApplication(app) === 'HANGGAR');
  }

  if (scope === ADMIN_SCOPES.APRON) {
    return nonMiniApps.filter(app => classifyApplication(app) === 'APRON');
  }

  if (scope === ADMIN_SCOPES.RUANGAN) {
    return nonMiniApps.filter(app => classifyApplication(app) === 'RUANGAN');
  }

  return nonMiniApps;
}

/**
 * Mengklasifikasikan jenis Kontrak PKS
 * @param {Object} contract 
 * @returns {'MINI'|'HANGGAR'|'APRON'|'RUANGAN'|'AVIATION_PAYUNG'}
 */
function classifyContract(contract) {
  if (!contract) return 'RUANGAN';

  const contractType = (contract.contract_type || '').toLowerCase();
  let fas = contract.fasilitas;
  if (typeof fas === 'string') {
    try { fas = JSON.parse(fas); } catch (e) { fas = {}; }
  }
  fas = fas || {};

  const isMini = contractType === 'pks payung mini airport' || Boolean(fas.mini_airport_id || fas.airport_code);
  if (isMini) return 'MINI';

  // Kontrak Payung Induk Mozes Kilangin (berlaku untuk armada sewa hanggar & apron)
  if (contractType === 'payung' || contract.contract_number?.includes('PKS-P/')) {
    return 'AVIATION_PAYUNG';
  }

  // Jika terhubung ke rental_applications
  if (contract.rental_applications) {
    const appScope = classifyApplication(contract.rental_applications);
    if (appScope === 'HANGGAR') return 'HANGGAR';
    if (appScope === 'APRON') return 'APRON';
  }

  const assetJenis = (contract.assets?.jenis_aset || '').toLowerCase();
  const assetNama = (contract.assets?.nama_aset || '').toLowerCase();
  const peruntukan = (contract.jenis_pemanfaatan || '').toLowerCase();

  if (assetJenis.includes('hanggar') || assetNama.includes('hanggar') || peruntukan.includes('hanggar') || contractType.includes('hanggar')) {
    return 'HANGGAR';
  }

  if (assetJenis.includes('apron') || assetNama.includes('apron') || peruntukan.includes('apron') || contractType.includes('apron')) {
    return 'APRON';
  }

  return 'RUANGAN';
}

/**
 * Filter daftar Contracts sesuai hak akses user
 */
function filterContractsByScope(contracts, user) {
  if (!Array.isArray(contracts)) return [];
  const scope = getAdminScope(user);

  if (scope === ADMIN_SCOPES.GLOBAL) {
    return contracts;
  }

  if (scope === ADMIN_SCOPES.MINI) {
    const targetMiniId = user?.mini_airport_id ? Number(user.mini_airport_id) : null;
    return contracts.filter(c => {
      if (classifyContract(c) !== 'MINI') return false;
      if (!targetMiniId) return true;
      let f = c.fasilitas;
      if (typeof f === 'string') {
        try { f = JSON.parse(f); } catch (e) { f = {}; }
      }
      return Number(f?.mini_airport_id) === targetMiniId;
    });
  }

  // Semua admin Mozes menyaring keluar kontrak Mini Airport
  const mozesContracts = contracts.filter(c => classifyContract(c) !== 'MINI');

  if (scope === ADMIN_SCOPES.ALL_MOZES) {
    return mozesContracts;
  }

  if (scope === ADMIN_SCOPES.HANGGAR) {
    return mozesContracts.filter(c => {
      const cls = classifyContract(c);
      return cls === 'HANGGAR' || cls === 'AVIATION_PAYUNG';
    });
  }

  if (scope === ADMIN_SCOPES.APRON) {
    return mozesContracts.filter(c => {
      const cls = classifyContract(c);
      return cls === 'APRON' || cls === 'AVIATION_PAYUNG';
    });
  }

  if (scope === ADMIN_SCOPES.RUANGAN) {
    return mozesContracts.filter(c => classifyContract(c) === 'RUANGAN');
  }

  return mozesContracts;
}

/**
 * Klasifikasi Invoice ke dalam Kategori Servis
 * Menggunakan kriteria detail item, log operasional, kontrak, dan tipe invoice
 */
function classifyInvoiceCategory(inv) {
  if (!inv) return 'RUANGAN';

  const invType = (inv.invoice_type || '').toLowerCase();
  if (invType === 'mini airport') {
    return 'MINI';
  }

  const isDenda = Boolean(
    inv.invoice_type === 'SKRD Denda' ||
    inv.invoice_number?.includes('DND') ||
    inv.details?.type === 'PENALTY_INVOICE'
  );

  const isRuangan = Boolean(
    inv.invoice_type === 'Sewa Ruangan' ||
    inv.contracts?.jenis_pemanfaatan?.toLowerCase().includes('ruang') ||
    inv.contracts?.assets?.jenis_aset?.toLowerCase().includes('ruang') ||
    inv.contracts?.contract_number?.includes('PKS-RG')
  );

  if (isRuangan) {
    return 'RUANGAN';
  }

  const invNum = (inv.invoice_number || '').toUpperCase();
  const assetJenis = (inv.contracts?.assets?.jenis_aset || '').toLowerCase();
  const assetNama = (inv.contracts?.assets?.nama_aset || '').toLowerCase();

  let hasApronLog = false;
  let hasHanggarLog = false;
  if (Array.isArray(inv.operational_logs) && inv.operational_logs.length > 0) {
    hasApronLog = inv.operational_logs.some(l => (l.parking_location || '').toLowerCase().includes('apron'));
    hasHanggarLog = inv.operational_logs.some(l => (l.parking_location || '').toLowerCase().includes('hanggar'));
  }

  let detailsHasApron = false;
  let detailsHasHanggar = false;
  if (inv.details) {
    if (Array.isArray(inv.details)) {
      for (const item of inv.details) {
        const itemStr = JSON.stringify(item).toLowerCase();
        if (itemStr.includes('trf-apron') || itemStr.includes('parkir apron') || item.parking_location === 'Apron' || (item.parking_location || '').toLowerCase().includes('apron')) {
          detailsHasApron = true;
        }
        if (itemStr.includes('trf-hgr') || itemStr.includes('hanggar') || (item.parking_location || '').toLowerCase().includes('hanggar')) {
          detailsHasHanggar = true;
        }
      }
    } else {
      const dStr = JSON.stringify(inv.details).toLowerCase();
      if (dStr.includes('trf-apron') || dStr.includes('parkir apron') || dStr.includes('"apron"')) {
        detailsHasApron = true;
      }
      if (dStr.includes('trf-hgr') || dStr.includes('"hanggar"')) {
        detailsHasHanggar = true;
      }
    }
  }

  const isApron = Boolean(
    invType.includes('apron') ||
    invNum.includes('APRN') ||
    invNum.includes('APN') ||
    assetJenis === 'apron' ||
    (assetNama.includes('apron') && !assetNama.includes('hanggar')) ||
    (hasApronLog && !hasHanggarLog) ||
    (detailsHasApron && !detailsHasHanggar)
  );

  if (isApron) {
    return isDenda ? 'DENDA_APRON' : 'APRON';
  }

  return isDenda ? 'DENDA_HANGGAR' : 'HANGGAR';
}

/**
 * Filter daftar Tagihan / e-SKRD sesuai hak akses user
 */
function filterInvoicesByScope(invoices, user) {
  if (!Array.isArray(invoices)) return [];
  const scope = getAdminScope(user);

  if (scope === ADMIN_SCOPES.GLOBAL) {
    return invoices;
  }

  if (scope === ADMIN_SCOPES.MINI) {
    const targetMiniId = user?.mini_airport_id ? Number(user.mini_airport_id) : null;
    return invoices.filter(inv => {
      const isMini = inv.invoice_type === 'Mini Airport';
      if (!isMini) return false;
      if (!targetMiniId) return true;
      const det = (inv.details && typeof inv.details === 'object') ? inv.details : {};
      const f = (inv.contracts?.fasilitas && typeof inv.contracts.fasilitas === 'object') ? inv.contracts.fasilitas : {};
      const mId = det.airport_id || det.mini_airport_id || f.mini_airport_id;
      return Number(mId) === targetMiniId;
    });
  }

  // Non-mini invoices untuk admin Mozes Kilangin
  const mozesInvoices = invoices.filter(inv => inv.invoice_type !== 'Mini Airport');

  if (scope === ADMIN_SCOPES.ALL_MOZES) {
    return mozesInvoices;
  }

  if (scope === ADMIN_SCOPES.HANGGAR) {
    return mozesInvoices.filter(inv => {
      const cat = classifyInvoiceCategory(inv);
      return cat === 'HANGGAR' || cat === 'DENDA_HANGGAR';
    });
  }

  if (scope === ADMIN_SCOPES.APRON) {
    return mozesInvoices.filter(inv => {
      const cat = classifyInvoiceCategory(inv);
      return cat === 'APRON' || cat === 'DENDA_APRON';
    });
  }

  if (scope === ADMIN_SCOPES.RUANGAN) {
    return mozesInvoices.filter(inv => {
      const cat = classifyInvoiceCategory(inv);
      return cat === 'RUANGAN';
    });
  }

  return mozesInvoices;
}

/**
 * Mengklasifikasikan aset fasilitas
 * @param {Object} asset 
 * @returns {'HANGGAR'|'APRON'|'RUANGAN'}
 */
function classifyAsset(asset) {
  if (!asset) return 'RUANGAN';
  const jenis = (asset.jenis_aset || '').toLowerCase();
  const nama = (asset.nama_aset || '').toLowerCase();

  if (jenis.includes('hanggar') || nama.includes('hanggar')) {
    return 'HANGGAR';
  }
  if (jenis.includes('apron') || nama.includes('apron')) {
    return 'APRON';
  }
  return 'RUANGAN';
}

/**
 * Filter daftar Aset & Fasilitas sesuai hak akses user
 */
function filterAssetsByScope(assets, user) {
  if (!Array.isArray(assets)) return [];
  const scope = getAdminScope(user);

  if (scope === ADMIN_SCOPES.GLOBAL || scope === ADMIN_SCOPES.ALL_MOZES) {
    return assets;
  }

  if (scope === ADMIN_SCOPES.HANGGAR) {
    return assets.filter(a => classifyAsset(a) === 'HANGGAR');
  }

  if (scope === ADMIN_SCOPES.APRON) {
    return assets.filter(a => classifyAsset(a) === 'APRON');
  }

  if (scope === ADMIN_SCOPES.RUANGAN) {
    return assets.filter(a => classifyAsset(a) === 'RUANGAN');
  }

  return assets;
}

/**
 * Mengklasifikasikan log pergerakan / parkir pesawat
 * @param {Object} log 
 * @returns {'HANGGAR'|'APRON'|'RUANGAN'}
 */
function classifyOperationalLog(log) {
  if (!log) return 'HANGGAR';
  const loc = (log.parking_location || '').toLowerCase();
  if (loc.includes('apron')) return 'APRON';
  if (loc.includes('hanggar')) return 'HANGGAR';

  if (log.assets) {
    const cls = classifyAsset(log.assets);
    return cls;
  }
  return 'HANGGAR';
}

/**
 * Filter log operasional lapangan sesuai hak akses user
 */
function filterOperationalLogsByScope(logs, user) {
  if (!Array.isArray(logs)) return [];
  const scope = getAdminScope(user);

  if (scope === ADMIN_SCOPES.GLOBAL || scope === ADMIN_SCOPES.ALL_MOZES) {
    return logs;
  }

  if (scope === ADMIN_SCOPES.HANGGAR) {
    return logs.filter(l => classifyOperationalLog(l) === 'HANGGAR');
  }

  if (scope === ADMIN_SCOPES.APRON) {
    return logs.filter(l => classifyOperationalLog(l) === 'APRON');
  }

  if (scope === ADMIN_SCOPES.RUANGAN) {
    // Ruangan tidak memiliki pergerakan parkir pesawat harian
    return [];
  }

  return logs;
}

module.exports = {
  ADMIN_SCOPES,
  getAdminScope,
  classifyApplication,
  filterApplicationsByScope,
  classifyContract,
  filterContractsByScope,
  classifyInvoiceCategory,
  filterInvoicesByScope,
  classifyAsset,
  filterAssetsByScope,
  classifyOperationalLog,
  filterOperationalLogsByScope
};
