const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(authMiddleware);
router.use(authorizeRoles('superadmin'));

router.get('/airport-options', userController.getAirportOptions);

router
  .route('/')
  .get(userController.getAllUsers)
  .post(userController.createUser);

router
  .route('/:id')
  .put(userController.updateUser)
  .delete(userController.deleteUser);

module.exports = router;
