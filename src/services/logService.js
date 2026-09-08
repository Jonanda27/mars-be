const prisma = require('../config/db');

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

  return await prisma.operational_logs.update({
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
      contracts: true,
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
