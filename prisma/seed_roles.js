const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedUser(username, password, role) {
  const existingUser = await prisma.users.findUnique({
    where: { username }
  });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        username: username,
        password_hash: hashedPassword,
        role: role,
      },
    });
    console.log(`Seeding berhasil: User ${username} (${role}) dibuat.`);
  } else {
    console.log(`Seeding diabaikan: User ${username} sudah ada.`);
  }
}

async function main() {
  await seedUser('kepaladinas', 'password123', 'Kepala Dinas');
  await seedUser('petugas', 'password123', 'Petugas Lapangan');
  await seedUser('admin', 'password123', 'Admin');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
