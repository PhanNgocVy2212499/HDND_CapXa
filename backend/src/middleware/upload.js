/**
 * middleware/upload.js
 * Multer memoryStorage: nhận PDF/ảnh, giới hạn 20MB, validate MIME.
 * File nằm ở req.file.buffer để upload trực tiếp lên Firebase Storage.
 */
const multer = require('multer');

const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Chỉ chấp nhận file PDF, PNG, JPG.'));
  },
});

module.exports = { upload };
