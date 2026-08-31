const express = require('express');
const router = express.Router();
const tariffController = require('../controllers/tariffController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router
  .route('/')
  .get(tariffController.getAllTariffs)
  .post(authorizeRoles('admin', 'superadmin'), tariffController.createTariff);

router
  .route('/:id')
  .get(tariffController.getTariffById)
  .put(authorizeRoles('admin', 'superadmin'), tariffController.updateTariff)
  .delete(authorizeRoles('admin', 'superadmin'), tariffController.deleteTariff);

module.exports = router;
