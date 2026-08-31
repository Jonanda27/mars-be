const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_mars_2026';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Akses ditolak. Token tidak ditemukan');
    error.statusCode = 401;
    return next(error);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Menyimpan data user (id, role, dll) ke dalam request
    next();
  } catch (err) {
    const error = new Error('Token tidak valid atau sudah kadaluarsa');
    error.statusCode = 401;
    next(error);
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role?.toLowerCase();
    const hasRole = roles.some(r => r.toLowerCase() === userRole);
    if (!req.user || !hasRole) {
      const error = new Error(`Role Anda (${req.user?.role}) tidak memiliki izin untuk mengakses resource ini`);
      error.statusCode = 403;
      return next(error);
    }
    next();
  };
};

module.exports = {
  authMiddleware: verifyToken,
  authorizeRoles
};
