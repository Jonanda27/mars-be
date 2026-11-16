const prisma = require('../config/db');

/**
 * Logika Perhitungan Retribusi Pesawat (Hanggar & Apron)
 * Berdasarkan aturan Perda Pemkab Mimika (per unit per malam)
 */
exports.calculateParkingFee = async (parking_location, is_overnight, aircraft_type_id, total_nights = 1) => {
  // Jika tidak menginap (keluar sebelum jam 17.00 WIT), GRATIS / Rp 0
  if (!is_overnight) {
    return 0;
  }

  // Jika menginap (melewati jam 17.00 WIT), hitung berdasarkan Lokasi & Tipe Pesawat
  // Kita cari tarif aktif dari master_tariffs
  let jenis_layanan = parking_location === 'Apron' ? 'Sewa Apron' : 'Sewa Hanggar';

  const tariff = await prisma.master_tariffs.findFirst({
    where: {
      jenis_layanan: {
        contains: parking_location === 'Apron' ? 'Apron' : 'Hanggar',
        mode: 'insensitive'
      },
      aircraft_type_id: aircraft_type_id,
      status: 'Active'
    },
    orderBy: { created_at: 'desc' }
  });

  if (!tariff) {
    // Fallback jika tidak ditemukan tarif spesifik
    console.warn(`Tarif tidak ditemukan untuk ${jenis_layanan} dan aircraft_type_id ${aircraft_type_id}`);
    
    // Coba cari tarif umum (contoh: tanpa aircraft_type_id)
    const generalTariff = await prisma.master_tariffs.findFirst({
      where: {
        jenis_layanan: {
          contains: parking_location === 'Apron' ? 'Apron' : 'Hanggar',
          mode: 'insensitive'
        },
        status: 'Active'
      },
      orderBy: { created_at: 'desc' }
    });
    
    if (generalTariff) {
       return Number(generalTariff.tarif) * total_nights;
    }
    
    return 0; 
  }

  return Number(tariff.tarif) * total_nights;
};
