const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = 'admin';
  const password = 'password123';
  
  // Periksa apakah admin sudah ada
  const existingAdmin = await prisma.users.findUnique({
    where: { username }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminUser = await prisma.users.create({
      data: {
        username: username,
        password_hash: hashedPassword,
        role: 'Admin',
      },
    });
    console.log('Seeding berhasil: User Admin dibuat.', adminUser);
  } else {
    console.log('Seeding diabaikan: User Admin sudah ada.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
