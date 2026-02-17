const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { uploadPath, maxFileSize, allowedFileTypes } = require('../config');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  return process.env.CLOUDINARY_CLOUD_NAME &&
         process.env.CLOUDINARY_API_KEY &&
         process.env.CLOUDINARY_API_SECRET;
};

// Cloudinary storage configuration
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'sample-management';

    if (file.fieldname === 'sampleImage') {
      folder = 'sample-management/samples';
    } else if (file.fieldname === 'locationImage') {
      folder = 'sample-management/locations';
    }

    return {
      folder: folder,
      allowed_formats: ['jpg', 'jpeg', 'png'],
      transformation: [{ width: 1024, height: 1024, crop: 'limit' }]
    };
  }
});

// Local storage configuration (fallback)
const ensureUploadDir = () => {
  const dirs = [
    uploadPath,
    path.join(uploadPath, 'samples'),
    path.join(uploadPath, 'locations')
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    let uploadDir = uploadPath;

    if (file.fieldname === 'sampleImage') {
      uploadDir = path.join(uploadPath, 'samples');
    } else if (file.fieldname === 'locationImage') {
      uploadDir = path.join(uploadPath, 'locations');
    }

    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, JPG, and PNG are allowed.'), false);
  }
};

// Choose storage based on Cloudinary configuration
const storage = isCloudinaryConfigured() ? cloudinaryStorage : localStorage;

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize
  }
});

const sampleUpload = upload.fields([
  { name: 'sampleImage', maxCount: 1 },
  { name: 'locationImage', maxCount: 1 }
]);

// Delete file from Cloudinary or local storage
const deleteFile = async (fileUrl) => {
  if (!fileUrl) return;

  try {
    if (isCloudinaryConfigured() && fileUrl.includes('cloudinary')) {
      // Extract public_id from Cloudinary URL
      const parts = fileUrl.split('/');
      const filename = parts[parts.length - 1];
      const publicId = filename.split('.')[0];
      const folder = parts[parts.length - 2];
      await cloudinary.uploader.destroy(`sample-management/${folder}/${publicId}`);
    } else {
      // Delete local file
      const filePath = path.join(__dirname, '..', fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

// Get file URL from uploaded file
const getFileUrl = (file) => {
  if (!file) return null;

  // Cloudinary returns path property with full URL
  if (file.path && file.path.includes('cloudinary')) {
    return file.path;
  }

  // Local storage - construct URL
  if (file.filename) {
    const folder = file.fieldname === 'sampleImage' ? 'samples' : 'locations';
    return `/uploads/${folder}/${file.filename}`;
  }

  return null;
};

// Process uploaded files and return URLs
const processUploadedFiles = (files) => {
  const result = {
    sampleImageUrl: null,
    locationImageUrl: null
  };

  if (files) {
    if (files.sampleImage && files.sampleImage[0]) {
      result.sampleImageUrl = getFileUrl(files.sampleImage[0]);
    }
    if (files.locationImage && files.locationImage[0]) {
      result.locationImageUrl = getFileUrl(files.locationImage[0]);
    }
  }

  return result;
};

module.exports = {
  upload,
  sampleUpload,
  deleteFile,
  getFileUrl,
  processUploadedFiles,
  ensureUploadDir,
  cloudinary,
  isCloudinaryConfigured
};
