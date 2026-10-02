const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('=== Seeding Pengguna & Profil Penyewa (Users & Tenants) ===');

  const defaultPassword = 'password123';
  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(defaultPassword, salt);

  // Bandara Utama (Mozes Kilangin) & Mini Airport (Ilaga, Enarotali, Bilogai)
  const timAirport = await prisma.airports.findUnique({ where: { kode_bandara: 'TIM' } });
  const ilagaAirport = await prisma.mini_airports.findUnique({ where: { kode_bandara: 'ILA' } });
  const enarotaliAirport = await prisma.mini_airports.findUnique({ where: { kode_bandara: 'EWI' } });
  const bilogaiAirport = await prisma.mini_airports.findUnique({ where: { kode_bandara: 'UGU' } });

  // 100% STANDAR LOWERCASE & SNAKE_CASE ROLES:
  // - superadmin
  // - admin (Mozes Kilangin)
  // - admin_mini_airport (Mini Airport)
  // - petugas (Mozes Kilangin)
  // - petugas_mini_airport (Mini Airport)
  // - dinas (Dinas Perhubungan)
  // - kepala dinas (Kepala Dinas)
  // - tenant (Mitra Maskapai)
  const usersData = [
    // 1. Super Admin
    {
      username: 'super_admin',
      role: 'superadmin',
      airport_id: null,
      mini_airport_id: null
    },
    {
      username: 'superadmin',
      role: 'superadmin',
      airport_id: null,
      mini_airport_id: null
    },

    // 2. Admin Mozes Kilangin
    {
      username: 'admin',
      role: 'admin',
      airport_id: timAirport?.id || null,
      mini_airport_id: null
    },
    {
      username: 'admin_timika',
      role: 'admin',
      airport_id: timAirport?.id || null,
      mini_airport_id: null
    },

    // 3. Admin Mini Airport (Ilaga, Enarotali, Bilogai)
    {
      username: 'admin_mini_airport',
      role: 'admin_mini_airport',
      airport_id: null,
      mini_airport_id: ilagaAirport?.id || null
    },
    {
      username: 'admin_ilaga',
      role: 'admin_mini_airport',
      airport_id: null,
      mini_airport_id: ilagaAirport?.id || null
    },
    {
      username: 'admin_enarotali',
      role: 'admin_mini_airport',
      airport_id: null,
      mini_airport_id: enarotaliAirport?.id || null
    },
    {
      username: 'admin_bilogai',
      role: 'admin_mini_airport',
      airport_id: null,
      mini_airport_id: bilogaiAirport?.id || null
    },

    // 4. Petugas Lapangan Mozes Kilangin
    {
      username: 'petugas',
      role: 'petugas',
      airport_id: timAirport?.id || null,
      mini_airport_id: null
    },
    {
      username: 'petugas_timika',
      role: 'petugas',
      airport_id: timAirport?.id || null,
      mini_airport_id: null
    },

    // 5. Petugas Lapangan Mini Airport (Ilaga, Enarotali, Bilogai)
    {
      username: 'petugas_mini_airport',
      role: 'petugas_mini_airport',
      airport_id: null,
      mini_airport_id: ilagaAirport?.id || null
    },
    {
      username: 'petugas_ilaga',
      role: 'petugas_mini_airport',
      airport_id: null,
      mini_airport_id: ilagaAirport?.id || null
    },
    {
      username: 'petugas_enarotali',
      role: 'petugas_mini_airport',
      airport_id: null,
      mini_airport_id: enarotaliAirport?.id || null
    },
    {
      username: 'petugas_bilogai',
      role: 'petugas_mini_airport',
      airport_id: null,
      mini_airport_id: bilogaiAirport?.id || null
    },

    // 6. Dinas Perhubungan (Global / Regulator Lintas Bandara & Mini Airport)
    {
      username: 'dinas',
      role: 'dinas',
      airport_id: null,
      mini_airport_id: null
    },
    {
      username: 'dinas_timika',
      role: 'dinas',
      airport_id: null,
      mini_airport_id: null
    },

    // 7. Kepala Dinas
    {
      username: 'kadis',
      role: 'kepala dinas',
      airport_id: null,
      mini_airport_id: null
    },
    {
      username: 'kepala_dinas',
      role: 'kepala dinas',
      airport_id: null,
      mini_airport_id: null
    },

    // 8. Tenant (Mitra Maskapai)
    {
      username: 'tenant_user',
      role: 'tenant',
      airport_id: null,
      mini_airport_id: null
    },
    {
      username: 'tenant_demo',
      role: 'tenant',
      airport_id: null,
      mini_airport_id: null
    }
  ];

  const createdUsers = {};
  for (const u of usersData) {
    const user = await prisma.users.upsert({
      where: { username: u.username },
      update: {
        role: u.role,
        airport_id: u.airport_id,
        mini_airport_id: u.mini_airport_id,
        password_hash
      },
      create: {
        username: u.username,
        password_hash,
        role: u.role,
        airport_id: u.airport_id,
        mini_airport_id: u.mini_airport_id
      }
    });
    createdUsers[u.username] = user;
    console.log(`✓ User seeded: ${u.username} (role: '${u.role}')`);
  }

  // Profil Tenant 1: PT. Demo Dirgantara
  const tenant1 = await prisma.tenants.upsert({
    where: { tenant_id_str: 'TENANT-DEMO-01' },
    update: { 
      user_id: createdUsers['tenant_demo'].id,
      status_verifikasi: 'Verified'
    },
    create: {
      user_id: createdUsers['tenant_demo'].id,
      tenant_id_str: 'TENANT-DEMO-01',
      nama_perusahaan: 'PT. Demo Dirgantara',
      jenis_tenant: 'Maskapai',
      nib: '1234567890123',
      npwp: '12.345.678.9-012.345',
      alamat: 'Jl. Airport No. 12, Timika, Papua Tengah',
      pic: 'Budi Santoso',
      nomor_telepon: '081234567890',
      email: 'demo@dirgantara.co.id',
      status_verifikasi: 'Verified',
      status_pembayaran: 'Current'
    }
  });

  // Profil Tenant 2: PT. Smart Aviation Perintis
  const tenant2 = await prisma.tenants.upsert({
    where: { tenant_id_str: 'TENANT-SMART-01' },
    update: { 
      user_id: createdUsers['tenant_user'].id,
      status_verifikasi: 'Verified'
    },
    create: {
      user_id: createdUsers['tenant_user'].id,
      tenant_id_str: 'TENANT-SMART-01',
      nama_perusahaan: 'PT. Smart Aviation Perintis',
      jenis_tenant: 'Maskapai',
      nib: '9876543210987',
      npwp: '98.765.432.1-098.765',
      alamat: 'Bandara Mozes Kilangin Hangar Area, Timika',
      pic: 'Capt. Hendra Wijaya',
      nomor_telepon: '081198765432',
      email: 'ops@smartaviation.co.id',
      status_verifikasi: 'Verified',
      status_pembayaran: 'Current'
    }
  });
  console.log(`✓ Tenant profiles seeded: '${tenant1.nama_perusahaan}' & '${tenant2.nama_perusahaan}'`);

  // Seed Armada Pesawat Siap Terbang untuk Tenant
  const c208Type = await prisma.aircraft_types.findUnique({ where: { jenis_pesawat: 'Cessna Caravan C208' } });
  const dhc6Type = await prisma.aircraft_types.findUnique({ where: { jenis_pesawat: 'DHC-6 Series' } });
  const as350Type = await prisma.aircraft_types.findUnique({ where: { jenis_pesawat: 'AS350 Series' } });

  const sampleAircrafts = [
    {
      registration_number: 'PK-SVA',
      operator: 'PT. Smart Aviation Perintis',
      aircraft_owner: 'PT. Smart Aviation Perintis',
      aircraft_type_id: c208Type?.id || null,
      tenant_id: tenant2.id,
      mtow: 3629,
      capacity: 12,
      status: 'Active'
    },
    {
      registration_number: 'PK-VVA',
      operator: 'PT. Smart Aviation Perintis',
      aircraft_owner: 'PT. Smart Aviation Perintis',
      aircraft_type_id: dhc6Type?.id || null,
      tenant_id: tenant2.id,
      mtow: 5670,
      capacity: 19,
      status: 'Active'
    },
    {
      registration_number: 'PK-DMO',
      operator: 'PT. Demo Dirgantara',
      aircraft_owner: 'PT. Demo Dirgantara',
      aircraft_type_id: c208Type?.id || null,
      tenant_id: tenant1.id,
      mtow: 3629,
      capacity: 12,
      status: 'Active'
    },
    {
      registration_number: 'PK-HLI',
      operator: 'PT. Demo Dirgantara',
      aircraft_owner: 'PT. Demo Dirgantara',
      aircraft_type_id: as350Type?.id || null,
      tenant_id: tenant1.id,
      mtow: 2250,
      capacity: 5,
      status: 'Active'
    }
  ];

  for (const ac of sampleAircrafts) {
    await prisma.aircrafts.upsert({
      where: { registration_number: ac.registration_number },
      update: {
        operator: ac.operator,
        tenant_id: ac.tenant_id,
        aircraft_type_id: ac.aircraft_type_id,
        capacity: ac.capacity,
        status: ac.status
      },
      create: ac
    });
    console.log(`✓ Aircraft ready: ${ac.registration_number} (${ac.capacity} Pax)`);
  }

  console.log('=== Seeding Users & Tenants Selesai dengan Sukses ===\n');
}

main()
  .catch((e) => {
    console.error('Error saat seeding users & tenants:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
