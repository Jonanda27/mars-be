const express = require('express');
const router = express.Router();
const taxController = require('../controllers/taxController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router
  .route('/')
  .get(taxController.getAllTaxes)
  .post(authorizeRoles('admin', 'superadmin', 'dinas'), taxController.createTax);

router
  .route('/:id')
  .get(taxController.getTaxById)
  .put(authorizeRoles('admin', 'superadmin', 'dinas'), taxController.updateTax)
  .delete(authorizeRoles('admin', 'superadmin', 'dinas'), taxController.deleteTax);

module.exports = router;
