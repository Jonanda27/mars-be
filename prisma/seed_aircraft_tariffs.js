const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Aircraft Types & Tariffs...');
  // ==========================================
  // 4 & 5. SEED AIRCRAFT TYPES + TARIFFS (Linked via FK)
  // Best practice: seed aircraft_types first, then tariffs referencing them.
  // ==========================================
  const hanggarTarifData = [
    // Rotary Wing (Helicopter)
    { kode_tarif: 'TRF-HGR-AS350',   jenis_pesawat: 'AS350 Series',             luas_efektif_m2: 150, tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-BELL206', jenis_pesawat: 'Bell 206 - Bell 407 Series',luas_efektif_m2: 150, tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-BELL412', jenis_pesawat: 'Bell 412 - Bell 212',       luas_efektif_m2: 250, tarif: 4500000 },
    { kode_tarif: 'TRF-HGR-KAMOV',   jenis_pesawat: 'Kamov - MI',                luas_efektif_m2: 550, tarif: 6000000 },
    // Fixed Wing
    { kode_tarif: 'TRF-HGR-C208',    jenis_pesawat: 'Cessna Caravan C208',       luas_efektif_m2: 200, tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-PAC750',  jenis_pesawat: 'PAC 750 XL',               luas_efektif_m2: 160, tarif: 3500000 },
    { kode_tarif: 'TRF-HGR-DHC6',    jenis_pesawat: 'DHC-6 Series',             luas_efektif_m2: 350, tarif: 4500000 },
    { kode_tarif: 'TRF-HGR-ATR',     jenis_pesawat: 'ATR Series',               luas_efektif_m2: 800, tarif: 6000000 },
  ];

  for (const row of hanggarTarifData) {
    // Step 1: Upsert aircraft_type (Single Source of Truth untuk spesifikasi fisik)
    const aircraftType = await prisma.aircraft_types.upsert({
      where: { jenis_pesawat: row.jenis_pesawat },
      update: { luas_efektif_m2: row.luas_efektif_m2 },
      create: { jenis_pesawat: row.jenis_pesawat, luas_efektif_m2: row.luas_efektif_m2 }
    });
    console.log(`Aircraft Type ensured: ${row.jenis_pesawat}`);

    // Step 2: Upsert master_tariff, langsung link ke aircraft_type_id
    await prisma.master_tariffs.upsert({
      where: { kode_tarif: row.kode_tarif },
      update: { aircraft_type_id: aircraftType.id },
      create: {
        kode_tarif:       row.kode_tarif,
        jenis_layanan:    'Sewa Hanggar',
        objek:            row.jenis_pesawat, // Tetap disimpan sebagai label invoice
        aircraft_type_id: aircraftType.id,  // FK relasional
        satuan:           'unit/malam',
        tarif:            row.tarif,
        status:           'Active'
      }
    });
    console.log(`Tariff linked: ${row.kode_tarif} → aircraft_type_id ${aircraftType.id}`);
  }

  // Tarif non-pesawat (Apron & Ruangan) — tidak perlu aircraft_type_id
  const nonAircraftTariffs = [
    { kode_tarif: 'TRF-APRON-ALL',    jenis_layanan: 'Sewa Apron',   objek: 'Penggunaan Apron Area',             satuan: 'unit/malam', tarif: 2000000 },
    // Di Dalam Terminal
    { kode_tarif: 'TRF-RMG-IN-TB',    jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Terbuka tanpa AC',       satuan: 'm2/bulan',   tarif: 31000 },
    { kode_tarif: 'TRF-RMG-IN-TT',    jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Tertutup tanpa AC',      satuan: 'm2/bulan',   tarif: 48000 },
    { kode_tarif: 'TRF-RMG-IN-TBAC',  jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Terbuka dengan AC',     satuan: 'm2/bulan',   tarif: 65000 },
    { kode_tarif: 'TRF-RMG-IN-TTAC',  jenis_layanan: 'Sewa Ruangan', objek: 'Terminal - Tertutup dengan AC',    satuan: 'm2/bulan',   tarif: 72000 },
    // Di Luar Terminal
    { kode_tarif: 'TRF-RMG-OUT-TB',   jenis_layanan: 'Sewa Ruangan', objek: 'Luar Terminal - Terbuka tanpa AC',    satuan: 'm2/bulan',   tarif: 21000 },
    { kode_tarif: 'TRF-RMG-OUT-TT',   jenis_layanan: 'Sewa Ruangan', objek: 'Luar Terminal - Tertutup tanpa AC',   satuan: 'm2/bulan',   tarif: 38000 },
    { kode_tarif: 'TRF-RMG-OUT-TBAC', jenis_layanan: 'Sewa Ruangan', objek: 'Luar Terminal - Terbuka dengan AC',  satuan: 'm2/bulan',   tarif: 55000 },
    { kode_tarif: 'TRF-RMG-OUT-TTAC', jenis_layanan: 'Sewa Ruangan', objek: 'Luar Terminal - Tertutup dengan AC', satuan: 'm2/bulan',   tarif: 72000 },
  ];

  for (const t of nonAircraftTariffs) {
    await prisma.master_tariffs.upsert({
      where: { kode_tarif: t.kode_tarif },
      update: { tarif: t.tarif, objek: t.objek, satuan: t.satuan },
      create: { ...t, status: 'Active' }
    });
  }
  console.log('Non-aircraft tariffs seeded (Apron, Ruangan In & Out).');
  console.log('Seeding Aircraft Types & Tariffs finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
