/**
 * routes/resolutions.js
 * POST /api/resolutions/upload-ocr — Chuyên viên HĐND
 */
const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { upload } = require('../middleware/upload');
const { uploadOcrResolution } = require('../controllers/resolutionController');

const router = express.Router();

// Thứ tự middleware quan trọng: auth -> rbac -> multer -> controller
router.post(
  '/upload-ocr',
  verifyFirebaseToken,
  requireRole('chuyen_vien'),
  upload.single('file'),
  uploadOcrResolution
);

module.exports = router;
