const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateGIS() {
  const assets = await prisma.assets.findMany();
  
  // Base coordinates for Mozes Kilangin
  const baseLat = -4.529;
  const baseLng = 136.886;

  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const latOffset = (Math.random() - 0.5) * 0.005;
    const lngOffset = (Math.random() - 0.5) * 0.005;
    
    const gis = `${(baseLat + latOffset).toFixed(6)},${(baseLng + lngOffset).toFixed(6)}`;
    
    await prisma.assets.update({
      where: { id: a.id },
      data: { koordinat_gis: gis }
    });
    console.log(`Updated ${a.nama_aset} with GIS: ${gis}`);
  }
  
  console.log('Done updating GIS coordinates.');
  await prisma.$disconnect();
}

updateGIS().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
