const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_mars_2026';

exports.registerTenant = async (data) => {
  const { username, password, nama_perusahaan, nib, npwp, alamat, pic, nomor_telepon, email } = data;

  const existingUser = await prisma.users.findUnique({
    where: { username }
  });

  if (existingUser) {
    const error = new Error('Username sudah digunakan');
    error.statusCode = 400;
    throw error;
  }

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  // Prisma Transaction
  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.users.create({
      data: {
        username,
        password_hash,
        role: 'Tenant',
      }
    });

    const newTenant = await tx.tenants.create({
      data: {
        user_id: newUser.id,
        nama_perusahaan,
        nib,
        npwp,
        alamat,
        pic,
        nomor_telepon,
        email,
        status_verifikasi: 'Pending'
      }
    });

    return { user: { id: newUser.id, username: newUser.username, role: newUser.role }, tenant: newTenant };
  });

  return result;
};

exports.loginUser = async (username, password) => {
  const user = await prisma.users.findUnique({
    where: { username },
    include: {
      tenants: true
    }
  });

  if (!user) {
    const error = new Error('Username atau Password salah');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const error = new Error('Username atau Password salah');
    error.statusCode = 401;
    throw error;
  }

  const tenantData = user.tenants && user.tenants.length > 0 ? user.tenants[0] : null;

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    tenant_id: tenantData ? tenantData.id : null,
    tenant_id_str: tenantData ? tenantData.tenant_id_str : null,
    status_verifikasi: tenantData ? tenantData.status_verifikasi : null
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });

  return { token, user: payload };
};

exports.getUserProfile = async (userId) => {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: {
      tenants: true
    }
  });

  if (!user) {
    const error = new Error('User tidak ditemukan');
    error.statusCode = 404;
    throw error;
  }

  const tenantData = user.tenants && user.tenants.length > 0 ? user.tenants[0] : null;

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    tenant_id: tenantData ? tenantData.id : null,
    tenant_id_str: tenantData ? tenantData.tenant_id_str : null,
    nama_perusahaan: tenantData ? tenantData.nama_perusahaan : null,
    status_verifikasi: tenantData ? tenantData.status_verifikasi : null
  };
};
