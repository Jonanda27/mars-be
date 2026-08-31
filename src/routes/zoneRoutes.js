const express = require('express');
const router = express.Router();
const zoneController = require('../controllers/zoneController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router
  .route('/')
  .get(zoneController.getAllZones)
  .post(authorizeRoles('admin', 'superadmin'), zoneController.createZone);

router
  .route('/:id')
  .get(zoneController.getZoneById)
  .put(authorizeRoles('admin', 'superadmin'), zoneController.updateZone)
  .delete(authorizeRoles('admin', 'superadmin'), zoneController.deleteZone);

module.exports = router;
