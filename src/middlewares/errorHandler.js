/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  // If the error has a status code, use it. Otherwise default to 500 (Internal Server Error)
  const statusCode = err.statusCode || 500;
  
  // Log error stack for debugging in development
  console.error(`[Error] ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Terjadi kesalahan pada server',
    // Optionally include stack trace only in development
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
