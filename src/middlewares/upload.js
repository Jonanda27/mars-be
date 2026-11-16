const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');
const prisma = require('../config/db');

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
      console.error('Failed to fetch tenant name for upload folder:', err);
    }
  }
  return 'General';
};

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung. Hanya file PDF, JPG, dan PNG yang diizinkan.'), false);
  }
};

const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

let storage;

if (isCloudinaryConfigured) {
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const uniqueSuffix = `${Date.now()}-${crypto.randomInt(1, 1e9)}`;
      const ext = path.extname(file.originalname);
      const basename = path.basename(file.originalname, ext);
      const companyName = await resolveCompanyName(req);
      const sanitizedCompanyName = companyName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      const subFolder = determineSubFolder(file, req.body?.documentType);
      const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'auto';
      const folderName = `MARS/Tenants/${sanitizedCompanyName}/${subFolder}`;
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
} else {
  // Local disk storage fallback for development and self-hosted instances
  const baseUploadsDir = path.join(__dirname, '../../public/uploads');
  if (!fs.existsSync(baseUploadsDir)) {
    fs.mkdirSync(baseUploadsDir, { recursive: true });
  }

  const rawDiskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      const subFolder = determineSubFolder(file, req.body?.documentType).toLowerCase();
      const targetDir = path.join(baseUploadsDir, subFolder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${crypto.randomInt(1, 1e9)}`;
      const ext = path.extname(file.originalname);
      const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      cb(null, `${file.fieldname}-${basename}-${uniqueSuffix}${ext}`);
    }
  });

  // Storage wrapper ensuring file.path is the relative web URL for frontend access
  storage = {
    _handleFile(req, file, cb) {
      rawDiskStorage._handleFile(req, file, (err, info) => {
        if (err) return cb(err);
        const subFolder = determineSubFolder(file, req.body?.documentType).toLowerCase();
        info.path = `/uploads/${subFolder}/${info.filename}`;
        cb(null, info);
      });
    },
    _removeFile(req, file, cb) {
      rawDiskStorage._removeFile(req, file, cb);
    }
  };
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});

module.exports = upload;
