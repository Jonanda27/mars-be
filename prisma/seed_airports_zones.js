const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Airports & Zones...');

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

  for (const airportCode of ['TIM']) {
    for (const zt of zoneTypes) {
      const kode_zona = `${airportCode}-${zt.kode_suffix}`;
      await prisma.zones.upsert({
        where: { kode_zona },
        update: { airport_id: createdAirports[airportCode].id },
        create: {
          kode_zona,
          nama_zona: `${zt.nama_zona} ${airportCode}`,
          tipe_zona: zt.tipe_zona,
          airport_id: createdAirports[airportCode].id
        }
      });
    }
    console.log(`Zones seeded for ${airportCode}.`);
  }

  console.log('Seeding Airports & Zones finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
