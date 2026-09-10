const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const rateLimit = require('express-rate-limit');

const { authMiddleware } = require('../middlewares/authMiddleware');

// Batasan: maksimal 3 request per IP setiap 5 menit
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 3, 
  message: {
    success: false,
    message: "Terlalu banyak permintaan OTP dari IP Anda, silakan coba lagi setelah 5 menit."
  },
  standardHeaders: true, 
  legacyHeaders: false, 
});

router.post('/request-otp', otpLimiter, authController.requestOtp);
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
