const express = require('express');
const router = express.Router();
const airportController = require('../controllers/airportController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router
  .route('/')
  .get(airportController.getAllAirports)
  .post(authorizeRoles('admin', 'superadmin'), airportController.createAirport);

router
  .route('/:id')
  .get(airportController.getAirportById)
  .put(authorizeRoles('admin', 'superadmin'), airportController.updateAirport)
  .delete(authorizeRoles('admin', 'superadmin'), airportController.deleteAirport);

module.exports = router;
