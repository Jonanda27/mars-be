const express = require('express');
const router = express.Router();
const authRoutes = require('./authRoutes');
const tenantRoutes = require('./tenantRoutes');
const assetRoutes = require('./assetRoutes');
const aircraftRoutes = require('./aircraftRoutes');
const rentalRoutes = require('./rentalRoutes');
const contractRoutes = require('./contractRoutes');
const invoiceRoutes = require('./invoiceRoutes');
const warningRoutes = require('./warningRoutes');
const tariffRoutes = require('./tariffRoutes');
const airportRoutes = require('./airportRoutes');
const zoneRoutes = require('./zoneRoutes');
const parkingRoutes = require('./parkingRoutes');

// Auth Routes
router.use('/auth', authRoutes);

// Entity Routes
router.use('/tenants', tenantRoutes);
router.use('/assets', assetRoutes);
router.use('/aircrafts', aircraftRoutes);
router.use('/rentals', rentalRoutes);
router.use('/contracts', contractRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/warnings', warningRoutes);
router.use('/tariffs', tariffRoutes);
router.use('/airports', airportRoutes);
router.use('/zones', zoneRoutes);
router.use('/parking', parkingRoutes);

module.exports = router;

