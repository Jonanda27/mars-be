const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const upload = require('../middlewares/upload');

router.get('/', tenantController.getTenants);
router.get('/:id', tenantController.getTenant);
router.post('/', tenantController.createTenant);
router.put('/:id/verify', tenantController.verifyTenant);
router.post('/:id/legalitas', upload.single('file'), tenantController.uploadLegalitas);

module.exports = router;
