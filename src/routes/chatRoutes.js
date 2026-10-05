const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const chatController = require('../controllers/chatController');

// Rate limiting: batasi 30 pesan per 1 menit per IP untuk AI completions
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    reply: 'Terlalu banyak permintaan dalam waktu singkat. Mohon tunggu 1 menit sebelum mengirim pesan kembali.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const otpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan OTP. Mohon tunggu 1 menit.'
  }
});

router.post('/send-otp', otpLimiter, chatController.sendOtp);
router.post('/verify-otp', chatLimiter, chatController.verifyOtp);
router.post('/', chatLimiter, chatController.handleChat);

module.exports = router;
