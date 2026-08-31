const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Master Data (2 Airports, Admins, & Assets)...');

  // ==========================================
  // 1. SEED AIRPORTS
  // ==========================================
  const airportsData = [
    {
      kode_bandara: 'TIM',
      nama_bandara: 'Bandara Mozes Kilangin',
      lokasi: 'Timika, Papua Tengah',
      deskripsi: 'Bandar Udara Internasional Mozes Kilangin'
    },
    {
      kode_bandara: 'DJJ',
      nama_bandara: 'Bandara Sentani',
      lokasi: 'Jayapura, Papua',
      deskripsi: 'Bandar Udara Internasional Sentani'
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
    TIM: {},
    DJJ: {}
  };

  for (const airportCode of ['TIM', 'DJJ']) {
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
      username: 'admin_sentani',
      role: 'admin',
      airport_id: createdAirports['DJJ'].id
    }
  ];

  for (const u of usersData) {
    await prisma.users.upsert({
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
  }
  console.log('Users seeded (super_admin, admin_timika, admin_sentani).');

  // ==========================================
  // 4. SEED TARIFFS (Pesawat & Ruangan)
  // ==========================================
  const tariffsData = [
    // Rotary Wing (Helicopter)
    { kode_tarif: 'TRF-HGR-AS350', jenis_layanan: 'Sewa Hanggar', objek: 'AS350 Series', satuan: 'unit/malam', tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-BELL206', jenis_layanan: 'Sewa Hanggar', objek: 'Bell 206 - Bell 407 Series', satuan: 'unit/malam', tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-BELL412', jenis_layanan: 'Sewa Hanggar', objek: 'Bell 412 - Bell 212', satuan: 'unit/malam', tarif: 4500000 },
    { kode_tarif: 'TRF-HGR-KAMOV', jenis_layanan: 'Sewa Hanggar', objek: 'Kamov - MI', satuan: 'unit/malam', tarif: 6000000 },
    
    // Fixed Wing
    { kode_tarif: 'TRF-HGR-C208', jenis_layanan: 'Sewa Hanggar', objek: 'Cessna Caravan C208', satuan: 'unit/malam', tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-PAC750', jenis_layanan: 'Sewa Hanggar', objek: 'PAC 750 XL', satuan: 'unit/malam', tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-DHC6', jenis_layanan: 'Sewa Hanggar', objek: 'DHC-6 Series', satuan: 'unit/malam', tarif: 4500000 },
    { kode_tarif: 'TRF-HGR-ATR', jenis_layanan: 'Sewa Hanggar', objek: 'ATR Series', satuan: 'unit/malam', tarif: 6000000 },
    
    // Apron
    { kode_tarif: 'TRF-APRON-ALL', jenis_layanan: 'Sewa Apron', objek: 'Penggunaan Apron Area', satuan: 'unit/malam', tarif: 2000000 },

    // Office / Gudang (Di Dalam Terminal)
    { kode_tarif: 'TRF-RMG-IN-TB', jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Terbuka tanpa AC', satuan: 'm2/bulan', tarif: 31000 },
    { kode_tarif: 'TRF-RMG-IN-TT', jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Tertutup tanpa AC', satuan: 'm2/bulan', tarif: 48000 },
    { kode_tarif: 'TRF-RMG-IN-TBAC', jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Terbuka dengan AC', satuan: 'm2/bulan', tarif: 65000 },
    { kode_tarif: 'TRF-RMG-IN-TTAC', jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Tertutup dengan AC', satuan: 'm2/bulan', tarif: 72000 }
  ];

  const createdTariffs = {};
  for (const t of tariffsData) {
    const tariff = await prisma.master_tariffs.upsert({
      where: { kode_tarif: t.kode_tarif },
      update: {},
      create: { ...t, status: 'Active' }
    });
    createdTariffs[t.kode_tarif] = tariff;
  }

  // ==========================================
  // 5. SEED ASSETS (Hangars)
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
      luas: 2500,
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
    },
    // DJJ HANGARS
    {
      kode_aset: 'DJJ-HGR-01',
      jenis_aset: 'Hanggar',
      nama_aset: 'Hanggar Utama Sentani',
      airport_id: createdAirports['DJJ'].id,
      zone_id: createdZones['DJJ']['HNGR'].id,
      lokasi: 'Sektor Selatan',
      luas: 3000,
      satuan: 'm²',
      kapasitas: '2 Pesawat Wide Body / 4 Narrow Body',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: null,
      spesifikasi_detail: {
        tinggi_bangunan: '25 Meter',
        kapasitas_pesawat: '2 Wide Body atau 4 Narrow Body',
        jenis_pesawat: 'Boeing 767, Airbus A330, B737, A320',
        fasilitas_listrik: '50.000 VA (3 Phase)',
        fasilitas_air: 'PDAM',
        pintu_hanggar: 'Motorized Bi-fold Door',
        apron_connection: 'Akses Langsung Apron Cargo',
        workshop: 'Tersedia (Area Khusus Engine)',
        office: 'Tersedia (2 Lantai)',
        storage: 'Gudang Besar Berpendingin',
        toilet: '6 Toilet + Shower',
        fire_safety: 'Foam System, Hydrant, Sprinkler',
        fasilitas_lainnya: 'Ruang Briefing, Lounge'
      }
    },
    {
      kode_aset: 'DJJ-HGR-02',
      jenis_aset: 'Hanggar',
      nama_aset: 'Hanggar Helikopter Sentani',
      airport_id: createdAirports['DJJ'].id,
      zone_id: createdZones['DJJ']['HNGR'].id,
      lokasi: 'Heliport Area',
      luas: 800,
      satuan: 'm²',
      kapasitas: '3 Helikopter Medium',
      kondisi: 'Rusak Ringan',
      status: 'Maintenance',
      master_tariff_id: null,
      spesifikasi_detail: {
        tinggi_bangunan: '10 Meter',
        kapasitas_pesawat: '3 Helikopter',
        jenis_pesawat: 'Bell 412, AS350, MD500',
        fasilitas_listrik: '10.000 VA',
        fasilitas_air: 'Sumur Bor',
        pintu_hanggar: 'Manual Sliding Door',
        apron_connection: 'Akses Helipad',
        workshop: 'Mini Workshop',
        office: '1 Ruang',
        storage: 'Gudang Sparepart Heli',
        toilet: '1 Toilet',
        fire_safety: 'Fire Extinguisher',
        fasilitas_lainnya: 'Windsock Khusus'
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
