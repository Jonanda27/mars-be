const taxService = require('../services/taxService');

const getAllTaxes = async (req, res, next) => {
  try {
    const { kategori, status } = req.query;
    const taxes = await taxService.getAllTaxes({ kategori, status });
    res.json({
      status: 'success',
      data: taxes
    });
  } catch (error) {
    next(error);
  }
};

const getTaxById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tax = await taxService.getTaxById(id);
    res.json({
      status: 'success',
      data: tax
    });
  } catch (error) {
    if (error.message === 'Master Tax not found') {
      return res.status(404).json({ status: 'error', message: error.message });
    }
    next(error);
  }
};

const createTax = async (req, res, next) => {
  try {
    const newTax = await taxService.createTax(req.body);
    res.status(201).json({
      status: 'success',
      data: newTax
    });
  } catch (error) {
    if (error.message === 'Kode Tax already exists') {
      return res.status(400).json({ status: 'error', message: error.message });
    }
    next(error);
  }
};

const updateTax = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await taxService.updateTax(id, req.body);
    res.json({
      status: 'success',
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

const deleteTax = async (req, res, next) => {
  try {
    const { id } = req.params;
    await taxService.deleteTax(id);
    res.json({
      status: 'success',
      message: 'Master Tax deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTaxes,
  getTaxById,
  createTax,
  updateTax,
  deleteTax
};
