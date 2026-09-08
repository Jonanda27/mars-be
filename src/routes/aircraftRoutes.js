const express = require('express');
const router = express.Router();
const aircraftController = require('../controllers/aircraftController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

// Tenant Routes
router.get('/tenant', authMiddleware, authorizeRoles('Tenant'), aircraftController.getTenantAircrafts);
router.post('/tenant', authMiddleware, authorizeRoles('Tenant'), aircraftController.createTenantAircraft);
router.put('/tenant/:id', authMiddleware, authorizeRoles('Tenant'), aircraftController.updateTenantAircraft);
router.delete('/tenant/:id', authMiddleware, authorizeRoles('Tenant'), aircraftController.deleteTenantAircraft);

// General/Admin Routes
router.get('/', aircraftController.getAircrafts);
router.get('/types/master', aircraftController.getAircraftTypes);
router.get('/:id', aircraftController.getAircraft);
router.post('/', aircraftController.createAircraft);

module.exports = router;
