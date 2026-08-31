const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const { authMiddleware } = require('../middlewares/authMiddleware');

// All asset routes need authentication
router.use(authMiddleware);

router.get('/', assetController.getAssets);
router.get('/:id', assetController.getAsset);
router.post('/', assetController.createAsset);
router.put('/:id', assetController.updateAsset);
router.delete('/:id', assetController.deleteAsset);

module.exports = router;
