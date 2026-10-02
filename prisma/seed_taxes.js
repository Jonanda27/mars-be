const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Master Taxes (Pajak & Retribusi Pelayanan Bandara)...');

  // Cari aircraft types untuk referensi opsional
  const aircraftTypes = await prisma.aircraft_types.findMany();
  const typeMap = {};
  for (const t of aircraftTypes) {
    typeMap[t.jenis_pesawat] = t.id;
  }

  const taxesToSeed = [
    // ==========================================
    // 1. TAX SAAT PESAWAT MENDARAT (LANDING TAX)
    // ==========================================
    {
      kode_tax: 'TAX-LND-HELI',
      nama_tax: 'Tax Pendaratan Helikopter (Landing Tax - Rotary Wing)',
      kategori: 'Pendaratan',
      satuan: 'per pendaratan',
      tarif: 500000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perbup No. 25 Tahun 2024 tentang Retribusi Jasa Kebandarudaraan Lampiran II',
      deskripsi: 'Retribusi pelayanan jasa pendaratan armada helikopter (semua tipe rotary wing)',
      aircraft_type_id: typeMap['AS350 Series'] || null,
      status: 'Active'
    },
    {
      kode_tax: 'TAX-LND-LIGHT',
      nama_tax: 'Tax Pendaratan Pesawat Ringan / Cessna C208 & PAC 750',
      kategori: 'Pendaratan',
      satuan: 'per pendaratan',
      tarif: 750000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perbup No. 25 Tahun 2024 tentang Retribusi Jasa Kebandarudaraan Lampiran II',
      deskripsi: 'Retribusi pelayanan pendaratan pesawat udara kategori Fixed Wing Ringan (MTOW < 5.700 kg)',
      aircraft_type_id: typeMap['Cessna Caravan C208'] || null,
      status: 'Active'
    },
    {
      kode_tax: 'TAX-LND-MEDIUM',
      nama_tax: 'Tax Pendaratan Pesawat Sedang / DHC-6 Twin Otter',
      kategori: 'Pendaratan',
      satuan: 'per pendaratan',
      tarif: 1500000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perbup No. 25 Tahun 2024 tentang Retribusi Jasa Kebandarudaraan Lampiran II',
      deskripsi: 'Retribusi pelayanan pendaratan pesawat udara kategori Fixed Wing Sedang (MTOW 5.700 - 15.000 kg)',
      aircraft_type_id: typeMap['DHC-6 Series'] || null,
      status: 'Active'
    },
    {
      kode_tax: 'TAX-LND-HEAVY',
      nama_tax: 'Tax Pendaratan Pesawat Komersial / ATR Series',
      kategori: 'Pendaratan',
      satuan: 'per pendaratan',
      tarif: 2500000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perbup No. 25 Tahun 2024 tentang Retribusi Jasa Kebandarudaraan Lampiran II',
      deskripsi: 'Retribusi pelayanan pendaratan pesawat udara kategori Fixed Wing Komersial / Regional (MTOW > 15.000 kg)',
      aircraft_type_id: typeMap['ATR Series'] || null,
      status: 'Active'
    },

    // ==========================================
    // 2. TAX PENUMPANG (PASSENGER TAX / PJP2U)
    // ==========================================
    {
      kode_tax: 'TAX-PAX-DOM',
      nama_tax: 'Tax Pelayanan Jasa Penumpang Pesawat Udara (PJP2U Domestik)',
      kategori: 'Penumpang',
      satuan: 'per orang',
      tarif: 65000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'PM Perhubungan No. 36 Tahun 2020 & Perbup No. 25 Tahun 2024',
      deskripsi: 'Tax pelayanan fasilitas ruang tunggu keberangkatan, boarding gate, dan x-ray security check penumpang domestik',
      status: 'Active'
    },
    {
      kode_tax: 'TAX-PAX-VIP',
      nama_tax: 'Tax Pelayanan Penumpang Ruang VIP / Executive Lounge',
      kategori: 'Penumpang',
      satuan: 'per orang',
      tarif: 150000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perbup No. 25 Tahun 2024 tentang Retribusi Pelayanan Kebandarudaraan',
      deskripsi: 'Tax pelayanan fasilitas ruang tunggu khusus VIP Lounge & executive escort bandara',
      status: 'Active'
    },

    // ==========================================
    // 3. TAX PARKIR (PARKING TAX / PENEMPATAN APRON)
    // ==========================================
    {
      kode_tax: 'TAX-PRK-DAY',
      nama_tax: 'Tax Parkir Pesawat Pelataran Apron (Daytime Parking)',
      kategori: 'Parkir',
      satuan: 'per 2 jam pertama',
      tarif: 250000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Tarif Penempatan Pesawat',
      deskripsi: 'Retribusi penempatan pesawat udara di pelataran apron pada jam operasional siang hari (durasi 2 jam)',
      status: 'Active'
    },
    {
      kode_tax: 'TAX-PRK-EXTRA',
      nama_tax: 'Tax Tambahan Jam Parkir Apron (Excess Parking Hour)',
      kategori: 'Parkir',
      satuan: 'per jam',
      tarif: 100000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Tarif Penempatan Pesawat',
      deskripsi: 'Retribusi jam tambahan parkir apron melebihi batas standar 2 jam pertama',
      status: 'Active'
    },

    // ==========================================
    // 4. TAX NGINAP (OVERNIGHT TAX / RON)
    // ==========================================
    {
      kode_tax: 'TAX-NGN-HELI',
      nama_tax: 'Tax Nginap Helikopter (Overnight Tax - Rotary Wing)',
      kategori: 'Nginap',
      satuan: 'per pesawat per malam',
      tarif: 1000000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Pasal 14 Ayat 2 tentang Penempatan Menginap',
      deskripsi: 'Retribusi penempatan pesawat menginap (Remain Over Night / RON) untuk armada helikopter',
      aircraft_type_id: typeMap['Bell 412 - Bell 212'] || null,
      status: 'Active'
    },
    {
      kode_tax: 'TAX-NGN-FIX-S',
      nama_tax: 'Tax Nginap Pesawat Ringan (Overnight Tax - Small Aircraft)',
      kategori: 'Nginap',
      satuan: 'per pesawat per malam',
      tarif: 1250000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Pasal 14 Ayat 2 tentang Penempatan Menginap',
      deskripsi: 'Retribusi penempatan menginap (RON) untuk pesawat fixed wing kecil (C208, PAC750)',
      aircraft_type_id: typeMap['Cessna Caravan C208'] || null,
      status: 'Active'
    },
    {
      kode_tax: 'TAX-NGN-FIX-L',
      nama_tax: 'Tax Nginap Pesawat Sedang/Besar (Overnight Tax - Medium/Heavy)',
      kategori: 'Nginap',
      satuan: 'per pesawat per malam',
      tarif: 2000000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Pasal 14 Ayat 2 tentang Penempatan Menginap',
      deskripsi: 'Retribusi penempatan menginap (RON) untuk pesawat tipe DHC-6 & ATR Series',
      aircraft_type_id: typeMap['ATR Series'] || null,
      status: 'Active'
    },

    // ==========================================
    // 5. TAX AIRPORT (AIRPORT TAX / JASA KEBANDARUDARAAN)
    // ==========================================
    {
      kode_tax: 'TAX-APT-SRV',
      nama_tax: 'Tax Pelayanan Jasa Kebandarudaraan (Airport Service Tax)',
      kategori: 'Airport',
      satuan: 'per penerbangan',
      tarif: 350000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'Perda No. 25 Tahun 2024 tentang Retribusi Pelayanan Jasa Kebandarudaraan Perintis Papua Tengah',
      deskripsi: 'Pelayanan navigasi visual darat, marshaling, follow me car, dan fasilitas pendukung bandara',
      status: 'Active'
    },
    {
      kode_tax: 'TAX-APT-SEC',
      nama_tax: 'Tax Keamanan & Keselamatan Bandara (Aviation Security Tax)',
      kategori: 'Airport',
      satuan: 'per penerbangan',
      tarif: 150000,
      tipe_tarif: 'Fixed',
      dasar_hukum: 'PM Perhubungan No. 51 Tahun 2020 & Perbup No. 25 Tahun 2024',
      deskripsi: 'Tax layanan keamanan penerbangan (Avsec), PKP-PK (Pemadam Kebakaran Bandara), dan pengamanan perimeter',
      status: 'Active'
    }
  ];

  for (const tax of taxesToSeed) {
    const upserted = await prisma.master_taxes.upsert({
      where: { kode_tax: tax.kode_tax },
      update: {
        nama_tax: tax.nama_tax,
        kategori: tax.kategori,
        satuan: tax.satuan,
        tarif: tax.tarif,
        tipe_tarif: tax.tipe_tarif,
        dasar_hukum: tax.dasar_hukum,
        deskripsi: tax.deskripsi,
        aircraft_type_id: tax.aircraft_type_id,
        status: tax.status
      },
      create: tax
    });

    console.log(`[Master Tax] ${upserted.kode_tax} - ${upserted.nama_tax} (${upserted.kategori}) => Rp ${Number(upserted.tarif).toLocaleString('id-ID')}`);
  }

  console.log(`\nSelesai seeding ${taxesToSeed.length} Master Taxes successfully!`);
}

main()
  .catch((e) => {
    console.error('Error seeding master taxes:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
