const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Master Tariffs...');

  const tariffsToSeed = [
    {
      kode_tarif: 'TRF-HGR-C208',
      jenis_layanan: 'Sewa Hanggar',
      objek: 'Cessna Caravan C208',
      satuan: 'unit pesawat per malam',
      tarif: 3500000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 18'
    },
    {
      kode_tarif: 'TRF-HGR-PAC750',
      jenis_layanan: 'Sewa Hanggar',
      objek: 'PAC 750 XL',
      satuan: 'unit pesawat per malam',
      tarif: 3500000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 18'
    },
    {
      kode_tarif: 'TRF-HGR-DHC6',
      jenis_layanan: 'Sewa Hanggar',
      objek: 'DHC-6 Series',
      satuan: 'unit pesawat per malam',
      tarif: 4500000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 18'
    },
    {
      kode_tarif: 'TRF-HGR-ATR',
      jenis_layanan: 'Sewa Hanggar',
      objek: 'ATR Series',
      satuan: 'unit pesawat per malam',
      tarif: 6000000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 18'
    },
    {
      kode_tarif: 'TRF-HGR-AS350',
      jenis_layanan: 'Sewa Hanggar',
      objek: 'Helicopter AS350 Series',
      satuan: 'unit pesawat per malam',
      tarif: 3500000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 18'
    },
    {
      kode_tarif: 'TRF-HGR-BELL407',
      jenis_layanan: 'Sewa Hanggar',
      objek: 'Helicopter Bell 206 - Bell 407 Series',
      satuan: 'unit pesawat per malam',
      tarif: 3500000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 18'
    },
    {
      kode_tarif: 'TRF-HGR-BELL412',
      jenis_layanan: 'Sewa Hanggar',
      objek: 'Helicopter Bell 412 - Bell 212',
      satuan: 'unit pesawat per malam',
      tarif: 4500000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 18'
    },
    {
      kode_tarif: 'TRF-HGR-KAMOV',
      jenis_layanan: 'Sewa Hanggar',
      objek: 'Helicopter Kamov - MI',
      satuan: 'unit pesawat per malam',
      tarif: 6000000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 18'
    },
    {
      kode_tarif: 'TRF-RNG-IN-TA',
      jenis_layanan: 'Penggunaan Ruangan',
      objek: 'Di Dalam Terminal - Terbuka tanpa AC',
      satuan: 'm2 per bulan',
      tarif: 31000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 19'
    },
    {
      kode_tarif: 'TRF-RNG-IN-TA-AC',
      jenis_layanan: 'Penggunaan Ruangan',
      objek: 'Di Dalam Terminal - Tertutup tanpa AC',
      satuan: 'm2 per bulan',
      tarif: 48000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 19'
    },
    {
      kode_tarif: 'TRF-RNG-IN-B-AC',
      jenis_layanan: 'Penggunaan Ruangan',
      objek: 'Di Dalam Terminal - Terbuka dengan AC',
      satuan: 'm2 per bulan',
      tarif: 65000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 19'
    },
    {
      kode_tarif: 'TRF-RNG-IN-T-AC',
      jenis_layanan: 'Penggunaan Ruangan',
      objek: 'Di Dalam Terminal - Tertutup dengan AC',
      satuan: 'm2 per bulan',
      tarif: 72000,
      dasar_hukum: 'Perbup No. 25 Tahun 2024 Lampiran Halaman 19'
    }
  ];

  for (const tariff of tariffsToSeed) {
    const exists = await prisma.master_tariffs.findUnique({
      where: { kode_tarif: tariff.kode_tarif }
    });

    if (!exists) {
      await prisma.master_tariffs.create({ data: tariff });
      console.log(`Created tariff: ${tariff.kode_tarif}`);
    } else {
      console.log(`Tariff ${tariff.kode_tarif} already exists.`);
    }
  }

  console.log('Seeding Master Tariffs finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
