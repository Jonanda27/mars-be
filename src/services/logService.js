const prisma = require('../config/db');

exports.emergencyCheckin = async (data) => {
  const {
    contract_id,
    registration_number,
    aircraft_type_id,
    airline_name,
    pic_name,
    pic_phone,
    pic_email,
    parking_location = 'Hanggar',
    asset_id,
    emergency_reason,
    pic_signature,
    evidence_photo,
    officer_id
  } = data;

  let contract = null;
  let tenant = null;
  let aircraft = null;

  // 1. Resolve Asset ID and Parking Location
  let resolvedAssetId = asset_id ? parseInt(asset_id, 10) : null;
  let resolvedLocation = parking_location;

  if (resolvedAssetId) {
    const assetFound = await prisma.assets.findUnique({ where: { id: resolvedAssetId } });
    if (assetFound) {
      resolvedLocation = assetFound.jenis_aset;
    }
  } else {
    const isApronType = parking_location.toLowerCase() === 'apron';
    const asset = await prisma.assets.findFirst({
      where: {
        jenis_aset: isApronType ? 'Apron' : 'Hanggar'
      }
    });
    resolvedAssetId = asset ? asset.id : (isApronType ? 2 : 1);
    resolvedLocation = isApronType ? 'Apron' : 'Hanggar';
  }

  const isApron = resolvedLocation.toLowerCase() === 'apron';
  const assetId = resolvedAssetId;

  // If contract_id is provided, use the emergency contract already validated by Dinas
  if (contract_id) {
    contract = await prisma.contracts.findUnique({
      where: { id: parseInt(contract_id, 10) },
      include: { assets: true, tenants: true }
    });

    if (!contract) throw new Error('Kontrak PKS Darurat tidak ditemukan');
    if (contract.status !== 'Aktif' && contract.status !== 'Active') throw new Error('Kontrak PKS Darurat belum berstatus Aktif');

    tenant = contract.tenants;

    const contractFasilitas = typeof contract.fasilitas === 'string'
      ? JSON.parse(contract.fasilitas)
      : (contract.fasilitas || {});

    const regNo = (registration_number || contractFasilitas.registration_number || '').trim().toUpperCase();
    if (!regNo) throw new Error('Nomor Registrasi (Tail Number) wajib tersedia');

    const parsedTypeId = aircraft_type_id ? parseInt(aircraft_type_id, 10) : (contractFasilitas.aircraft_type_id ? parseInt(contractFasilitas.aircraft_type_id, 10) : null);

    // Upsert aircraft ke aset penempatan aktual
    aircraft = await prisma.aircrafts.findUnique({
      where: { registration_number: regNo }
    });
    if (aircraft) {
      aircraft = await prisma.aircrafts.update({
        where: { id: aircraft.id },
        data: {
          asset_id: assetId,
          ...(parsedTypeId && { aircraft_type_id: parsedTypeId }),
          status: 'In Use'
        }
      });
    } else {
      aircraft = await prisma.aircrafts.create({
        data: {
          registration_number: regNo,
          aircraft_type_id: parsedTypeId,
          operator: tenant.nama_perusahaan,
          tenant_id: tenant.id,
          asset_id: assetId,
          status: 'In Use'
        }
      });
    }

    // Update fasilitas kontrak darurat & aset aktual dengan hasil pencatatan fisik petugas lapangan
    const updatedFasilitas = {
      ...contractFasilitas,
      registration_number: regNo,
      ...(parsedTypeId && { aircraft_type_id: parsedTypeId }),
      parking_location: isApron ? 'Apron' : 'Hanggar'
    };

    await prisma.contracts.update({
      where: { id: contract.id },
      data: {
        asset_id: assetId,
        fasilitas: updatedFasilitas
      }
    });

    // 2. Create Operational Log linked to this existing Dinas contract
    const today = new Date();
    const finalReason = emergency_reason || contractFasilitas.emergency_reason || 'Pendaratan Darurat';
    const finalPic = pic_name || contractFasilitas.pic_name || tenant?.pic || 'PIC Lapangan';
    const finalPhone = pic_phone || contractFasilitas.pic_phone || tenant?.nomor_telepon || '-';

    const log = await prisma.operational_logs.create({
      data: {
        registration_number: regNo,
        tenant_id: tenant.id,
        asset_id: assetId,
        contract_id: contract.id,
        entry_time: today,
        parking_location: isApron ? 'Apron' : 'Hanggar',
        notes: `[PKS Darurat: ${contract.contract_number}] ${finalReason}. PIC: ${finalPic} (${finalPhone})`,
        evidence_photo,
        officer_id: officer_id ? parseInt(officer_id, 10) : 1,
        billing_status: 'Unbilled'
      },
      include: {
        tenants: true,
        contracts: {
          include: {
            assets: true,
            tenants: true
          }
        },
        officer: { select: { username: true } }
      }
    });

    return {
      log,
      contract,
      tenant,
      aircraft
    };
  }

  // Fallback: If no contract_id provided (legacy direct flow)
  const regNo = (registration_number || '').trim().toUpperCase();
  if (!regNo) throw new Error('Nomor Registrasi (Tail Number) wajib diisi');
  if (!pic_name) throw new Error('Nama PIC (Pilot In Command) di lokasi wajib diisi');

  const cleanAirlineName = (airline_name || `Operator ${regNo}`).trim();
  tenant = await prisma.tenants.findFirst({
    where: {
      nama_perusahaan: {
        equals: cleanAirlineName,
        mode: 'insensitive'
      }
    }
  });

  if (!tenant) {
    const tenantCount = await prisma.tenants.count();
    const tenantIdStr = `TNT-EMG-${String(tenantCount + 1).padStart(3, '0')}`;
    tenant = await prisma.tenants.create({
      data: {
        tenant_id_str: tenantIdStr,
        nama_perusahaan: cleanAirlineName,
        pic: pic_name,
        nomor_telepon: pic_phone || '-',
        email: pic_email || `${regNo.toLowerCase()}@emergency.bandara-timika.id`,
        jenis_tenant: 'Insidentil / Darurat',
        status_verifikasi: 'Verified',
        status_pembayaran: 'Current'
      }
    });
  }

  const parsedTypeId = aircraft_type_id ? parseInt(aircraft_type_id, 10) : null;
  aircraft = await prisma.aircrafts.findUnique({
    where: { registration_number: regNo }
  });

  if (!aircraft) {
    aircraft = await prisma.aircrafts.create({
      data: {
        registration_number: regNo,
        aircraft_type_id: parsedTypeId,
        operator: cleanAirlineName,
        tenant_id: tenant.id,
        asset_id: assetId,
        status: 'In Use'
      }
    });
  } else {
    aircraft = await prisma.aircrafts.update({
      where: { id: aircraft.id },
      data: {
        ...(parsedTypeId && { aircraft_type_id: parsedTypeId }),
        tenant_id: tenant.id,
        asset_id: assetId,
        status: 'In Use'
      }
    });
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const contractCount = await prisma.contracts.count();
  const contractNumber = `PKS-EMG/${year}/${month}/${String(contractCount + 1).padStart(3, '0')}`;

  contract = await prisma.contracts.create({
    data: {
      contract_number: contractNumber,
      contract_type: 'PKS Pendaratan Darurat',
      tenant_id: tenant.id,
      asset_id: assetId,
      status: 'Aktif',
      start_date: today,
      jenis_pemanfaatan: `Pendaratan Darurat / Ad-Hoc di ${isApron ? 'Apron' : 'Hanggar'}`,
      tenant_signature: pic_signature || 'TTE di Lokasi Lapangan',
      ketentuan_pembayaran: 'Pembayaran retribusi pasca-checkout setelah e-SKRD diterbitkan oleh Dinas Perhubungan Kab. Mimika',
      fasilitas: {
        emergency_reason: emergency_reason || 'Pendaratan Darurat Teknis/Operasional',
        pic_name,
        pic_phone,
        pic_email,
        parking_location: isApron ? 'Apron' : 'Hanggar',
        registration_number: regNo,
        aircraft_type_id: parsedTypeId
      }
    },
    include: {
      assets: true,
      tenants: true
    }
  });

  const log = await prisma.operational_logs.create({
    data: {
      registration_number: regNo,
      tenant_id: tenant.id,
      asset_id: assetId,
      contract_id: contract.id,
      entry_time: today,
      parking_location: isApron ? 'Apron' : 'Hanggar',
      notes: `[PKS Pendaratan Darurat] ${emergency_reason || 'Pendaratan Darurat'}. PIC: ${pic_name} (${pic_phone || '-'})`,
      evidence_photo,
      officer_id: officer_id ? parseInt(officer_id, 10) : 1,
      billing_status: 'Unbilled'
    },
    include: {
      tenants: true,
      contracts: {
        include: {
          assets: true,
          tenants: true
        }
      },
      officer: { select: { username: true } }
    }
  });

  return {
    log,
    contract,
    tenant,
    aircraft
  };
};

exports.createLogEntry = async (data) => {
  const { registration_number, tenant_id, asset_id, contract_id, application_id, entry_time, parking_location, notes, evidence_photo, officer_id } = data;
  
  return await prisma.operational_logs.create({
    data: {
      registration_number,
      tenant_id: parseInt(tenant_id),
      asset_id: asset_id ? parseInt(asset_id) : null,
      contract_id: contract_id ? parseInt(contract_id) : null,
      application_id: application_id ? parseInt(application_id) : null,
      entry_time: new Date(entry_time || new Date()),
      parking_location: parking_location || 'Hanggar',
      notes,
      evidence_photo,
      officer_id,
      billing_status: 'Unbilled'
    }
  });
};

exports.updateLogExit = async (id, data) => {
  const { exit_time, notes } = data;
  const log = await prisma.operational_logs.findUnique({ 
    where: { id: parseInt(id) },
    include: { rental_applications: true }
  });
  
  if (!log) {
    throw new Error('Log not found');
  }

  const actualExitTime = new Date(exit_time || new Date());
  
  let is_overnight = false;
  const entryHour = log.entry_time.getHours();
  const exitHour = actualExitTime.getHours();
  if (actualExitTime.toDateString() !== log.entry_time.toDateString() || exitHour >= 17) {
    is_overnight = true;
  }
  
  let is_overstay = false;
  let overstay_days = 0;

  const billingService = require('./billingService');

  // Check overstay against rental_applications (booking) end_date
  if (log.rental_applications && log.rental_applications.end_date) {
    const bookingEnd = new Date(log.rental_applications.end_date);
    const actualExitDate = new Date(actualExitTime);
    actualExitDate.setHours(0,0,0,0);
    const bookingEndDate = new Date(bookingEnd);
    bookingEndDate.setHours(0,0,0,0);
    
    if (actualExitDate.getTime() > bookingEndDate.getTime()) {
      is_overstay = true;
      const diffTime = Math.abs(actualExitDate.getTime() - bookingEndDate.getTime());
      overstay_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    }
  }

  // Calculate parking fee (amount) based on logic
  let aircraft_type_id = null;
  if (log.rental_applications && log.rental_applications.specific_needs) {
     const specificNeeds = log.rental_applications.specific_needs;
     if (Array.isArray(specificNeeds.aircraft_details) && specificNeeds.aircraft_details.length > 0) {
        aircraft_type_id = specificNeeds.aircraft_details[0].aircraft_type_id;
     }
  }

  const total_nights = overstay_days > 0 ? overstay_days : 1;
  const parkingFee = await billingService.calculateParkingFee(log.parking_location || 'Hanggar', is_overnight, aircraft_type_id, total_nights);

  const updatedLog = await prisma.operational_logs.update({
    where: { id: parseInt(id) },
    data: {
      exit_time: actualExitTime,
      is_overnight,
      is_overstay,
      overstay_days,
      amount: parkingFee,
      ...(notes !== undefined && { notes })
    }
  });

  // Sinkronisasi status flight_schedules menjadi 'Selesai' jika armada checkout
  if (log.schedule_id) {
    await prisma.flight_schedules.update({
      where: { id: log.schedule_id },
      data: { status: 'Selesai' }
    }).catch(err => console.error('Failed to update schedule status to Selesai on exit:', err));
  } else if (log.registration_number) {
    await prisma.flight_schedules.updateMany({
      where: {
        registration_number: log.registration_number,
        status: { in: ['Checked-In', 'Disetujui'] }
      },
      data: { status: 'Selesai' }
    }).catch(err => console.error('Failed to update schedule status by regNo to Selesai on exit:', err));
  }

  return updatedLog;
};

exports.getAllLogs = async () => {
  return await prisma.operational_logs.findMany({
    include: {
      tenants: {
        select: { nama_perusahaan: true }
      },
      officer: {
        select: { username: true, role: true }
      },
      contracts: true,
      rental_applications: true
    },
    orderBy: { entry_time: 'desc' }
  });
};

exports.getActiveLogs = async () => {
  return await prisma.operational_logs.findMany({
    where: {
      exit_time: null
    },
    include: {
      tenants: {
        select: { nama_perusahaan: true }
      },
      officer: {
        select: { username: true }
      },
      contracts: {
        include: {
          assets: true,
          tenants: true
        }
      },
      rental_applications: true
    },
    orderBy: { entry_time: 'desc' }
  });
};

exports.getOverstayLogs = async () => {
  return await prisma.operational_logs.findMany({
    where: {
      is_overstay: true,
      billing_status: 'Unbilled'
    },
    include: {
      tenants: {
        select: { nama_perusahaan: true }
      },
      officer: {
        select: { username: true }
      },
      contracts: true,
      rental_applications: true
    },
    orderBy: { exit_time: 'desc' }
  });
};
