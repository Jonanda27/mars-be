const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllWarnings = async (req, res, next) => {
  try {
    const warnings = await prisma.warnings.findMany({
      include: {
        tenants: true,
        invoices: true
      },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      data: warnings
    });
  } catch (error) {
    next(error);
  }
};

const getTenantWarnings = async (req, res, next) => {
  try {
    const userId = req.user.id; // From verifyToken middleware
    
    // Get tenant associated with user
    const tenant = await prisma.tenants.findFirst({
      where: { user_id: userId }
    });

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found for this user' });
    }

    const warnings = await prisma.warnings.findMany({
      where: { tenant_id: tenant.id },
      include: { invoices: true },
      orderBy: { created_at: 'desc' }
    });

    res.json({
      success: true,
      data: warnings
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllWarnings,
  getTenantWarnings
};
