const tariffService = require('../services/tariffService');

const getAllTariffs = async (req, res, next) => {
  try {
    const tariffs = await tariffService.getAllTariffs();
    res.json({
      status: 'success',
      data: tariffs
    });
  } catch (error) {
    next(error);
  }
};

const getTariffById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tariff = await tariffService.getTariffById(id);
    res.json({
      status: 'success',
      data: tariff
    });
  } catch (error) {
    if (error.message === 'Tariff not found') {
      return res.status(404).json({ status: 'error', message: error.message });
    }
    next(error);
  }
};

const createTariff = async (req, res, next) => {
  try {
    const newTariff = await tariffService.createTariff(req.body);
    res.status(201).json({
      status: 'success',
      data: newTariff
    });
  } catch (error) {
    if (error.message === 'Kode Tarif already exists') {
      return res.status(400).json({ status: 'error', message: error.message });
    }
    next(error);
  }
};

const updateTariff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tariff = await tariffService.updateTariff(id, req.body);
    res.json({
      status: 'success',
      data: tariff
    });
  } catch (error) {
    next(error);
  }
};

const deleteTariff = async (req, res, next) => {
  try {
    const { id } = req.params;
    await tariffService.deleteTariff(id);
    res.json({
      status: 'success',
      message: 'Tariff deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTariffs,
  getTariffById,
  createTariff,
  updateTariff,
  deleteTariff
};
