const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Sample Parking Ticket Books & Handovers...');

  const timikaAirport = await prisma.airports.findUnique({ where: { kode_bandara: 'TIM' } });
  const sentaniAirport = await prisma.airports.findUnique({ where: { kode_bandara: 'DJJ' } });

  if (!timikaAirport || !sentaniAirport) {
    console.log('Airports not found, skipping parking seed.');
    return;
  }

  // Sample Ticket Books for Timika
  const booksData = [
    {
      airport_id: timikaAirport.id,
      kode_buku: 'B-TIM-R2-001',
      jenis_karcis: 'Roda 2',
      seri_awal: 1,
      seri_akhir: 100,
      nominal_per_lembar: 2000,
      status: 'STOK'
    },
    {
      airport_id: timikaAirport.id,
      kode_buku: 'B-TIM-R4-001',
      jenis_karcis: 'Roda 4',
      seri_awal: 1,
      seri_akhir: 100,
      nominal_per_lembar: 5000,
      status: 'STOK'
    },
    {
      airport_id: timikaAirport.id,
      kode_buku: 'B-TIM-VIP-001',
      jenis_karcis: 'VIP',
      seri_awal: 1,
      seri_akhir: 50,
      nominal_per_lembar: 10000,
      status: 'STOK'
    },
    // Sentani
    {
      airport_id: sentaniAirport.id,
      kode_buku: 'B-DJJ-R2-001',
      jenis_karcis: 'Roda 2',
      seri_awal: 1,
      seri_akhir: 100,
      nominal_per_lembar: 2000,
      status: 'STOK'
    },
    {
      airport_id: sentaniAirport.id,
      kode_buku: 'B-DJJ-R4-001',
      jenis_karcis: 'Roda 4',
      seri_awal: 1,
      seri_akhir: 100,
      nominal_per_lembar: 5000,
      status: 'STOK'
    }
  ];

  for (const b of booksData) {
    await prisma.parking_ticket_books.upsert({
      where: { kode_buku: b.kode_buku },
      update: {},
      create: b
    });
    console.log(`Buku karcis ${b.kode_buku} (${b.jenis_karcis}) ready.`);
  }

  console.log('Seeding parking done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
