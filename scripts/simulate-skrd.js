const prisma = require('../src/config/db');
const { checkArrearsAndGenerateWarnings } = require('../src/workers/contractMonitor');

/**
 * Script Simulasi & Pengujian Tahapan Penagihan Perbup Mimika No. 25 Tahun 2024
 * Penggunaan:
 *   node scripts/simulate-skrd.js list
 *   node scripts/simulate-skrd.js h-7 [invoice_id]
 *   node scripts/simulate-skrd.js h+7 [invoice_id]
 *   node scripts/simulate-skrd.js strd [invoice_id]
 *   node scripts/simulate-skrd.js check
 */

async function main() {
  const args = process.argv.slice(2);
  const command = (args[0] || 'list').toLowerCase();
  const targetId = args[1] ? parseInt(args[1], 10) : null;

  console.log('================================================================');
  console.log(' SIMULASI PENAGIHAN RETRIBUSI DAERAH (PERBUP MIMIKA 25/2024)   ');
  console.log('================================================================');

  if (command === 'list') {
    const invoices = await prisma.invoices.findMany({
      include: {
        tenants: true,
        warnings: true
      },
      orderBy: { id: 'asc' }
    });

    console.log(`Ditemukan ${invoices.length} invoice/SKRD di database:\n`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    invoices.forEach(inv => {
      let daysDiff = '-';
      if (inv.due_date) {
        const due = new Date(inv.due_date);
        due.setHours(0, 0, 0, 0);
        const diffMs = due.getTime() - today.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        daysDiff = diffDays >= 0 ? `+${diffDays} hari lagi (H-${diffDays})` : `${diffDays} hari lalu (H+${Math.abs(diffDays)})`;
      }

      console.log(`[ID: ${inv.id}] No: ${inv.invoice_number}`);
      console.log(`  Tenant    : ${inv.tenants?.nama_perusahaan || '-'}`);
      console.log(`  Status    : ${inv.status}`);
      console.log(`  Jatuh Tempo: ${inv.due_date ? inv.due_date.toISOString().split('T')[0] : 'None'} (${daysDiff})`);
      console.log(`  Naskah Dinas Terbit: ${inv.warnings?.map(w => w.type).join(', ') || 'Belum ada'}`);
      console.log('----------------------------------------------------------------');
    });

    console.log('\nPetunjuk Uji Coba:');
    console.log('  node scripts/simulate-skrd.js h-7 <id_invoice>   -> Simulasikan Surat Pemberitahuan (H-7)');
    console.log('  node scripts/simulate-skrd.js h+7 <id_invoice>   -> Simulasikan Surat Teguran (H+7)');
    console.log('  node scripts/simulate-skrd.js strd <id_invoice>  -> Simulasikan STRD (Bunga 1% / H+14)');
    console.log('  node scripts/simulate-skrd.js check              -> Jalankan sinkronisasi penagihan sekarang');
    return;
  }

  if (command === 'check') {
    console.log('Menjalankan worker pengecekan penagihan...');
    await checkArrearsAndGenerateWarnings();
    console.log('Selesai!');
    return;
  }

  // Cari target invoice
  let invoice;
  if (targetId) {
    invoice = await prisma.invoices.findUnique({ where: { id: targetId }, include: { tenants: true } });
    if (!invoice) {
      console.error(`Error: Invoice dengan ID ${targetId} tidak ditemukan.`);
      process.exit(1);
    }
  } else {
    // Ambil invoice pertama yang Unpaid
    invoice = await prisma.invoices.findFirst({
      where: { status: 'Unpaid' },
      include: { tenants: true },
      orderBy: { id: 'asc' }
    });
    if (!invoice) {
      console.error('Tidak ada invoice berstatus Unpaid untuk diuji.');
      process.exit(1);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (command === 'h-7') {
    // Set due_date = Hari ini + 5 hari (jatuh tempo 5 hari lagi, dalam rentang H-7)
    const targetDue = new Date(today);
    targetDue.setDate(today.getDate() + 5);

    // Hapus warning tipe 'Surat Pemberitahuan' lama jika ada agar bisa di-generate ulang
    await prisma.warnings.deleteMany({
      where: { invoice_id: invoice.id, type: 'Surat Pemberitahuan' }
    });

    await prisma.invoices.update({
      where: { id: invoice.id },
      data: {
        due_date: targetDue,
        status: 'Unpaid'
      }
    });

    console.log(`[BERHASIL] Invoice ID ${invoice.id} (${invoice.invoice_number}) diset ke kondisi H-7:`);
    console.log(`- Jatuh Tempo Baru : ${targetDue.toISOString().split('T')[0]} (5 hari ke depan)`);
    console.log(`- Status           : Unpaid`);
    console.log('\nMenjalankan sinkronisasi penagihan...');
    await checkArrearsAndGenerateWarnings();

    const resultWarning = await prisma.warnings.findFirst({
      where: { invoice_id: invoice.id, type: 'Surat Pemberitahuan' },
      orderBy: { id: 'desc' }
    });

    if (resultWarning) {
      console.log('\n[SUKSES] Naskah Dinas Terbit:');
      console.log(`- Jenis Dokumen : ${resultWarning.type}`);
      console.log(`- Nomor Surat   : ${resultWarning.warning_number}`);
      console.log(`- Pesan         : ${resultWarning.message}`);
      console.log('\nSilakan cek di browser halaman: http://localhost:3000/dinas/peringatan');
    }
  } else if (command === 'h+7') {
    // Set due_date = Hari ini - 7 hari (sudah lewat 7 hari)
    const targetDue = new Date(today);
    targetDue.setDate(today.getDate() - 7);

    await prisma.warnings.deleteMany({
      where: { invoice_id: invoice.id, type: 'Surat Teguran' }
    });

    await prisma.invoices.update({
      where: { id: invoice.id },
      data: {
        due_date: targetDue,
        status: 'Unpaid'
      }
    });

    console.log(`[BERHASIL] Invoice ID ${invoice.id} (${invoice.invoice_number}) diset ke kondisi H+7:`);
    console.log(`- Jatuh Tempo Baru : ${targetDue.toISOString().split('T')[0]} (lewat 7 hari lalu)`);
    console.log('\nMenjalankan sinkronisasi penagihan...');
    await checkArrearsAndGenerateWarnings();

    const resultWarning = await prisma.warnings.findFirst({
      where: { invoice_id: invoice.id, type: 'Surat Teguran' },
      orderBy: { id: 'desc' }
    });

    if (resultWarning) {
      console.log('\n[SUKSES] Naskah Dinas Terbit:');
      console.log(`- Jenis Dokumen : ${resultWarning.type}`);
      console.log(`- Nomor Surat   : ${resultWarning.warning_number}`);
      console.log(`- Pesan         : ${resultWarning.message}`);
      console.log('\nSilakan cek di browser halaman: http://localhost:3000/dinas/peringatan');
    }
  } else if (command === 'strd') {
    // Set due_date = Hari ini - 15 hari (sudah lewat 15 hari)
    const targetDue = new Date(today);
    targetDue.setDate(today.getDate() - 15);

    await prisma.warnings.deleteMany({
      where: { invoice_id: invoice.id, type: 'STRD' }
    });

    await prisma.invoices.update({
      where: { id: invoice.id },
      data: {
        due_date: targetDue,
        status: 'Unpaid'
      }
    });

    console.log(`[BERHASIL] Invoice ID ${invoice.id} (${invoice.invoice_number}) diset ke kondisi STRD (H+14+):`);
    console.log(`- Jatuh Tempo Baru : ${targetDue.toISOString().split('T')[0]} (lewat 15 hari lalu)`);
    console.log('\nMenjalankan sinkronisasi penagihan...');
    await checkArrearsAndGenerateWarnings();

    const resultWarning = await prisma.warnings.findFirst({
      where: { invoice_id: invoice.id, type: 'STRD' },
      orderBy: { id: 'desc' }
    });

    if (resultWarning) {
      console.log('\n[SUKSES] Naskah Dinas Terbit:');
      console.log(`- Jenis Dokumen : ${resultWarning.type}`);
      console.log(`- Nomor Surat   : ${resultWarning.warning_number}`);
      console.log(`- Pesan         : ${resultWarning.message}`);
      console.log('\nSilakan cek di browser halaman: http://localhost:3000/dinas/peringatan');
    }
  } else {
    console.log(`Command '${command}' tidak dikenali. Gunakan: list, h-7, h+7, strd, atau check.`);
  }
}

main()
  .catch(err => {
    console.error('Error saat menjalankan simulasi:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
