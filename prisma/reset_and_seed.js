const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { execSync } = require('node:child_process');
const path = require('node:path');

async function main() {
  console.log('=== 1. MENGHAPUS SEMUA ISI DATABASE (RESET DATA) ===');

  const tables = [
    'notifications',
    'otps',
    'parking_warden_handovers',
    'parking_ticket_books',
    'daily_overnight_items',
    'daily_overnight_reports',
    'operational_logs',
    'warnings',
    'invoices',
    'flight_schedules',
    'rental_applications',
    'contracts',
    'aircrafts',
    'assets',
    'master_taxes',
    'master_tariffs',
    'aircraft_types',
    'tenants',
    'zones',
    'users',
    'airports',
    'mini_airports'
  ];

  try {
    const truncateQuery = `TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
    await prisma.$executeRawUnsafe(truncateQuery);
    console.log('--> Semua tabel berhasil dikosongkan dan autoincrement sequence di-reset ke 1.\n');
  } catch (err) {
    console.error('Error saat truncate tables:', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }

  console.log('=== 2. MENJALANKAN ULANG SEEDER MARS ===');
  const seedScript = path.join(__dirname, 'seed.js');
  execSync(`node "${seedScript}"`, { stdio: 'inherit' });

  console.log('\n=== RESET DAN RE-SEED SELESAI DENGAN SUKSES ===');
}

main().catch((e) => {
  console.error('Proses reset dan seed gagal:', e);
  process.exit(1);
});
