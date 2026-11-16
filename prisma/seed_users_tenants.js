const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Users & Tenants...');

  // ==========================================
  // 3. SEED USERS (Admins & Super Admin)
  // ==========================================
  const defaultPassword = 'password123';
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(defaultPassword, salt);

  const timAirport = await prisma.airports.findUnique({ where: { kode_bandara: 'TIM' } });

  const usersData = [
    {
      username: 'super_admin',
      role: 'superadmin',
      airport_id: null // Super admin controls all
    },
    {
      username: 'admin_timika',
      role: 'admin',
      airport_id: timAirport?.id || null
    },
    {
      username: 'kepala_dinas',
      role: 'kepala dinas',
      airport_id: null
    },
    {
      username: 'petugas_timika',
      role: 'petugas lapangan',
      airport_id: timAirport?.id || null
    },
    {
      username: 'dinas_timika',
      role: 'dinas',
      airport_id: timAirport?.id || null
    },
    {
      username: 'tenant_demo',
      role: 'tenant',
      airport_id: null
    }
  ];

  const createdUsers = {};
  for (const u of usersData) {
    const user = await prisma.users.upsert({
      where: { username: u.username },
      update: { 
        airport_id: u.airport_id,
        role: u.role
      },
      create: {
        username: u.username,
        password_hash,
        role: u.role,
        airport_id: u.airport_id
      }
    });
    createdUsers[u.username] = user;
  }
  console.log('Users seeded (super_admin, admin_timika, kepala_dinas, petugas_timika, tenant_demo).');

  // ==========================================
  // 3.5 SEED TENANT DATA FOR TENANT DEMO
  // ==========================================
  await prisma.tenants.upsert({
    where: { tenant_id_str: 'TENANT-DEMO-01' },
    update: { user_id: createdUsers['tenant_demo'].id },
    create: {
      user_id: createdUsers['tenant_demo'].id,
      tenant_id_str: 'TENANT-DEMO-01',
      nama_perusahaan: 'PT. Demo Dirgantara',
      jenis_tenant: 'Maskapai',
      nib: '1234567890123',
      npwp: '12.345.678.9-012.345',
      alamat: 'Jl. Merdeka No 1, Jakarta',
      pic: 'Budi Santoso',
      nomor_telepon: '081234567890'
    }
  });
  console.log('Tenant profile seeded for tenant_demo.');

  console.log('Seeding Users & Tenants finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
