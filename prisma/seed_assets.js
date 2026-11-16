const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Assets (1 Hanggar, 1 Apron, dan 8 Tipe Ruangan Berbeda)...');

  const timAirport = await prisma.airports.findUnique({ where: { kode_bandara: 'TIM' } });
  
  if (!timAirport) {
    console.log('Airport TIM not found, please run seed_airports_zones.js first.');
    return;
  }

  const zones = await prisma.zones.findMany({ where: { airport_id: timAirport.id } });
  const getZoneId = (suffix) => zones.find(z => z.kode_zona === `TIM-${suffix}`)?.id;

  const tariffs = await prisma.master_tariffs.findMany();
  const getTariffId = (kode) => tariffs.find(t => t.kode_tarif === kode)?.id;

  const assetsData = [
    // ==========================================
    // 1. HANGGAR (Hanya 1 Aset Hanggar)
    // ==========================================
    {
      kode_aset: 'TIM-HGR-01',
      jenis_aset: 'Hanggar',
      nama_aset: 'Hanggar Mozes Kilangin',
      airport_id: timAirport.id,
      zone_id: getZoneId('HNGR'),
      lokasi: 'Sisi Timur Apron',
      luas: 2700, // 50m x 54m = 2700 m²
      satuan: 'm²',
      kapasitas: '3 Pesawat Narrow Body',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: null,
      spesifikasi_detail: {
        tinggi_bangunan: '20 Meter',
        kapasitas_pesawat: '3 Pesawat Narrow Body (Boeing 737 / Airbus A320)',
        jenis_pesawat: 'Boeing 737, ATR 72, Twin Otter, Caravan, Helicopter',
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

    // ==========================================
    // 2. APRON (Hanya 1 Aset Apron)
    // ==========================================
    {
      kode_aset: 'TIM-APRN-01',
      jenis_aset: 'Apron',
      nama_aset: 'Apron Mozes Kilangin',
      airport_id: timAirport.id,
      zone_id: getZoneId('APRN'),
      lokasi: 'Airside Mozes Kilangin',
      luas: 5000,
      satuan: 'm²',
      kapasitas: '4 Parking Stand Pesawat',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: getTariffId('TRF-APRON-ALL') || null,
      spesifikasi_detail: {
        tipe_perkerasan: 'Rigid Pavement (PCN 70/R/C/W/T)',
        kapasitas_parking_stand: '4 Stand Pesawat',
        penerangan: 'Floodlight Apron LED',
        fasilitas_ground: 'Ground Power Unit (GPU) Area, Pushback Area',
        fire_safety: 'Akses Langsung PKP-PK',
        keamanan: 'Akses Terbatas Airside, CCTV 24 Jam'
      }
    },

    // ==========================================
    // 3. RUANGAN (8 Tipe Berbeda Masing-Masing 1)
    // ==========================================
    // 3.1. Di Dalam Terminal - Tertutup dengan AC
    {
      kode_aset: 'TIM-RMG-01',
      jenis_aset: 'Ruangan',
      nama_aset: 'Ruang Kantor Terminal',
      airport_id: timAirport.id,
      zone_id: getZoneId('TERM'),
      lokasi: 'Lantai 1, Terminal Penumpang',
      luas: 48,
      satuan: 'm²',
      kapasitas: '10-12 Orang',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: getTariffId('TRF-RMG-IN-TTAC') || null,
      spesifikasi_detail: {
        lokasi_zona: 'Di Dalam Terminal',
        tipe_ruangan: 'Tertutup',
        fasilitas_ac: true,
        fasilitas_listrik: '2.200 VA',
        fasilitas_air: 'PAM',
        toilet: '1 Toilet',
        furniture: 'Meja kerja, Kursi, Lemari arsip',
        koneksi_internet: 'Tersedia (LAN)',
        keamanan: 'CCTV Koridor, Kunci Elektronik',
        fasilitas_lainnya: 'Akses Parkir Terminal'
      }
    },

    // 3.2. Di Dalam Terminal - Tertutup tanpa AC
    {
      kode_aset: 'TIM-RMG-02',
      jenis_aset: 'Ruangan',
      nama_aset: 'Ruang Arsip & Logistik Terminal',
      airport_id: timAirport.id,
      zone_id: getZoneId('TERM'),
      lokasi: 'Lantai Dasar, Terminal Penumpang',
      luas: 30,
      satuan: 'm²',
      kapasitas: 'Penyimpanan Dokumen & Arsip',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: getTariffId('TRF-RMG-IN-TT') || null,
      spesifikasi_detail: {
        lokasi_zona: 'Di Dalam Terminal',
        tipe_ruangan: 'Tertutup',
        fasilitas_ac: false,
        fasilitas_listrik: '1.300 VA',
        fasilitas_air: '-',
        toilet: 'Toilet Umum Terminal',
        furniture: 'Rak arsip besi, Meja admin',
        koneksi_internet: 'Tersedia (LAN)',
        keamanan: 'Kunci Manual, Smoke Detector',
        fasilitas_lainnya: 'Ventilasi Exhaust Fan'
      }
    },

    // 3.3. Di Dalam Terminal - Terbuka dengan AC
    {
      kode_aset: 'TIM-RMG-03',
      jenis_aset: 'Ruangan',
      nama_aset: 'Counter Check-in & Customer Service',
      airport_id: timAirport.id,
      zone_id: getZoneId('TERM'),
      lokasi: 'Lantai 1, Area Check-in Terminal',
      luas: 24,
      satuan: 'm²',
      kapasitas: '4-6 Petugas',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: getTariffId('TRF-RMG-IN-TBAC') || null,
      spesifikasi_detail: {
        lokasi_zona: 'Di Dalam Terminal',
        tipe_ruangan: 'Terbuka',
        fasilitas_ac: true,
        fasilitas_listrik: '1.300 VA',
        fasilitas_air: '-',
        toilet: 'Toilet Umum Terminal',
        furniture: 'Counter built-in, Kursi petugas',
        koneksi_internet: 'Tersedia (WiFi & LAN)',
        keamanan: 'CCTV Area, Security Terminal',
        fasilitas_lainnya: 'Akses langsung ke area keberangkatan'
      }
    },

    // 3.4. Di Dalam Terminal - Terbuka tanpa AC
    {
      kode_aset: 'TIM-RMG-04',
      jenis_aset: 'Ruangan',
      nama_aset: 'Area Selasar Komersil Terminal',
      airport_id: timAirport.id,
      zone_id: getZoneId('TERM'),
      lokasi: 'Selasar Barat, Terminal Penumpang',
      luas: 20,
      satuan: 'm²',
      kapasitas: 'Booth / Stand Usaha',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: getTariffId('TRF-RMG-IN-TB') || null,
      spesifikasi_detail: {
        lokasi_zona: 'Di Dalam Terminal',
        tipe_ruangan: 'Terbuka',
        fasilitas_ac: false,
        fasilitas_listrik: '900 VA',
        fasilitas_air: '-',
        toilet: 'Toilet Umum Terminal',
        furniture: 'Space only',
        koneksi_internet: 'WiFi Terminal',
        keamanan: 'CCTV Koridor',
        fasilitas_lainnya: 'Lalu lintas penumpang tinggi'
      }
    },

    // 3.5. Di Luar Terminal - Tertutup dengan AC
    {
      kode_aset: 'TIM-RMG-05',
      jenis_aset: 'Ruangan',
      nama_aset: 'Kantor Operasional Ground Handling',
      airport_id: timAirport.id,
      zone_id: getZoneId('SUPP'),
      lokasi: 'Gedung Pendukung, Sisi Airside',
      luas: 64,
      satuan: 'm²',
      kapasitas: '8-10 Orang',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: getTariffId('TRF-RMG-OUT-TTAC') || null,
      spesifikasi_detail: {
        lokasi_zona: 'Di Luar Terminal',
        tipe_ruangan: 'Tertutup',
        fasilitas_ac: true,
        fasilitas_listrik: '3.500 VA',
        fasilitas_air: 'PAM',
        toilet: '2 Toilet',
        furniture: 'Meja kerja, Kursi, Loker, Papan informasi',
        koneksi_internet: 'Tersedia (LAN & WiFi)',
        keamanan: 'CCTV, Akses Badge',
        fasilitas_lainnya: 'Akses langsung ke Apron'
      }
    },

    // 3.6. Di Luar Terminal - Tertutup tanpa AC
    {
      kode_aset: 'TIM-RMG-06',
      jenis_aset: 'Ruangan',
      nama_aset: 'Ruang Gudang Kargo Luar Terminal',
      airport_id: timAirport.id,
      zone_id: getZoneId('COMM'),
      lokasi: 'Area Kargo, Sisi Selatan Terminal',
      luas: 120,
      satuan: 'm²',
      kapasitas: 'Penyimpanan Kargo',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: getTariffId('TRF-RMG-OUT-TT') || null,
      spesifikasi_detail: {
        lokasi_zona: 'Di Luar Terminal',
        tipe_ruangan: 'Tertutup',
        fasilitas_ac: false,
        fasilitas_listrik: '4.400 VA',
        fasilitas_air: '-',
        toilet: '1 Toilet',
        furniture: 'Rak penyimpanan industrial',
        koneksi_internet: '-',
        keamanan: 'CCTV, Security 24 Jam',
        fasilitas_lainnya: 'Loading dock, Akses kendaraan berat'
      }
    },

    // 3.7. Di Luar Terminal - Terbuka dengan AC
    {
      kode_aset: 'TIM-RMG-07',
      jenis_aset: 'Ruangan',
      nama_aset: 'Shelter Pengawas Lapangan',
      airport_id: timAirport.id,
      zone_id: getZoneId('SUPP'),
      lokasi: 'Sisi Timur Apron, Area Luar Terminal',
      luas: 25,
      satuan: 'm²',
      kapasitas: '3-4 Petugas',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: getTariffId('TRF-RMG-OUT-TBAC') || null,
      spesifikasi_detail: {
        lokasi_zona: 'Di Luar Terminal',
        tipe_ruangan: 'Terbuka',
        fasilitas_ac: true,
        fasilitas_listrik: '2.200 VA',
        fasilitas_air: '-',
        toilet: 'Toilet Portabel Terdekat',
        furniture: 'Meja pantau, Kursi petugas, AC Standing Portable',
        koneksi_internet: 'WiFi Airside',
        keamanan: 'CCTV Area Apron',
        fasilitas_lainnya: 'Pandangan langsung ke apron & taxiway'
      }
    },

    // 3.8. Di Luar Terminal - Terbuka tanpa AC
    {
      kode_aset: 'TIM-RMG-08',
      jenis_aset: 'Ruangan',
      nama_aset: 'Kios Komersil Luar Terminal',
      airport_id: timAirport.id,
      zone_id: getZoneId('COMM'),
      lokasi: 'Area Komersil Luar Terminal',
      luas: 18,
      satuan: 'm²',
      kapasitas: '2-3 Orang',
      kondisi: 'Baik',
      status: 'Available',
      master_tariff_id: getTariffId('TRF-RMG-OUT-TB') || null,
      spesifikasi_detail: {
        lokasi_zona: 'Di Luar Terminal',
        tipe_ruangan: 'Terbuka',
        fasilitas_ac: false,
        fasilitas_listrik: '900 VA',
        fasilitas_air: '-',
        toilet: 'Toilet Umum Area Luar Terminal',
        furniture: 'Meja display, Kursi',
        koneksi_internet: '-',
        keamanan: 'CCTV Area Komersil',
        fasilitas_lainnya: 'Akses langsung pedestrian'
      }
    }
  ];

  for (const asset of assetsData) {
    await prisma.assets.upsert({
      where: { kode_aset: asset.kode_aset },
      update: asset,
      create: asset
    });
    console.log(`Asset ensured: ${asset.kode_aset} - ${asset.nama_aset} (${asset.jenis_aset})`);
  }

  console.log('Seeding Assets finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
