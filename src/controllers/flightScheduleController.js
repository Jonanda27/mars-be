const flightScheduleService = require('../services/flightScheduleService');
const tenantService = require('../services/tenantService');

exports.createSchedule = async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenantByUserId(req.user.id);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const fileUrl = req.file ? (req.file.path || req.file.secure_url) : null;
    const schedule = await flightScheduleService.createSchedule(tenant.id, req.body, fileUrl);

    res.status(201).json({
      success: true,
      data: schedule,
      message: 'Jadwal pemakaian hanggar berhasil diajukan. Menunggu verifikasi Petugas Lapangan.'
    });
  } catch (error) {
    next(error);
  }
};

exports.getTenantSchedules = async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenantByUserId(req.user.id);
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const schedules = await flightScheduleService.getTenantSchedules(tenant.id);
    res.json({ success: true, data: schedules });
  } catch (error) {
    next(error);
  }
};

exports.getAllSchedules = async (req, res, next) => {
  try {
    const schedules = await flightScheduleService.getAllSchedules(req.query);
    res.json({ success: true, data: schedules });
  } catch (error) {
    next(error);
  }
};

exports.verifySchedule = async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    const officerId = req.user.id;
    const schedule = await flightScheduleService.verifyScheduleByOfficer(scheduleId, officerId, req.body);

    res.json({
      success: true,
      data: schedule,
      message: `Jadwal berhasil diverifikasi dengan status: ${schedule.status}`
    });
  } catch (error) {
    next(error);
  }
};

exports.getTodayExpectedArrivals = async (req, res, next) => {
  try {
    const arrivals = await flightScheduleService.getTodayExpectedArrivals();
    res.json({ success: true, data: arrivals });
  } catch (error) {
    next(error);
  }
};

exports.checkInFromSchedule = async (req, res, next) => {
  try {
    const scheduleId = req.params.id;
    const officerId = req.user.id;
    const log = await flightScheduleService.checkInFromSchedule(scheduleId, officerId, req.body);

    res.status(201).json({
      success: true,
      data: log,
      message: 'Pesawat berhasil di-check in masuk hanggar dari jadwal terverifikasi'
    });
  } catch (error) {
    next(error);
  }
};
