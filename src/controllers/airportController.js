const airportService = require('../services/airportService');

const getAllAirports = async (req, res, next) => {
  try {
    const airports = await airportService.getAllAirports();
    res.json({
      status: 'success',
      data: airports
    });
  } catch (error) {
    next(error);
  }
};

const getAirportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const airport = await airportService.getAirportById(id);
    res.json({
      status: 'success',
      data: airport
    });
  } catch (error) {
    if (error.message === 'Airport not found') {
      return res.status(404).json({ status: 'error', message: error.message });
    }
    next(error);
  }
};

const createAirport = async (req, res, next) => {
  try {
    const newAirport = await airportService.createAirport(req.body);
    res.status(201).json({
      status: 'success',
      data: newAirport
    });
  } catch (error) {
    if (error.message === 'Kode Bandara already exists') {
      return res.status(400).json({ status: 'error', message: error.message });
    }
    next(error);
  }
};

const updateAirport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const airport = await airportService.updateAirport(id, req.body);
    res.json({
      status: 'success',
      data: airport
    });
  } catch (error) {
    next(error);
  }
};

const deleteAirport = async (req, res, next) => {
  try {
    const { id } = req.params;
    await airportService.deleteAirport(id);
    res.json({
      status: 'success',
      message: 'Airport deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAirports,
  getAirportById,
  createAirport,
  updateAirport,
  deleteAirport
};
