const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Mini Airports...');

  const miniAirportsData = [
    {
      kode_bandara: 'ILA',
      nama_bandara: 'Mini Airport Aminggaru (Ilaga)',
      lokasi: 'Distrik Ilaga, Kabupaten Puncak, Papua Tengah',
      deskripsi: 'Bandar udara perintis yang melayani penerbangan perintis dan logistik di pedalaman Kabupaten Puncak.'
    },
    {
      kode_bandara: 'EWI',
      nama_bandara: 'Mini Airport Enarotali',
      lokasi: 'Distrik Paniai Timur, Kabupaten Paniai, Papua Tengah',
      deskripsi: 'Lapangan terbang perintis penghubung transportasi udara pegunungan tengah Papua.'
    },
    {
      kode_bandara: 'UGU',
      nama_bandara: 'Mini Airport Bilogai (Sugapa)',
      lokasi: 'Distrik Sugapa, Kabupaten Intan Jaya, Papua Tengah',
      deskripsi: 'Airstrip perintis di lembah pegunungan Sugapa untuk melayani akses mobilitas masyarakat pedalaman.'
    }
  ];

  for (const item of miniAirportsData) {
    const miniAirport = await prisma.mini_airports.upsert({
      where: { kode_bandara: item.kode_bandara },
      update: {
        nama_bandara: item.nama_bandara,
        lokasi: item.lokasi,
        deskripsi: item.deskripsi
      },
      create: item
    });
    console.log(`Mini Airport ensured: [${miniAirport.kode_bandara}] ${miniAirport.nama_bandara}`);
  }

  console.log('Seeding Mini Airports finished successfully.\n');
}

main()
  .catch((e) => {
    console.error('Error seeding Mini Airports:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
