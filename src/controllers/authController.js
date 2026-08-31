const authService = require('../services/authService');
const joi = require('joi');

exports.register = async (req, res, next) => {
  try {
    // Validasi input sederhana dengan Joi
    const schema = joi.object({
      username: joi.string().min(3).required(),
      password: joi.string().min(6).required(),
      nama_perusahaan: joi.string().required(),
      nib: joi.string().allow('', null),
      npwp: joi.string().allow('', null),
      alamat: joi.string().allow('', null),
      pic: joi.string().required(),
      nomor_telepon: joi.string().required(),
      email: joi.string().email().required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      const err = new Error(error.details[0].message);
      err.statusCode = 400;
      throw err;
    }

    const result = await authService.registerTenant(req.body);
    res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil. Silakan tunggu verifikasi Admin.',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      const err = new Error('Username dan Password wajib diisi');
      err.statusCode = 400;
      throw err;
    }

    const result = await authService.loginUser(username, password);
    res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    // Karena kita menggunakan JWT stateless, logout sebenarnya ditangani di frontend
    // (menghapus token dari localStorage). Endpoint ini disiapkan jika ke depannya
    // kita ingin menerapkan blacklist token atau menghapus refresh token di database.
    res.status(200).json({
      success: true,
      message: 'Logout berhasil'
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userProfile = await authService.getUserProfile(userId);
    
    res.status(200).json({
      success: true,
      message: 'Profil berhasil diambil',
      data: userProfile
    });
  } catch (error) {
    next(error);
  }
};
