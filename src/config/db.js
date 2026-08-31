const { PrismaClient } = require('@prisma/client');

// Mencegah pembuatan instance Prisma berkali-kali di lingkungan dev
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = prisma;
