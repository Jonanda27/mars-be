const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');

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
    
    // Cloudinary automatically handles file extensions, but we can preserve original name if needed
    // Removing extension from original name for public_id
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);

    let folderName = 'MARS/General';
    if (file.fieldname === 'receipt') {
      folderName = 'MARS/Receipts';
    } else if (file.fieldname === 'file' || req.body.documentType) {
      folderName = 'MARS/Legalitas';
    } else if (file.fieldname === 'asset_image') {
      folderName = 'MARS/Assets';
    } else if (file.fieldname === 'profile_picture') {
      folderName = 'MARS/Profiles';
    } else if (file.fieldname === 'log_evidence') {
      folderName = 'MARS/Logs';
    }

    return {
      folder: folderName,
      public_id: `${file.fieldname}-${basename}-${uniqueSuffix}`,
      resource_type: 'auto' // Important for non-image files like PDF
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
