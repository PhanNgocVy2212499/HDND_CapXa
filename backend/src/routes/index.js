/**
 * routes/index.js — Gom toàn bộ router Quy trình 1
 */
const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { upload } = require('../middleware/upload');
const { uploadOcrResolution, listResolutions, getResolutionDetail, getResolutionFile, banReviewResolution } = require('../controllers/resolutionController');
const { upsertTree, listIndicators, approveIndicator } = require('../controllers/indicatorController');
const { submitReport, submitReview, listReports, listReviews, getReportEvidence } = require('../controllers/reportReviewController');
const { listAuditLogs } = require('../controllers/auditController');

const router = express.Router();

// 1. Upload + OCR — Chuyên viên HĐND
router.post('/resolutions/upload-ocr',
  verifyFirebaseToken, requireRole('chuyen_vien'),
  upload.single('file'), uploadOcrResolution);

// 1b. Danh sách nghị quyết — mọi role đăng nhập (để máy/tab khác vẫn thấy)
router.get('/resolutions',
  verifyFirebaseToken, listResolutions);

// 1c. Chi tiết 1 NQ (kèm text OCR) — để mở NQ cũ làm tiếp
router.get('/resolutions/:id',
  verifyFirebaseToken, getResolutionDetail);

// 1d. File gốc của NQ — proxy qua backend, tránh 403 link Storage public
router.get('/resolutions/:id/file',
  verifyFirebaseToken, getResolutionFile);

// 1e. Ban HĐND thẩm tra cây chỉ tiêu — Ban HĐND (hoặc Thường trực)
router.post('/resolutions/:id/ban-review',
  verifyFirebaseToken, requireRole('ban_hdnd', 'thuong_truc'), banReviewResolution);

// 2. Cây chỉ tiêu — Chuyên viên dựng/trình Ban HĐND
router.post('/indicators/tree',
  verifyFirebaseToken, requireRole('chuyen_vien', 'thuong_truc'), upsertTree);

// 2b. Danh sách chỉ tiêu của 1 nghị quyết — mọi vai trò đăng nhập
router.get('/indicators',
  verifyFirebaseToken, listIndicators);

// 3. Duyệt & giao việc — Thường trực HĐND
router.put('/indicators/:id/approve',
  verifyFirebaseToken, requireRole('thuong_truc'), approveIndicator);

// 4. Báo cáo tiến độ — Cơ quan thực hiện (kèm file minh chứng field: evidence)
router.post('/reports',
  verifyFirebaseToken, requireRole('co_quan_thuc_hien'),
  upload.single('evidence'), submitReport);

// 4b. Danh sách báo cáo — mọi role đăng nhập (Ban chọn từ dropdown)
router.get('/reports',
  verifyFirebaseToken, listReports);

// 4c. File minh chứng của 1 báo cáo — proxy qua backend, mọi role đăng nhập đều xem được
// (tránh 403 khi URL Storage public chưa mở). Đặt trước route /reports/:id khác nếu có.
router.get('/reports/:id/evidence',
  verifyFirebaseToken, getReportEvidence);

// 5. Thẩm tra — Các Ban HĐND (Thường trực cũng có thể thẩm tra)
router.post('/reviews',
  verifyFirebaseToken, requireRole('ban_hdnd', 'thuong_truc'), submitReview);

// 5b. Lịch sử thẩm tra 1 báo cáo — mọi role đăng nhập
router.get('/reviews',
  verifyFirebaseToken, listReviews);

// 6. Nhật ký CSDL dùng chung (Audit Log) — mọi role đăng nhập, chỉ đọc
router.get('/audit-logs',
  verifyFirebaseToken, listAuditLogs);

module.exports = router;
