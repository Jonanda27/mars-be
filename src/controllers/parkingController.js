const parkingService = require('../services/parkingService');
const Joi = require('joi');

/**
 * Controller Penanganan Request Parkir Manual (Fase 1)
 */

// POST /api/parking/books
const createBook = async (req, res, next) => {
  try {
    const schema = Joi.object({
      kode_buku: Joi.string().trim().max(50).required().messages({
        'string.empty': 'Kode buku tidak boleh kosong',
        'any.required': 'Kode buku wajib diisi'
      }),
      jenis_karcis: Joi.string().trim().max(50).required().messages({
        'string.empty': 'Jenis karcis tidak boleh kosong',
        'any.required': 'Jenis karcis wajib dipilih'
      }),
      seri_awal: Joi.number().integer().positive().required().messages({
        'number.base': 'Seri awal harus berupa angka',
        'number.positive': 'Seri awal harus lebih besar dari 0',
        'any.required': 'Seri awal wajib diisi'
      }),
      seri_akhir: Joi.number().integer().min(Joi.ref('seri_awal')).required().messages({
        'number.base': 'Seri akhir harus berupa angka',
        'number.min': 'Seri akhir harus lebih besar atau sama dengan seri awal',
        'any.required': 'Seri akhir wajib diisi'
      }),
      nominal_per_lembar: Joi.number().positive().required().messages({
        'number.base': 'Nominal per lembar harus berupa angka',
        'number.positive': 'Nominal per lembar harus lebih dari 0',
        'any.required': 'Nominal per lembar wajib diisi'
      }),
      airport_id: Joi.number().integer().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const newBook = await parkingService.createTicketBook(req.user, value);
    res.status(201).json({
      status: 'success',
      message: 'Buku karcis baru berhasil ditambahkan ke inventaris',
      data: newBook
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/parking/books/available
const getAvailableBooks = async (req, res, next) => {
  try {
    const { airport_id } = req.query;
    const books = await parkingService.getAvailableBooks(req.user, airport_id);
    res.json({
      status: 'success',
      data: books
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/parking/books
const getAllBooks = async (req, res, next) => {
  try {
    const { airport_id, status, jenis_karcis } = req.query;
    const books = await parkingService.getAllBooks(req.user, { airport_id, status, jenis_karcis });
    res.json({
      status: 'success',
      data: books
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/parking/handovers
const dispatchBooklet = async (req, res, next) => {
  try {
    const schema = Joi.object({
      book_id: Joi.number().integer().positive().required().messages({
        'number.base': 'ID Buku karcis harus berupa angka',
        'any.required': 'Buku karcis wajib dipilih'
      }),
      warden_name: Joi.string().trim().min(2).max(100).required().messages({
        'string.empty': 'Nama juru parkir tidak boleh kosong',
        'string.min': 'Nama juru parkir minimal 2 karakter',
        'any.required': 'Nama juru parkir wajib diisi'
      }),
      dispatched_serial_start: Joi.number().integer().positive().required().messages({
        'number.base': 'Seri awal penugasan harus berupa angka',
        'any.required': 'Seri awal penugasan wajib diisi'
      }),
      dispatched_serial_end: Joi.number().integer().min(Joi.ref('dispatched_serial_start')).required().messages({
        'number.base': 'Seri akhir penugasan harus berupa angka',
        'number.min': 'Seri akhir penugasan harus >= seri awal penugasan',
        'any.required': 'Seri akhir penugasan wajib diisi'
      })
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const handover = await parkingService.dispatchBooklet(req.user, value);
    res.status(201).json({
      status: 'success',
      message: 'Buku karcis berhasil dialokasikan ke juru parkir',
      data: handover
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/parking/handovers/:id/settle
const settleHandover = async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = Joi.object({
      last_returned_serial: Joi.number().integer().positive().required().messages({
        'number.base': 'Nomor seri sisa karcis harus berupa angka',
        'any.required': 'Nomor seri sisa karcis wajib diisi'
      }),
      actual_cash_settled: Joi.number().min(0).required().messages({
        'number.base': 'Jumlah uang fisik yang disetor harus berupa angka',
        'number.min': 'Uang fisik yang disetor tidak boleh minus',
        'any.required': 'Jumlah uang fisik yang disetor wajib diisi'
      }),
      notes: Joi.string().allow('', null).optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const settled = await parkingService.settleHandover(req.user, id, value);
    res.json({
      status: 'success',
      message: 'Setoran dan rekonsiliasi karcis berhasil diselesaikan',
      data: settled
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/parking/handovers/active
const getActiveHandovers = async (req, res, next) => {
  try {
    const { airport_id } = req.query;
    const active = await parkingService.getActiveHandovers(req.user, airport_id);
    res.json({
      status: 'success',
      data: active
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/parking/handovers/history
const getHandoverHistory = async (req, res, next) => {
  try {
    const { airport_id, status, warden_name, start_date, end_date } = req.query;
    const history = await parkingService.getHandoverHistory(req.user, {
      airport_id,
      status,
      warden_name,
      start_date,
      end_date
    });
    res.json({
      status: 'success',
      data: history
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/parking/reports/reconciliation
const getReconciliationReport = async (req, res, next) => {
  try {
    const { airport_id, start_date, end_date } = req.query;
    const report = await parkingService.getReconciliationReport(req.user, {
      airport_id,
      start_date,
      end_date
    });
    res.json({
      status: 'success',
      data: report
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBook,
  getAvailableBooks,
  getAllBooks,
  dispatchBooklet,
  settleHandover,
  getActiveHandovers,
  getHandoverHistory,
  getReconciliationReport
};
