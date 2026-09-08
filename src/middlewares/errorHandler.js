/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Terjadi kesalahan pada server';

  // Handle Prisma Unique Constraint Error
  if (err.code === 'P2002') {
    statusCode = 400;
    message = 'Data yang Anda masukkan sudah terdaftar di sistem (Duplikat).';
  }
  
  // Log error stack for debugging in development
  console.error(`[Error] ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message: message,
    // Optionally include stack trace only in development
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
