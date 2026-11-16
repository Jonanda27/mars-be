const prisma = require('../config/db');

/**
 * Service Perhitungan Tax & Retribusi Mini Airport (Penerbangan Perintis Papua Tengah)
 * Berdasarkan master_taxes resmi:
 * 1. Tax Pendaratan (Landing Tax) - Berdasarkan Tipe Armada
 * 2. Tax Penumpang (PJP2U) - Per Orang Penumpang
 * 3. Tax Airport - Jasa Kebandarudaraan & Keamanan Bandara
 * 4. Kondisional: Tax Parkir Apron ATAU Tax Nginap (RON)
 */
exports.calculateMiniAirportTaxes = async ({
  aircraft_type_id = null,
  aircraft_type_name = '',
  passengers_count = 1,
  is_overnight = false,
  overnight_nights = 1
}) => {
  const allTaxes = await prisma.master_taxes.findMany({
    where: { status: 'Active' },
    include: { aircraft_types: true }
  });

  const taxes = [];
  const typeId = aircraft_type_id ? Number.parseInt(aircraft_type_id, 10) : null;
  const typeName = (aircraft_type_name || '').toLowerCase();

  // 1. TAX PENDARATAN (Landing Tax)
  const landingTaxes = allTaxes.filter(t => t.kategori === 'Pendaratan');
  let selectedLandingTax = null;
  if (typeId) {
    selectedLandingTax = landingTaxes.find(t => t.aircraft_type_id === typeId);
  }
  if (!selectedLandingTax) {
    if (typeName.includes('heli') || typeName.includes('as350') || typeName.includes('bell') || typeName.includes('kamov')) {
      selectedLandingTax = landingTaxes.find(t => t.kode_tax === 'TAX-LND-HELI');
    } else if (typeName.includes('c208') || typeName.includes('cessna') || typeName.includes('pac')) {
      selectedLandingTax = landingTaxes.find(t => t.kode_tax === 'TAX-LND-LIGHT');
    } else if (typeName.includes('dhc') || typeName.includes('twin')) {
      selectedLandingTax = landingTaxes.find(t => t.kode_tax === 'TAX-LND-MEDIUM');
    } else if (typeName.includes('atr')) {
      selectedLandingTax = landingTaxes.find(t => t.kode_tax === 'TAX-LND-HEAVY');
    }
  }
  if (!selectedLandingTax && landingTaxes.length > 0) {
    selectedLandingTax = landingTaxes[0];
  }

  if (selectedLandingTax) {
    const tarif = Number(selectedLandingTax.tarif);
    taxes.push({
      kode_tax: selectedLandingTax.kode_tax,
      nama_tax: selectedLandingTax.nama_tax,
      kategori: 'Pendaratan',
      satuan: selectedLandingTax.satuan,
      dasar_hukum: selectedLandingTax.dasar_hukum,
      tarif,
      qty: 1,
      subtotal: tarif
    });
  }

  // 2. TAX PENUMPANG (PJP2U)
  const paxTax = allTaxes.find(t => t.kategori === 'Penumpang' && t.kode_tax === 'TAX-PAX-DOM') ||
                 allTaxes.find(t => t.kategori === 'Penumpang');
  const validPaxCount = Math.max(1, Number.parseInt(passengers_count, 10) || 1);
  if (paxTax) {
    const tarif = Number(paxTax.tarif);
    taxes.push({
      kode_tax: paxTax.kode_tax,
      nama_tax: paxTax.nama_tax,
      kategori: 'Penumpang',
      satuan: paxTax.satuan,
      dasar_hukum: paxTax.dasar_hukum,
      tarif,
      qty: validPaxCount,
      subtotal: tarif * validPaxCount
    });
  }

  // 3. TAX AIRPORT (Jasa Pelayanan Kebandarudaraan Perintis)
  const aptTax = allTaxes.find(t => t.kategori === 'Airport' && t.kode_tax === 'TAX-APT-SRV') ||
                 allTaxes.find(t => t.kategori === 'Airport');
  if (aptTax) {
    const tarif = Number(aptTax.tarif);
    taxes.push({
      kode_tax: aptTax.kode_tax,
      nama_tax: 'Tax Airport (Jasa Kebandarudaraan)',
      kategori: 'Airport',
      satuan: aptTax.satuan,
      dasar_hukum: aptTax.dasar_hukum,
      tarif,
      qty: 1,
      subtotal: tarif
    });
  }

  // 4. KONDISIONAL: TAX PARKIR ATAU TAX NGINAP (RON)
  if (is_overnight) {
    // Kena Tax Nginap (RON), Tax Parkir Bebas
    const nginapTaxes = allTaxes.filter(t => t.kategori === 'Nginap');
    let selectedNginapTax = null;
    if (typeId) {
      selectedNginapTax = nginapTaxes.find(t => t.aircraft_type_id === typeId);
    }
    if (!selectedNginapTax) {
      if (typeName.includes('heli') || typeName.includes('as350') || typeName.includes('bell') || typeName.includes('kamov')) {
        selectedNginapTax = nginapTaxes.find(t => t.kode_tax === 'TAX-NGN-HELI');
      } else if (typeName.includes('c208') || typeName.includes('cessna') || typeName.includes('pac')) {
        selectedNginapTax = nginapTaxes.find(t => t.kode_tax === 'TAX-NGN-FIX-S');
      } else {
        selectedNginapTax = nginapTaxes.find(t => t.kode_tax === 'TAX-NGN-FIX-L');
      }
    }
    if (!selectedNginapTax && nginapTaxes.length > 0) {
      selectedNginapTax = nginapTaxes[0];
    }

    const nights = Math.max(1, Number.parseInt(overnight_nights, 10) || 1);
    if (selectedNginapTax) {
      const tarif = Number(selectedNginapTax.tarif);
      taxes.push({
        kode_tax: selectedNginapTax.kode_tax,
        nama_tax: `${selectedNginapTax.nama_tax} (${nights} Malam)`,
        kategori: 'Nginap',
        satuan: selectedNginapTax.satuan,
        dasar_hukum: selectedNginapTax.dasar_hukum,
        tarif,
        qty: nights,
        subtotal: tarif * nights
      });
    }
  } else {
    // Hanya Parkir Apron (Transit), Tax Nginap Bebas
    const parkirTax = allTaxes.find(t => t.kategori === 'Parkir' && t.kode_tax === 'TAX-PRK-DAY') ||
                      allTaxes.find(t => t.kategori === 'Parkir');
    if (parkirTax) {
      const tarif = Number(parkirTax.tarif);
      taxes.push({
        kode_tax: parkirTax.kode_tax,
        nama_tax: parkirTax.nama_tax,
        kategori: 'Parkir',
        satuan: parkirTax.satuan,
        dasar_hukum: parkirTax.dasar_hukum,
        tarif,
        qty: 1,
        subtotal: tarif
      });
    }
  }

  const totalAmount = taxes.reduce((acc, curr) => acc + curr.subtotal, 0);

  return {
    taxes,
    totalAmount
  };
};
