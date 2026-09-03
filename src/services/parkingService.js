const prisma = require('../config/db');

/**
 * Service Logika Akuntansi & Logistik Parkir Manual (Fase 1)
 * Mengikuti prinsip Information Expert & Atomic Transactions
 */

// 1. Input Stok Buku Karcis Baru (Admin UPBU)
const createTicketBook = async (user, data) => {
  const airport_id = user.airport_id || data.airport_id;
  if (!airport_id) {
    const error = new Error('Airport ID wajib disertakan');
    error.statusCode = 400;
    throw error;
  }

  const { kode_buku, jenis_karcis, seri_awal, seri_akhir, nominal_per_lembar } = data;

  const start = parseInt(seri_awal, 10);
  const end = parseInt(seri_akhir, 10);
  const nominal = parseFloat(nominal_per_lembar);

  if (isNaN(start) || isNaN(end) || start <= 0 || end < start) {
    const error = new Error('Nomor seri awal dan akhir tidak valid (seri akhir harus >= seri awal)');
    error.statusCode = 400;
    throw error;
  }

  if (isNaN(nominal) || nominal <= 0) {
    const error = new Error('Nominal per lembar harus lebih besar dari 0');
    error.statusCode = 400;
    throw error;
  }

  const existing = await prisma.parking_ticket_books.findUnique({
    where: { kode_buku }
  });

  if (existing) {
    const error = new Error(`Kode buku '${kode_buku}' sudah terdaftar`);
    error.statusCode = 400;
    throw error;
  }

  const newBook = await prisma.parking_ticket_books.create({
    data: {
      airport_id,
      kode_buku,
      jenis_karcis,
      seri_awal: start,
      seri_akhir: end,
      nominal_per_lembar: nominal,
      status: 'STOK'
    },
    include: {
      airports: {
        select: { id: true, kode_bandara: true, nama_bandara: true }
      }
    }
  });

  return newBook;
};

// 2. Ambil Stok Buku Karcis yang Tersedia (Status: STOK)
const getAvailableBooks = async (user, filterAirportId) => {
  const airport_id = user.airport_id || (filterAirportId ? parseInt(filterAirportId, 10) : undefined);

  const whereClause = {
    status: 'STOK'
  };

  if (airport_id) {
    whereClause.airport_id = airport_id;
  }

  const books = await prisma.parking_ticket_books.findMany({
    where: whereClause,
    include: {
      airports: {
        select: { id: true, kode_bandara: true, nama_bandara: true }
      },
      handovers: {
        orderBy: { id: 'desc' },
        take: 1
      }
    },
    orderBy: { id: 'desc' }
  });

  // Hitung nomor seri awal efektif yang tersedia (untuk buku sisa shift sebelumnya)
  const mapped = books.map(book => {
    const lastHandover = book.handovers && book.handovers.length > 0 ? book.handovers[0] : null;
    const effectiveStart = (lastHandover && lastHandover.last_returned_serial)
      ? lastHandover.last_returned_serial
      : book.seri_awal;

    const remainingSheets = (book.seri_akhir - effectiveStart) + 1;

    return {
      ...book,
      effective_serial_start: effectiveStart,
      remaining_sheets: Math.max(0, remainingSheets)
    };
  });

  return mapped;
};

// 3. Ambil Semua Buku Karcis (Inventaris Lengkap)
const getAllBooks = async (user, filters = {}) => {
  const airport_id = user.airport_id || (filters.airport_id ? parseInt(filters.airport_id, 10) : undefined);

  const whereClause = {};
  if (airport_id) whereClause.airport_id = airport_id;
  if (filters.status) whereClause.status = filters.status;
  if (filters.jenis_karcis) whereClause.jenis_karcis = filters.jenis_karcis;

  const books = await prisma.parking_ticket_books.findMany({
    where: whereClause,
    include: {
      airports: {
        select: { id: true, kode_bandara: true, nama_bandara: true }
      },
      _count: {
        select: { handovers: true }
      }
    },
    orderBy: { id: 'desc' }
  });

  return books;
};

// 4. Distribusikan Buku Karcis ke Juru Parkir (Mulai Shift)
const dispatchBooklet = async (user, data) => {
  const { book_id, warden_name, dispatched_serial_start, dispatched_serial_end } = data;

  const bookId = parseInt(book_id, 10);
  const start = parseInt(dispatched_serial_start, 10);
  const end = parseInt(dispatched_serial_end, 10);

  if (!warden_name || warden_name.trim() === '') {
    const error = new Error('Nama Juru Parkir wajib diisi');
    error.statusCode = 400;
    throw error;
  }

  // 1. Ambil data buku
  const book = await prisma.parking_ticket_books.findUnique({
    where: { id: bookId },
    include: {
      handovers: {
        orderBy: { id: 'desc' },
        take: 1
      }
    }
  });

  if (!book) {
    const error = new Error('Buku karcis tidak ditemukan');
    error.statusCode = 404;
    throw error;
  }

  // Protected Variations: validasi multi-bandara
  if (user.airport_id && book.airport_id !== user.airport_id) {
    const error = new Error('Akses ditolak: Buku karcis ini milik bandara lain');
    error.statusCode = 403;
    throw error;
  }

  // Aturan Validasi 1: Status buku wajib STOK
  if (book.status !== 'STOK') {
    const error = new Error(`Buku karcis tidak tersedia untuk dipinjamkan (Status saat ini: ${book.status})`);
    error.statusCode = 400;
    throw error;
  }

  // Hitung nomor seri awal efektif yang tersedia secara deterministik (Anti Karcis Mengambang)
  const lastHandover = book.handovers && book.handovers.length > 0 ? book.handovers[0] : null;
  const effectiveStart = (lastHandover && lastHandover.last_returned_serial)
    ? lastHandover.last_returned_serial
    : book.seri_awal;

  // Celah A Fix: Cegah Karcis Mengambang (Orphaned Serials).
  // Nomor seri awal alokasi WAJIB persis sama dengan nomor seri sisa yang tersedia.
  if (start !== effectiveStart) {
    const error = new Error(`Nomor seri awal alokasi (${start}) tidak valid. Sistem mewajibkan seri awal terkunci persis pada seri sisa yang tersedia (${effectiveStart}) untuk mencegah karcis mengambang.`);
    error.statusCode = 400;
    throw error;
  }

  // Aturan Validasi 2 & 3: Batas nomor seri buku
  if (end > book.seri_akhir || start > end) {
    const error = new Error(`Nomor seri yang dialokasikan (${start} - ${end}) melampaui batas fisik buku karcis (${book.seri_awal} - ${book.seri_akhir})`);
    error.statusCode = 400;
    throw error;
  }

  // Celah B Fix: Atomic Concurrency Lock dengan updateMany berstatus STOK
  // Mencegah dua admin mengalokasikan buku karcis yang sama secara simultan
  const result = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.parking_ticket_books.updateMany({
      where: {
        id: book.id,
        status: 'STOK'
      },
      data: {
        status: 'ACTIVE',
        updated_at: new Date()
      }
    });

    if (updateResult.count === 0) {
      const error = new Error('Buku karcis sedang dialokasikan oleh sesi admin lain (Concurrency Conflict). Silakan refresh halaman.');
      error.statusCode = 409;
      throw error;
    }

    const newHandover = await tx.parking_warden_handovers.create({
      data: {
        airport_id: book.airport_id,
        book_id: book.id,
        warden_name: warden_name.trim(),
        dispatched_serial_start: start,
        dispatched_serial_end: end,
        status: 'DISTRIBUTED',
        dispatch_time: new Date()
      },
      include: {
        ticket_books: true,
        airports: {
          select: { id: true, kode_bandara: true, nama_bandara: true }
        }
      }
    });

    return newHandover;
  });

  return result;
};

// 5. Rekonsiliasi & Setoran Akhir Shift (Settle)
const settleHandover = async (user, handoverId, data) => {
  const hId = parseInt(handoverId, 10);
  const { last_returned_serial, actual_cash_settled: rawActualCash, notes } = data;

  const lastReturned = parseInt(last_returned_serial, 10);
  const actualCash = parseFloat(rawActualCash);

  if (isNaN(lastReturned)) {
    const error = new Error('Nomor seri sisa karcis terakhir wajib diisi dengan angka');
    error.statusCode = 400;
    throw error;
  }

  if (isNaN(actualCash) || actualCash < 0) {
    const error = new Error('Nominal uang fisik yang disetor wajib diisi dan tidak boleh minus');
    error.statusCode = 400;
    throw error;
  }

  // Ambil data handover aktif
  const handover = await prisma.parking_warden_handovers.findUnique({
    where: { id: hId },
    include: {
      ticket_books: true
    }
  });

  if (!handover) {
    const error = new Error('Data penyerahan karcis tidak ditemukan');
    error.statusCode = 404;
    throw error;
  }

  // Protected Variations: validasi multi-bandara
  if (user.airport_id && handover.airport_id !== user.airport_id) {
    const error = new Error('Akses ditolak: Data penyerahan karcis milik bandara lain');
    error.statusCode = 403;
    throw error;
  }

  if (handover.status !== 'DISTRIBUTED') {
    const error = new Error(`Penyerahan ini sudah berstatus ${handover.status} dan tidak dapat disettle ulang`);
    error.statusCode = 400;
    throw error;
  }

  // Validasi rentang last_returned_serial:
  // Harus berada dalam rentang [dispatched_serial_start, dispatched_serial_end + 1]
  // (Jika habis total, nomor seri sisa diinput dispatched_serial_end + 1)
  if (lastReturned < handover.dispatched_serial_start || lastReturned > (handover.dispatched_serial_end + 1)) {
    const error = new Error(`Nomor seri sisa karcis (${lastReturned}) tidak valid. Harus antara ${handover.dispatched_serial_start} s/d ${handover.dispatched_serial_end + 1}`);
    error.statusCode = 400;
    throw error;
  }

  // Perhitungan matematis Information Expert (Celah D Fix: Integer Currency Precision):
  const sold_qty = lastReturned - handover.dispatched_serial_start;
  const nominal_per_lembar = Math.round(parseFloat(handover.ticket_books.nominal_per_lembar));
  const expected_amount = Math.round(sold_qty * nominal_per_lembar);
  const actual_cash_settled = Math.round(actualCash);
  const unmatched_amount = actual_cash_settled - expected_amount;

  // Aturan Validasi: Jika unmatched_amount < 0, notes WAJIB diisi
  if (unmatched_amount < 0 && (!notes || notes.trim() === '')) {
    const error = new Error(`Terjadi selisih kurang (defisit) sebesar Rp ${Math.abs(unmatched_amount).toLocaleString('id-ID')}. Kolom alasan/keterangan selisih wajib diisi.`);
    error.statusCode = 400;
    throw error;
  }

  // Atomic Transaction: Update handover & update status buku karcis
  const result = await prisma.$transaction(async (tx) => {
    const updatedHandover = await tx.parking_warden_handovers.update({
      where: { id: hId },
      data: {
        last_returned_serial: lastReturned,
        sold_qty,
        expected_amount,
        actual_cash_settled: actualCash,
        unmatched_amount,
        notes: notes ? notes.trim() : null,
        status: 'SETTLED',
        settle_time: new Date()
      },
      include: {
        ticket_books: true,
        airports: {
          select: { id: true, kode_bandara: true, nama_bandara: true }
        }
      }
    });

    // Cek apakah buku karcis telah habis seluruhnya
    // Jika sisa nomor seri >= seri_akhir + 1, buku HABIS
    const isBookExhausted = lastReturned >= (handover.ticket_books.seri_akhir + 1);
    const newBookStatus = isBookExhausted ? 'HABIS' : 'STOK';

    await tx.parking_ticket_books.update({
      where: { id: handover.book_id },
      data: {
        status: newBookStatus,
        updated_at: new Date()
      }
    });

    return updatedHandover;
  });

  return result;
};

// 6. Ambil Penugasan Aktif (DISTRIBUTED)
const getActiveHandovers = async (user, filterAirportId) => {
  const airport_id = user.airport_id || (filterAirportId ? parseInt(filterAirportId, 10) : undefined);

  const whereClause = {
    status: 'DISTRIBUTED'
  };

  if (airport_id) {
    whereClause.airport_id = airport_id;
  }

  const handovers = await prisma.parking_warden_handovers.findMany({
    where: whereClause,
    include: {
      ticket_books: true,
      airports: {
        select: { id: true, kode_bandara: true, nama_bandara: true }
      }
    },
    orderBy: { dispatch_time: 'desc' }
  });

  return handovers;
};

// 7. Ambil Riwayat Serah Terima (Log Lengkap)
const getHandoverHistory = async (user, filters = {}) => {
  const airport_id = user.airport_id || (filters.airport_id ? parseInt(filters.airport_id, 10) : undefined);

  const whereClause = {};
  if (airport_id) whereClause.airport_id = airport_id;
  if (filters.status) whereClause.status = filters.status;
  if (filters.warden_name) {
    whereClause.warden_name = { contains: filters.warden_name, mode: 'insensitive' };
  }

  if (filters.start_date || filters.end_date) {
    whereClause.dispatch_time = {};
    if (filters.start_date) {
      whereClause.dispatch_time.gte = new Date(filters.start_date);
    }
    if (filters.end_date) {
      const end = new Date(filters.end_date);
      end.setHours(23, 59, 59, 999);
      whereClause.dispatch_time.lte = end;
    }
  }

  const handovers = await prisma.parking_warden_handovers.findMany({
    where: whereClause,
    include: {
      ticket_books: true,
      airports: {
        select: { id: true, kode_bandara: true, nama_bandara: true }
      }
    },
    orderBy: { dispatch_time: 'desc' }
  });

  return handovers;
};

// 8. Laporan Rekonsiliasi Keuangan & Deteksi Kebocoran (Dishub & UPBU)
const getReconciliationReport = async (user, filters = {}) => {
  const airport_id = user.airport_id || (filters.airport_id ? parseInt(filters.airport_id, 10) : undefined);

  const whereClause = {};
  if (airport_id) whereClause.airport_id = airport_id;

  if (filters.start_date || filters.end_date) {
    whereClause.settle_time = {};
    if (filters.start_date) {
      whereClause.settle_time.gte = new Date(filters.start_date);
    }
    if (filters.end_date) {
      const end = new Date(filters.end_date);
      end.setHours(23, 59, 59, 999);
      whereClause.settle_time.lte = end;
    }
  }

  const allHandovers = await prisma.parking_warden_handovers.findMany({
    where: whereClause,
    include: {
      ticket_books: true,
      airports: {
        select: { id: true, kode_bandara: true, nama_bandara: true }
      }
    },
    orderBy: { settle_time: 'desc' }
  });

  const settledHandovers = allHandovers.filter(h => h.status === 'SETTLED');
  const activeHandovers = allHandovers.filter(h => h.status === 'DISTRIBUTED');

  // Ringkasan Kumulatif
  let totalSoldQty = 0;
  let totalExpectedAmount = 0;
  let totalActualCash = 0;
  let totalUnmatchedAmount = 0;
  let deficitCount = 0;
  let surplusCount = 0;
  let balancedCount = 0;

  settledHandovers.forEach(h => {
    const sold = h.sold_qty || 0;
    const exp = parseFloat(h.expected_amount || 0);
    const act = parseFloat(h.actual_cash_settled || 0);
    const unmatch = parseFloat(h.unmatched_amount || 0);

    totalSoldQty += sold;
    totalExpectedAmount += exp;
    totalActualCash += act;
    totalUnmatchedAmount += unmatch;

    if (unmatch < 0) deficitCount++;
    else if (unmatch > 0) surplusCount++;
    else balancedCount++;
  });

  // Agregasi per Juru Parkir (Leakage Detection per Warden)
  const wardenMap = {};
  settledHandovers.forEach(h => {
    const name = h.warden_name;
    if (!wardenMap[name]) {
      wardenMap[name] = {
        warden_name: name,
        shifts_count: 0,
        total_sold: 0,
        total_expected: 0,
        total_actual: 0,
        total_unmatched: 0,
        deficits: 0
      };
    }
    wardenMap[name].shifts_count += 1;
    wardenMap[name].total_sold += (h.sold_qty || 0);
    wardenMap[name].total_expected += parseFloat(h.expected_amount || 0);
    wardenMap[name].total_actual += parseFloat(h.actual_cash_settled || 0);
    const unmatch = Math.round(parseFloat(h.unmatched_amount || 0));
    wardenMap[name].total_unmatched += unmatch;
    if (unmatch < 0) wardenMap[name].deficits += 1;
  });

  // Sistem Klasifikasi Tingkat Kebocoran per Juru Parkir (Standar Audit BPK)
  const wardenBreakdown = Object.values(wardenMap).map(w => {
    const wardenLeakagePct = w.total_expected > 0 ? (Math.abs(Math.min(0, w.total_unmatched)) / w.total_expected) * 100 : 0;
    let risk_level = 'AMAN'; // AMAN | WASPADA | KRITIKAL
    if (wardenLeakagePct > 1 || Math.abs(w.total_unmatched) >= 50000) {
      risk_level = 'KRITIKAL';
    } else if (w.total_unmatched < 0) {
      risk_level = 'WASPADA';
    }
    return {
      ...w,
      leakage_pct: parseFloat(wardenLeakagePct.toFixed(2)),
      risk_level
    };
  }).sort((a, b) => a.total_unmatched - b.total_unmatched);

  // Agregasi per Bandara (Multi-UPBU Komparasi)
  const airportMap = {};
  settledHandovers.forEach(h => {
    const apCode = h.airports?.kode_bandara || 'UNKNOWN';
    const apName = h.airports?.nama_bandara || apCode;
    if (!airportMap[apCode]) {
      airportMap[apCode] = {
        kode_bandara: apCode,
        nama_bandara: apName,
        total_sold: 0,
        total_expected: 0,
        total_actual: 0,
        total_unmatched: 0
      };
    }
    airportMap[apCode].total_sold += (h.sold_qty || 0);
    airportMap[apCode].total_expected += parseFloat(h.expected_amount || 0);
    airportMap[apCode].total_actual += parseFloat(h.actual_cash_settled || 0);
    airportMap[apCode].total_unmatched += parseFloat(h.unmatched_amount || 0);
  });

  const airportBreakdown = Object.values(airportMap);

  // Agregasi per Jenis Karcis
  const vehicleMap = {};
  settledHandovers.forEach(h => {
    const jenis = h.ticket_books?.jenis_karcis || 'Lainnya';
    if (!vehicleMap[jenis]) {
      vehicleMap[jenis] = {
        jenis_karcis: jenis,
        total_sold: 0,
        total_amount: 0
      };
    }
    vehicleMap[jenis].total_sold += (h.sold_qty || 0);
    vehicleMap[jenis].total_amount += parseFloat(h.expected_amount || 0);
  });

  const vehicleBreakdown = Object.values(vehicleMap);

  const leakageRatePct = totalExpectedAmount > 0 
    ? Math.abs(Math.min(0, totalUnmatchedAmount)) / totalExpectedAmount * 100 
    : 0;

  // Ambang Batas Toleransi Kebocoran PAD:
  // - AMAN: 0% defisit
  // - WASPADA: <= 1% defisit (Toleransi operasional / uang kembalian)
  // - KRITIKAL: > 1% defisit (Potensi kebocoran / Audit investigasi)
  let auditStatus = 'AMAN';
  if (leakageRatePct > 1) {
    auditStatus = 'KRITIKAL';
  } else if (totalUnmatchedAmount < 0) {
    auditStatus = 'WASPADA';
  }

  return {
    summary: {
      total_active_shifts: activeHandovers.length,
      total_settled_shifts: settledHandovers.length,
      total_sold_qty: totalSoldQty,
      total_expected_amount: totalExpectedAmount,
      total_actual_cash: totalActualCash,
      total_unmatched_amount: totalUnmatchedAmount,
      leakage_rate_pct: parseFloat(leakageRatePct.toFixed(2)),
      audit_status: auditStatus,
      deficit_count: deficitCount,
      surplus_count: surplusCount,
      balanced_count: balancedCount
    },
    warden_breakdown: wardenBreakdown,
    airport_breakdown: airportBreakdown,
    vehicle_breakdown: vehicleBreakdown,
    recent_settlements: settledHandovers.slice(0, 15)
  };
};

module.exports = {
  createTicketBook,
  getAvailableBooks,
  getAllBooks,
  dispatchBooklet,
  settleHandover,
  getActiveHandovers,
  getHandoverHistory,
  getReconciliationReport
};
