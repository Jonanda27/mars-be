const express = require('express');
const router = express.Router();
const cronController = require('../controllers/cronController');

router.post('/trigger-billing', cronController.triggerBilling);

module.exports = router;
