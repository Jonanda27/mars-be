const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');
const authRoutes = require('./authRoutes');
const tenantRoutes = require('./tenantRoutes');
const assetRoutes = require('./assetRoutes');
const aircraftRoutes = require('./aircraftRoutes');
const rentalRoutes = require('./rentalRoutes');

// Auth Routes
router.use('/auth', authRoutes);

// Test Routes
router.get('/test-db', testController.testDatabaseConnection);

// Entity Routes
router.use('/tenants', tenantRoutes);
router.use('/assets', assetRoutes);
router.use('/aircrafts', aircraftRoutes);
router.use('/rentals', rentalRoutes);

module.exports = router;
