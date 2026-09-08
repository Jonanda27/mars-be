const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Master Data (1 Airport, Admins, & Assets)...');

  // ==========================================
  // 1. SEED AIRPORTS
  // ==========================================
  const airportsData = [
    {
      kode_bandara: 'TIM',
      nama_bandara: 'Bandara Mozes Kilangin',
      lokasi: 'Timika, Papua Tengah',
      deskripsi: 'Bandar Udara Internasional Mozes Kilangin'
    }
  ];

  const createdAirports = {};
  for (const ap of airportsData) {
    const airport = await prisma.airports.upsert({
      where: { kode_bandara: ap.kode_bandara },
      update: {},
      create: ap
    });
    createdAirports[ap.kode_bandara] = airport;
    console.log(`Airport ensured: ${airport.nama_bandara}`);
  }

  // ==========================================
  // 2. SEED ZONES (For Both Airports)
  // ==========================================
  const zoneTypes = [
    { kode_suffix: 'TERM', nama_zona: 'Terminal', tipe_zona: 'Terminal' },
    { kode_suffix: 'APRN', nama_zona: 'Apron', tipe_zona: 'Apron' },
    { kode_suffix: 'HNGR', nama_zona: 'Hanggar Area', tipe_zona: 'Hanggar Area' },
    { kode_suffix: 'COMM', nama_zona: 'Commercial Area', tipe_zona: 'Commercial Area' },
    { kode_suffix: 'PARK', nama_zona: 'Parking Area', tipe_zona: 'Parking Area' },
    { kode_suffix: 'OFFC', nama_zona: 'Office Area', tipe_zona: 'Office Area' },
    { kode_suffix: 'SUPP', nama_zona: 'Supporting Facilities', tipe_zona: 'Supporting Facilities' }
  ];

  const createdZones = {
    TIM: {}
  };

  for (const airportCode of ['TIM']) {
    for (const zt of zoneTypes) {
      const kode_zona = `${airportCode}-${zt.kode_suffix}`;
      const zone = await prisma.zones.upsert({
        where: { kode_zona },
        update: { airport_id: createdAirports[airportCode].id },
        create: {
          kode_zona,
          nama_zona: `${zt.nama_zona} ${airportCode}`,
          tipe_zona: zt.tipe_zona,
          airport_id: createdAirports[airportCode].id
        }
      });
      createdZones[airportCode][zt.kode_suffix] = zone;
    }
    console.log(`Zones seeded for ${airportCode}.`);
  }

  // ==========================================
  // 3. SEED USERS (Admins & Super Admin)
  // ==========================================
  const defaultPassword = 'password123';
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(defaultPassword, salt);

  const usersData = [
    {
      username: 'super_admin',
      role: 'superadmin',
      airport_id: null // Super admin controls all
    },
    {
      username: 'admin_timika',
      role: 'admin',
      airport_id: createdAirports['TIM'].id
    },
    {
      username: 'kepala_dinas',
      role: 'kepala dinas',
      airport_id: null
    },
    {
      username: 'petugas_timika',
      role: 'petugas lapangan',
      airport_id: createdAirports['TIM'].id
    },
    {
      username: 'tenant_demo',
      role: 'tenant',
      airport_id: null
    }
  ];

  const createdUsers = {};
  for (const u of usersData) {
    const user = await prisma.users.upsert({
      where: { username: u.username },
      update: { 
        airport_id: u.airport_id,
        role: u.role
      },
      create: {
        username: u.username,
        password_hash,
        role: u.role,
        airport_id: u.airport_id
      }
    });
    createdUsers[u.username] = user;
  }
  console.log('Users seeded (super_admin, admin_timika, kepala_dinas, petugas_timika, tenant_demo).');

  // ==========================================
  // 3.5 SEED TENANT DATA FOR TENANT DEMO
  // ==========================================
  await prisma.tenants.upsert({
    where: { tenant_id_str: 'TENANT-DEMO-01' },
    update: { user_id: createdUsers['tenant_demo'].id },
    create: {
      user_id: createdUsers['tenant_demo'].id,
      tenant_id_str: 'TENANT-DEMO-01',
      nama_perusahaan: 'PT. Demo Dirgantara',
      jenis_tenant: 'Maskapai',
      nib: '1234567890123',
      npwp: '12.345.678.9-012.345',
      alamat: 'Jl. Merdeka No 1, Jakarta',
      pic: 'Budi Santoso',
      nomor_telepon: '081234567890'
    }
  });
  console.log('Tenant profile seeded for tenant_demo.');

  // ==========================================
  // 4 & 5. SEED AIRCRAFT TYPES + TARIFFS (Linked via FK)
  // Best practice: seed aircraft_types first, then tariffs referencing them.
  // ==========================================
  const hanggarTarifData = [
    // Rotary Wing (Helicopter)
    { kode_tarif: 'TRF-HGR-AS350',   jenis_pesawat: 'AS350 Series',             luas_efektif_m2: 150, tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-BELL206', jenis_pesawat: 'Bell 206 - Bell 407 Series',luas_efektif_m2: 150, tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-BELL412', jenis_pesawat: 'Bell 412 - Bell 212',       luas_efektif_m2: 250, tarif: 4500000 },
    { kode_tarif: 'TRF-HGR-KAMOV',   jenis_pesawat: 'Kamov - MI',                luas_efektif_m2: 550, tarif: 6000000 },
    // Fixed Wing
    { kode_tarif: 'TRF-HGR-C208',    jenis_pesawat: 'Cessna Caravan C208',       luas_efektif_m2: 200, tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-PAC750',  jenis_pesawat: 'PAC 750 XL',               luas_efektif_m2: 160, tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-DHC6',    jenis_pesawat: 'DHC-6 Series',             luas_efektif_m2: 350, tarif: 4500000 },
    { kode_tarif: 'TRF-HGR-ATR',     jenis_pesawat: 'ATR Series',               luas_efektif_m2: 800, tarif: 6000000 },
  ];

  const createdTariffs = {};

  for (const row of hanggarTarifData) {
    // Step 1: Upsert aircraft_type (Single Source of Truth untuk spesifikasi fisik)
    const aircraftType = await prisma.aircraft_types.upsert({
      where: { jenis_pesawat: row.jenis_pesawat },
      update: { luas_efektif_m2: row.luas_efektif_m2 },
      create: { jenis_pesawat: row.jenis_pesawat, luas_efektif_m2: row.luas_efektif_m2 }
    });
    console.log(`Aircraft Type ensured: ${row.jenis_pesawat}`);

    // Step 2: Upsert master_tariff, langsung link ke aircraft_type_id
    const tariff = await prisma.master_tariffs.upsert({
      where: { kode_tarif: row.kode_tarif },
      update: { aircraft_type_id: aircraftType.id },
      create: {
        kode_tarif:       row.kode_tarif,
        jenis_layanan:    'Sewa Hanggar',
        objek:            row.jenis_pesawat, // Tetap disimpan sebagai label invoice
        aircraft_type_id: aircraftType.id,  // FK relasional
        satuan:           'unit/malam',
        tarif:            row.tarif,
        status:           'Active'
      }
    });
    createdTariffs[row.kode_tarif] = tariff;
    console.log(`Tariff linked: ${row.kode_tarif} → aircraft_type_id ${aircraftType.id}`);
  }

  // Tarif non-pesawat (Apron & Ruangan) — tidak perlu aircraft_type_id
  const nonAircraftTariffs = [
    { kode_tarif: 'TRF-APRON-ALL',    jenis_layanan: 'Sewa Apron',   objek: 'Penggunaan Apron Area',             satuan: 'unit/malam', tarif: 2000000 },
    { kode_tarif: 'TRF-RMG-IN-TB',    jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Terbuka tanpa AC',       satuan: 'm2/bulan',   tarif: 31000 },
    { kode_tarif: 'TRF-RMG-IN-TT',    jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Tertutup tanpa AC',      satuan: 'm2/bulan',   tarif: 48000 },
    { kode_tarif: 'TRF-RMG-IN-TBAC',  jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Terbuka dengan AC',     satuan: 'm2/bulan',   tarif: 65000 },
    { kode_tarif: 'TRF-RMG-IN-TTAC',  jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Tertutup dengan AC',    satuan: 'm2/bulan',   tarif: 72000 },
  ];

  for (const t of nonAircraftTariffs) {
    await prisma.master_tariffs.upsert({
      where: { kode_tarif: t.kode_tarif },
      update: {},
      create: { ...t, status: 'Active' }
    });
  }
  console.log('Non-aircraft tariffs seeded (Apron, Ruangan).');

  // ==========================================
  // 6. SEED ASSETS (Hangars)
  // ==========================================
  const assetsData = [
    // TIM HANGARS
    {
      kode_aset: 'TIM-HGR-01',
      jenis_aset: 'Hanggar',
      nama_aset: 'Hanggar A - Mozes Kilangin',
      airport_id: createdAirports['TIM'].id,
      zone_id: createdZones['TIM']['HNGR'].id,
      lokasi: 'Sisi Timur Apron',
      luas: 2700, // 50m x 54m = 2700 m²
      satuan: 'm²',
      kapasitas: '3 Pesawat Narrow Body',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: null, // Tarif hanggar ditentukan dari jenis pesawat, bukan flat
      spesifikasi_detail: {
        tinggi_bangunan: '20 Meter',
        kapasitas_pesawat: '3 Pesawat Narrow Body (Boeing 737 / Airbus A320)',
        jenis_pesawat: 'Boeing 737, ATR 72, Twin Otter',
        fasilitas_listrik: '30.000 VA (3 Phase)',
        fasilitas_air: 'PAM & Sumur Bor',
        pintu_hanggar: 'Motorized Sliding Door (Lebar 45m)',
        apron_connection: 'Akses Langsung ke Taxiway Alpha',
        workshop: 'Tersedia (2 Ruang)',
        office: 'Tersedia (1 Ruang Manager, 1 Staff)',
        storage: 'Gudang Suku Cadang',
        toilet: '4 Toilet',
        fire_safety: 'Hydrant, Fire Extinguisher, Smoke Detector',
        fasilitas_lainnya: 'CCTV 24 Jam'
      }
    },
    {
      kode_aset: 'TIM-HGR-02',
      jenis_aset: 'Hanggar',
      nama_aset: 'Hanggar B (Perintis) - Mozes Kilangin',
      airport_id: createdAirports['TIM'].id,
      zone_id: createdZones['TIM']['HNGR'].id,
      lokasi: 'Sisi Barat Apron',
      luas: 1200,
      satuan: 'm²',
      kapasitas: '4 Pesawat Perintis',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: null,
      spesifikasi_detail: {
        tinggi_bangunan: '12 Meter',
        kapasitas_pesawat: '4 Pesawat Perintis (Grand Caravan / Twin Otter)',
        jenis_pesawat: 'Cessna Grand Caravan, Twin Otter, Pilatus',
        fasilitas_listrik: '15.000 VA',
        fasilitas_air: 'Sumur Bor',
        pintu_hanggar: 'Manual Sliding Door',
        apron_connection: 'Akses Taxiway Bravo',
        workshop: 'Tersedia (1 Ruang)',
        office: 'Tersedia (1 Ruang)',
        storage: 'Gudang Kecil',
        toilet: '2 Toilet',
        fire_safety: 'Fire Extinguisher, Smoke Detector',
        fasilitas_lainnya: '-'
      }
    }
  ];

  for (const asset of assetsData) {
    await prisma.assets.upsert({
      where: { kode_aset: asset.kode_aset },
      update: asset,
      create: asset
    });
    console.log(`Asset ensured: ${asset.kode_aset} - ${asset.nama_aset}`);
  }

  console.log('Seeding Master Data finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
