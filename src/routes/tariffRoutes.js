const express = require('express');
const router = express.Router();
const prisma = require('../config/db');

router.get('/', async (req, res, next) => {
  try {
    const tariffs = await prisma.master_tariffs.findMany({
      orderBy: { id: 'asc' }
    });
    res.status(200).json({ success: true, data: tariffs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
