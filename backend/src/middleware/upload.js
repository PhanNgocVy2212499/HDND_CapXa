/**
 * middleware/upload.js
 * Multer memoryStorage: nhận file văn bản & minh chứng (PDF, Word, Excel, Ảnh), giới hạn 25MB.
 * File nằm ở req.file.buffer để upload trực tiếp lên Storage.
 */
const path = require('path');
const multer = require('multer');

const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/octet-stream', // Fallback cho Windows khi gửi docx/xlsx
];

const ALLOWED_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.docx', '.doc', '.xlsx', '.xls'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_MIME.includes(file.mimetype) || ALLOWED_EXTS.includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Chỉ chấp nhận file văn bản và minh chứng (PDF, Word .docx, Excel .xlsx, Ảnh PNG/JPG).'));
  },
});

module.exports = { upload };
