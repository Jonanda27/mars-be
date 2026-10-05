const path = require('node:path');
const crypto = require('node:crypto');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const prisma = require('../config/db');

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const SUB_FOLDER_MAP = {
  receipt: 'Pembayaran',
  asset_image: 'Assets',
  profile_picture: 'Profiles',
  log_evidence: 'Logs',
  signature_file: 'Kontrak',
  official_letter: 'Permohonan'
};

const determineSubFolder = (file, documentType) => {
  if (SUB_FOLDER_MAP[file.fieldname]) {
    return SUB_FOLDER_MAP[file.fieldname];
  }
  if (file.fieldname === 'file' || documentType) {
    return 'Legalitas';
  }
  return 'Lainnya';
};

const resolveCompanyName = async (req) => {
  if (req.body?.nama_perusahaan) {
    return req.body.nama_perusahaan;
  }
  if (req.user?.nama_perusahaan) {
    return req.user.nama_perusahaan;
  }
  if (req.user?.tenant_id) {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: Number.parseInt(req.user.tenant_id, 10) },
        select: { nama_perusahaan: true }
      });
      if (tenant?.nama_perusahaan) {
        return tenant.nama_perusahaan;
      }
    } catch (err) {
      console.error('Failed to fetch tenant name for Cloudinary folder:', err);
    }
  }
  // Cek jika route memiliki parameter invoice id (misal: /api/invoices/:id/upload-receipt)
  if (req.params?.id && !Number.isNaN(Number(req.params.id))) {
    try {
      const inv = await prisma.invoices.findUnique({
        where: { id: Number.parseInt(req.params.id, 10) },
        include: { tenants: { select: { nama_perusahaan: true } } }
      });
      if (inv?.tenants?.nama_perusahaan) {
        return inv.tenants.nama_perusahaan;
      }
    } catch (err) {
      console.error('Failed to fetch invoice tenant name for Cloudinary folder:', err);
    }
  }
  // Cek jika route adalah pembayaran darurat via token (/api/invoices/emergency-payment/:token/upload)
  if (req.params?.token) {
    try {
      const inv = await prisma.invoices.findFirst({
        where: {
          OR: [
            { invoice_number: req.params.token },
            { details: { path: ['tokenDarurat'], equals: req.params.token } }
          ]
        },
        include: { tenants: { select: { nama_perusahaan: true } } }
      });
      if (inv?.tenants?.nama_perusahaan) {
        return inv.tenants.nama_perusahaan;
      }
    } catch (err) {
      console.error('Failed to fetch emergency invoice tenant name for Cloudinary folder:', err);
    }
  }
  return 'General';
};

// Konfigurasi Storage untuk Multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // Generate unique id using safe random integer
    const uniqueSuffix = `${Date.now()}-${crypto.randomInt(1, 1e9)}`;
    
    // Removing extension from original name for public_id
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);

    const companyName = await resolveCompanyName(req);

    // Bersihkan nama perusahaan dari karakter khusus (spasi, titik, dsb) untuk penamaan folder yang aman
    const sanitizedCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const subFolder = determineSubFolder(file, req.body?.documentType);

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
