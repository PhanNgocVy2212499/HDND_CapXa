/**
 * routes/index.js — Router quy trình nghị quyết HĐND cấp xã (đã chỉnh sửa theo quy trình mới)
 *
 * Quy trình:
 * 1) Bộ phận giúp việc soạn thảo nghị quyết (draft)
 * 2) Thường trực ký ban hành -> quay lại giúp việc bóc tách chỉ tiêu (issued)
 * 3) Giúp việc bóc tách chỉ tiêu (extracted/pending_distribution)
 * 4) Phân các chỉ tiêu về các ban đúng với chỉ tiêu (distributed)
 * 5) Giúp việc đẩy lên Thường trực xác nhận đã hoàn thành (pending_completion -> completed)
 */
const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { upload } = require('../middleware/upload');
const {
  uploadOcrResolution,
  listResolutions,
  getResolutionDetail,
  getResolutionFile,
  banReviewResolution,
  completeTreeAndExport,
  exportResolutionDocx,
  updateResolution,
  submitForIssue,
  issueResolution,
  extractIndicators,
  submitForCompletion,
  confirmCompletion,
} = require('../controllers/resolutionController');
const {
  upsertTree,
  listIndicators,
  approveIndicator,
  distributeIndicators,
} = require('../controllers/indicatorController');
const { submitReport, submitReview, listReports, listReviews, getReportEvidence } = require('../controllers/reportReviewController');
const { listAuditLogs } = require('../controllers/auditController');

const router = express.Router();

// 1. Soạn thảo nghị quyết — Bộ phận giúp việc (tương thích role cũ: chuyen_vien)
router.post('/resolutions/upload-ocr',
  verifyFirebaseToken, requireRole('giup_viec', 'chuyen_vien'),
  upload.single('file'), uploadOcrResolution);

// 1b. Danh sách nghị quyết — mọi role đăng nhập
router.get('/resolutions',
  verifyFirebaseToken, listResolutions);

// 1c. Chi tiết 1 nghị quyết
router.get('/resolutions/:id',
  verifyFirebaseToken, getResolutionDetail);

// 1d. File gốc nghị quyết
router.get('/resolutions/:id/file',
  verifyFirebaseToken, getResolutionFile);

// 1e. Trình Thường trực ký ban hành — Bộ phận giúp việc
router.post('/resolutions/:id/submit-issue',
  verifyFirebaseToken, requireRole('giup_viec', 'chuyen_vien'), submitForIssue);

// 1f. Thường trực ký ban hành nghị quyết
router.post('/resolutions/:id/issue',
  verifyFirebaseToken, requireRole('thuong_truc'), issueResolution);

// 1g. Cập nhật thông tin nghị quyết (soạn thảo)
router.patch('/resolutions/:id',
  verifyFirebaseToken, requireRole('giup_viec', 'chuyen_vien', 'thuong_truc'), updateResolution);
router.put('/resolutions/:id',
  verifyFirebaseToken, requireRole('giup_viec', 'chuyen_vien', 'thuong_truc'), updateResolution);

// 2. Bóc tách chỉ tiêu — Bộ phận giúp việc (sau khi Thường trực ký ban hành)
router.post('/resolutions/:id/extract-indicators',
  verifyFirebaseToken, requireRole('giup_viec', 'chuyen_vien', 'thuong_truc'), extractIndicators);
router.post('/indicators/tree',
  verifyFirebaseToken, requireRole('giup_viec', 'chuyen_vien', 'thuong_truc'), upsertTree);

// 2b. Danh sách chỉ tiêu
router.get('/indicators',
  verifyFirebaseToken, listIndicators);

// 2c. Phân các chỉ tiêu về các ban đúng với chỉ tiêu — Bộ phận giúp việc
router.post('/resolutions/:id/distribute-indicators',
  verifyFirebaseToken, requireRole('giup_viec', 'chuyen_vien', 'thuong_truc'), distributeIndicators);

// 2d. Đẩy lên Thường trực xác nhận đã hoàn thành — Bộ phận giúp việc
router.post('/resolutions/:id/submit-completion',
  verifyFirebaseToken, requireRole('giup_viec', 'chuyen_vien'), submitForCompletion);

// 2e. Thường trực xác nhận đã hoàn thành
router.post('/resolutions/:id/confirm-completion',
  verifyFirebaseToken, requireRole('thuong_truc'), confirmCompletion);

// (tương thích) Ban HĐND thẩm tra — giữ cho luồng cũ/dữ liệu cũ
router.post('/resolutions/:id/ban-review',
  verifyFirebaseToken, requireRole('ban_hdnd', 'thuong_truc'), banReviewResolution);

// Xuất Word / hoàn tất cây (tương thích)
router.post('/resolutions/:id/complete-tree',
  verifyFirebaseToken, requireRole('giup_viec', 'chuyen_vien', 'thuong_truc'), completeTreeAndExport);
router.post('/indicators/complete-tree',
  verifyFirebaseToken, requireRole('giup_viec', 'chuyen_vien', 'thuong_truc'), completeTreeAndExport);
router.get('/resolutions/:id/export-docx',
  verifyFirebaseToken, exportResolutionDocx);

// 3. (tương thích) Duyệt & giao việc — Thường trực
router.put('/indicators/:id/approve',
  verifyFirebaseToken, requireRole('thuong_truc'), approveIndicator);

// 4. Báo cáo tiến độ — Cơ quan thực hiện
router.post('/reports',
  verifyFirebaseToken, requireRole('co_quan_thuc_hien'),
  upload.single('evidence'), submitReport);
router.get('/reports', verifyFirebaseToken, listReports);
router.get('/reports/:id/evidence', verifyFirebaseToken, getReportEvidence);

// 5. Thẩm tra — Các Ban HĐND / Thường trực
router.post('/reviews',
  verifyFirebaseToken, requireRole('ban_hdnd', 'thuong_truc'), submitReview);
router.get('/reviews', verifyFirebaseToken, listReviews);

// 6. Audit log
router.get('/audit-logs', verifyFirebaseToken, listAuditLogs);

module.exports = router;
