const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { uploadsDir } = require('../config/env');

const abs = path.join(__dirname, '..', uploadsDir);
if (!fs.existsSync(abs)) {
  fs.mkdirSync(abs, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, abs);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname) || '.bin';
    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    cb(null, `${base}${ext}`);
  },
});

const imageFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only image uploads are allowed'));
  }
  cb(null, true);
};

const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
});

function publicUploadPath(filename) {
  return `/uploads/${filename}`;
}

module.exports = { uploadImage, publicUploadPath, uploadsAbsolute: abs };
