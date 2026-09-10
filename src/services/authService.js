const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_mars_2026';
const { sendOtpEmail } = require('./emailService');

exports.requestOtp = async (email) => {
  // Generate 6 digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await prisma.otps.upsert({
    where: { email },
    update: {
      otp_code: otpCode,
      expires_at: expiresAt,
      created_at: new Date()
    },
    create: {
      email,
      otp_code: otpCode,
      expires_at: expiresAt
    }
  });

  return await sendOtpEmail(email, otpCode);
};

exports.registerTenant = async (data) => {
  const { username, password, nama_perusahaan, jenis_tenant, nib, npwp, alamat, pic, nomor_telepon, email, otp_code } = data;

  // Validate OTP
  const otpRecord = await prisma.otps.findUnique({ where: { email } });
  if (!otpRecord) {
    const error = new Error('Minta OTP terlebih dahulu');
    error.statusCode = 400;
    throw error;
  }
  if (otpRecord.otp_code !== otp_code) {
    const error = new Error('Kode OTP salah');
    error.statusCode = 400;
    throw error;
  }
  if (new Date() > otpRecord.expires_at) {
    const error = new Error('Kode OTP sudah kadaluarsa');
    error.statusCode = 400;
    throw error;
  }

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
        jenis_tenant: jenis_tenant || 'Maskapai',
        nib,
        npwp,
        alamat,
        pic,
        nomor_telepon,
        email,
        status_verifikasi: 'Pending'
      }
    });

    await tx.otps.delete({ where: { email } });

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
    airport_id: user.airport_id,
    tenant_id: tenantData ? tenantData.id : null,
    tenant_id_str: tenantData ? tenantData.tenant_id_str : null,
    nama_perusahaan: tenantData ? tenantData.nama_perusahaan : null,
    jenis_tenant: tenantData ? tenantData.jenis_tenant : null,
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
    airport_id: user.airport_id,
    tenant_id: tenantData ? tenantData.id : null,
    tenant_id_str: tenantData ? tenantData.tenant_id_str : null,
    nama_perusahaan: tenantData ? tenantData.nama_perusahaan : null,
    jenis_tenant: tenantData ? tenantData.jenis_tenant : null,
    status_verifikasi: tenantData ? tenantData.status_verifikasi : null
  };
};
