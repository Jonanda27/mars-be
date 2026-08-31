const prisma = require('../config/db');

exports.checkDatabaseStatus = async () => {
  try {
    // Jalankan simple query pake Prisma
    await prisma.$queryRaw`SELECT 1`;
    
    return {
      status: 'success',
      message: 'Database PostgreSQL berhasil terhubung melalui Prisma ORM!',
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Gagal terhubung ke Database');
  }
};
