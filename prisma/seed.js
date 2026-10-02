const { execSync } = require('node:child_process');
const path = require('node:path');

async function main() {
  console.log('=== Memulai Proses Seeding Database MARS ===\n');

  const scripts = [
    'seed_airports_zones.js',
    'seed_mini_airports.js',
    'seed_aircraft_tariffs.js',
    'seed_users_tenants.js',
    'seed_assets.js',
    'seed_taxes.js',
    'seed_parking.js'
  ];

  for (const script of scripts) {
    const scriptPath = path.join(__dirname, script);
    console.log(`--> Menjalankan ${script}...`);
    execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    console.log(`--> ${script} selesai.\n`);
  }

  console.log('=== Semua Seeder Berhasil Dijalankan Secara Konsisten! ===');
}

main().catch((e) => {
  console.error('Terjadi error saat seeding:', e);
  process.exit(1);
});
