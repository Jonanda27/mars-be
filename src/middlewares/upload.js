const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Konfigurasi Storage untuk Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Generate unique id
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    
    // Removing extension from original name for public_id
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);

    // Default company name fallback
    let companyName = 'General';

    // 1. Saat registrasi, ambil dari req.body
    if (req.body.nama_perusahaan) {
      companyName = req.body.nama_perusahaan;
    } 
    // 2. Saat tenant sudah login, ambil dari database menggunakan req.user.tenant_id
    else if (req.user && req.user.tenant_id) {
      try {
        const tenant = await prisma.tenants.findUnique({
          where: { id: parseInt(req.user.tenant_id) },
          select: { nama_perusahaan: true }
        });
        if (tenant && tenant.nama_perusahaan) {
          companyName = tenant.nama_perusahaan;
        }
      } catch (err) {
        console.error('Failed to fetch tenant name for Cloudinary folder:', err);
      }
    }

    // Bersihkan nama perusahaan dari karakter khusus (spasi, titik, dsb) untuk penamaan folder yang aman
    const sanitizedCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

    // Tentukan sub-folder berdasarkan jenis file
    let subFolder = 'Lainnya';
    if (file.fieldname === 'receipt') {
      subFolder = 'Pembayaran';
    } else if (file.fieldname === 'file' || req.body.documentType) {
      subFolder = 'Legalitas';
    } else if (file.fieldname === 'asset_image') {
      subFolder = 'Assets';
    } else if (file.fieldname === 'profile_picture') {
      subFolder = 'Profiles';
    } else if (file.fieldname === 'log_evidence') {
      subFolder = 'Logs';
    } else if (file.fieldname === 'signature_file') {
      subFolder = 'Kontrak';
    }

    // Tentukan resource_type berdasarkan mimetype
    const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'auto';

    const folderName = `MARS/Tenants/${sanitizedCompanyName}/${subFolder}`;

    // Tambahkan ekstensi khusus untuk tipe raw (seperti PDF) agar Cloudinary memberikan header Content-Type yang benar
    const finalPublicId = resourceType === 'raw' 
      ? `${file.fieldname}-${basename}-${uniqueSuffix}${ext}`
      : `${file.fieldname}-${basename}-${uniqueSuffix}`;

    return {
      folder: folderName,
      public_id: finalPublicId,
      resource_type: resourceType
    };
  },
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = upload;
