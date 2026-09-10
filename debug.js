const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const apps = await prisma.rental_applications.findMany({
    orderBy: { id: 'desc' },
    take: 1,
    include: { assets: true, contracts: true }
  });
  const app = apps[0];
  console.log('App:', app.id, app.application_number);
  console.log('Contract amount:', app.contracts[0]?.total_amount);
  
  const specificNeeds = typeof app.specific_needs === 'string' ? JSON.parse(app.specific_needs) : app.specific_needs;
  console.log('Specific Needs:', JSON.stringify(specificNeeds, null, 2));
  
  if (specificNeeds && specificNeeds.aircraft_ids) {
    for (const id of specificNeeds.aircraft_ids) {
      const ac = await prisma.aircrafts.findUnique({ where: { id: parseInt(id) } });
      console.log('Aircraft:', ac?.id, 'Type ID:', ac?.aircraft_type_id);
      
      if (ac && ac.aircraft_type_id) {
        const mt = await prisma.master_tariffs.findFirst({ where: { aircraft_type_id: parseInt(ac.aircraft_type_id) } });
        console.log('Master Tariff:', mt?.id, 'Tarif:', mt?.tarif);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
