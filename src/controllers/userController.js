const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await prisma.users.findMany({
      include: {
        airports: true,
        mini_airports: true,
      },
      orderBy: { id: 'asc' },
    });

    const sanitizedUsers = users.map((u) => {
      let airportInfo = null;
      if (u.airports) {
        airportInfo = {
          id: u.airports.id,
          kode_bandara: u.airports.kode_bandara,
          nama_bandara: u.airports.nama_bandara,
          type: 'main',
          label: `[Bandara Utama] ${u.airports.nama_bandara} (${u.airports.kode_bandara})`,
        };
      } else if (u.mini_airports) {
        airportInfo = {
          id: u.mini_airports.id,
          kode_bandara: u.mini_airports.kode_bandara,
          nama_bandara: u.mini_airports.nama_bandara,
          type: 'mini',
          label: `[Mini Airport] ${u.mini_airports.nama_bandara} (${u.mini_airports.kode_bandara})`,
        };
      }

      return {
        id: u.id,
        username: u.username,
        role: u.role,
        airport_id: u.airport_id,
        mini_airport_id: u.mini_airport_id,
        airport: airportInfo,
        created_at: u.created_at,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Berhasil mengambil daftar pengguna',
      data: sanitizedUsers,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAirportOptions = async (req, res, next) => {
  try {
    const [mainAirports, miniAirports] = await Promise.all([
      prisma.airports.findMany({ orderBy: { nama_bandara: 'asc' } }),
      prisma.mini_airports.findMany({ orderBy: { nama_bandara: 'asc' } }),
    ]);

    const formattedOptions = [
      ...mainAirports.map((a) => ({
        id: a.id,
        kode: a.kode_bandara,
        nama: a.nama_bandara,
        lokasi: a.lokasi,
        type: 'main',
        value: `main:${a.id}`,
        label: `[Bandara Utama] ${a.nama_bandara} (${a.kode_bandara})`,
      })),
      ...miniAirports.map((m) => ({
        id: m.id,
        kode: m.kode_bandara,
        nama: m.nama_bandara,
        lokasi: m.lokasi,
        type: 'mini',
        value: `mini:${m.id}`,
        label: `[Mini Airport] ${m.nama_bandara} (${m.kode_bandara})`,
      })),
    ];

    res.status(200).json({
      success: true,
      data: {
        all_options: formattedOptions,
        main_airports: mainAirports,
        mini_airports: miniAirports,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const { username, password, role, airport_type, airport_id, mini_airport_id } = req.body;

    if (!username || !password || !role) {
      const err = new Error('Username, password, dan role wajib diisi');
      err.statusCode = 400;
      throw err;
    }

    if (password.length < 6) {
      const err = new Error('Password minimal harus 6 karakter');
      err.statusCode = 400;
      throw err;
    }

    // Check unique username
    const existing = await prisma.users.findUnique({
      where: { username: username.trim() },
    });
    if (existing) {
      const err = new Error(`Username "${username}" sudah digunakan. Silakan gunakan username lain.`);
      err.statusCode = 400;
      throw err;
    }

    // Parse airport selection
    let assignedAirportId = null;
    let assignedMiniAirportId = null;

    if (airport_type === 'mini' || mini_airport_id || role === 'admin_mini_airport' || role === 'petugas_mini_airport') {
      assignedMiniAirportId = Number.parseInt(mini_airport_id || airport_id, 10) || null;
    } else if (airport_type === 'main' || airport_id || role === 'admin' || role === 'petugas' || role === 'petugas lapangan') {
      assignedAirportId = Number.parseInt(airport_id || 1, 10);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await prisma.users.create({
      data: {
        username: username.trim(),
        password_hash,
        role: role.trim().toLowerCase(),
        airport_id: assignedAirportId,
        mini_airport_id: assignedMiniAirportId,
      },
      include: {
        airports: true,
        mini_airports: true,
      },
    });

    res.status(201).json({
      success: true,
      message: `Akun pengguna ${newUser.username} berhasil dibuat`,
      data: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        airport_id: newUser.airport_id,
        mini_airport_id: newUser.mini_airport_id,
        created_at: newUser.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = Number.parseInt(id, 10);
    const { username, password, role, airport_type, airport_id, mini_airport_id } = req.body;

    const existingUser = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      const err = new Error('Akun pengguna tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    const updateData = {};

    if (username && username.trim() !== existingUser.username) {
      const duplicate = await prisma.users.findUnique({
        where: { username: username.trim() },
      });
      if (duplicate) {
        const err = new Error(`Username "${username}" sudah digunakan`);
        err.statusCode = 400;
        throw err;
      }
      updateData.username = username.trim();
    }

    if (role) {
      updateData.role = role.trim().toLowerCase();
    }

    if (password && password.trim()) {
      if (password.length < 6) {
        const err = new Error('Password baru minimal harus 6 karakter');
        err.statusCode = 400;
        throw err;
      }
      const salt = await bcrypt.genSalt(10);
      updateData.password_hash = await bcrypt.hash(password, salt);
    }

    // Airport assignment handling
    if (airport_type !== undefined || airport_id !== undefined || mini_airport_id !== undefined || role !== undefined) {
      const effectiveRole = (role || existingUser.role || '').toLowerCase();
      const isMiniRole = effectiveRole === 'admin_mini_airport' || effectiveRole === 'petugas_mini_airport' || effectiveRole === 'petugas lapangan mini airport';
      const isMainRole = effectiveRole === 'admin' || effectiveRole === 'petugas' || effectiveRole === 'petugas lapangan';

      if (airport_type === 'mini' || (isMiniRole && airport_type !== 'none')) {
        const targetMiniId = mini_airport_id || airport_id;
        updateData.mini_airport_id = targetMiniId ? Number.parseInt(targetMiniId, 10) : existingUser.mini_airport_id;
        updateData.airport_id = null;
      } else if (airport_type === 'main' || (isMainRole && airport_type !== 'none')) {
        const targetMainId = airport_id || (airport_type === 'main' ? 1 : existingUser.airport_id);
        updateData.airport_id = targetMainId ? Number.parseInt(targetMainId, 10) : 1;
        updateData.mini_airport_id = null;
      } else if (airport_type === 'none' || (!airport_id && !mini_airport_id && !isMiniRole && !isMainRole)) {
        updateData.airport_id = null;
        updateData.mini_airport_id = null;
      }
    }

    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: updateData,
      include: {
        airports: true,
        mini_airports: true,
      },
    });

    res.status(200).json({
      success: true,
      message: `Akun ${updatedUser.username} berhasil diperbarui`,
      data: {
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
        airport_id: updatedUser.airport_id,
        mini_airport_id: updatedUser.mini_airport_id,
        created_at: updatedUser.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = Number.parseInt(id, 10);

    const targetUser = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      const err = new Error('Akun pengguna tidak ditemukan');
      err.statusCode = 404;
      throw err;
    }

    // Prevent deleting oneself
    if (req.user && req.user.id === userId) {
      const err = new Error('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif');
      err.statusCode = 400;
      throw err;
    }

    // Prevent deleting root super_admin account
    if (targetUser.username === 'super_admin') {
      const err = new Error('Akun utama super_admin dilindungi dan tidak dapat dihapus');
      err.statusCode = 403;
      throw err;
    }

    await prisma.users.delete({
      where: { id: userId },
    });

    res.status(200).json({
      success: true,
      message: `Akun ${targetUser.username} berhasil dihapus`,
    });
  } catch (error) {
    next(error);
  }
};
