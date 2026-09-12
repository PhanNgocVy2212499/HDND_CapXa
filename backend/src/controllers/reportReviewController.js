/**
 * controllers/reportController.js + reviewController.js (gộp file cho gọn demo)
 * POST /api/reports — Cơ quan thực hiện gửi báo cáo (kèm file minh chứng)
 * POST /api/reviews — Ban HĐND thẩm tra
 */
const { admin, db } = require('../config/firebaseAdmin');
const { uploadBuffer } = require('../services/storageService');
const { writeAudit } = require('../services/auditService');

async function submitReport(req, res) {
  try {
    const { indicatorId, actualValue, progressPercentage, remarks, period } = req.body;
    if (!indicatorId || actualValue === undefined || progressPercentage === undefined) {
      return res.status(400).json({ message: 'Thiếu indicatorId / actualValue / progressPercentage.' });
    }
    // CSDL dùng chung: bắt buộc đính kèm văn bản nguồn (minh chứng) cho 100% báo cáo
    if (!req.file) {
      return res.status(400).json({ message: 'Bắt buộc đính kèm file minh chứng (field: evidence). Không có văn bản nguồn, báo cáo không có giá trị pháp lý.' });
    }
    const indSnap = await db.collection('indicators').doc(indicatorId).get();
    if (!indSnap.exists) return res.status(404).json({ message: 'Chỉ tiêu không tồn tại.' });
    const indicator = indSnap.data();

    const up = await uploadBuffer(req.file.buffer, req.file.originalname, req.file.mimetype, `evidences/${indicatorId}`);
    const evidenceFileUrl = up.fileUrl;
    const evidenceStoragePath = up.storagePath;

    const now = admin.firestore.Timestamp.now();
    const ref = db.collection('progressReports').doc();
    await ref.set({
      id: ref.id,
      indicatorId,
      resolutionId: indicator.resolutionId,
      // Denormalize để "chia sẻ nhiều lần" không cần join ngược
      resolutionCodeNumber: indicator.resolutionCodeNumber || '',
      indicatorTitle: indicator.title || '',
      reportedByUserId: req.user.uid,
      departmentId: req.user.departmentId || 'unknown',
      period: period || '',
      actualValue: Number(actualValue),
      progressPercentage: Math.min(100, Math.max(0, Number(progressPercentage))),
      remarks: remarks || '',
      evidenceFileUrl,
      evidenceStoragePath,
      status: 'submitted',
      reportedAt: now,
    });

    // Denormalize tiến độ mới nhất lên indicator để Dashboard query nhanh
    await indSnap.ref.update({
      currentValue: Number(actualValue),
      progressPercentage: Number(progressPercentage),
      status: 'in_progress',
      updatedAt: now,
    });

    await writeAudit({
      collection: 'progressReports',
      docId: ref.id,
      resolutionId: indicator.resolutionId,
      action: 'submit_report',
      actor: req.user,
      after: { indicatorId, actualValue: Number(actualValue), progressPercentage: Number(progressPercentage), period: period || '' },
      sourceFileUrl: evidenceFileUrl,
      sourceStoragePath: evidenceStoragePath,
      message: `Báo cáo ${period || ''} cho "${indicator.title}" kèm minh chứng bắt buộc`,
    });

    return res.status(201).json({ message: 'Đã gửi báo cáo tiến độ.', reportId: ref.id });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi gửi báo cáo.', detail: e.message });
  }
}

async function submitReview(req, res) {
  try {
    const { progressReportId, comment, status } = req.body; // status: passed | need_clarification
    if (!progressReportId || !status) {
      return res.status(400).json({ message: 'Thiếu progressReportId / status.' });
    }
    const repSnap = await db.collection('progressReports').doc(progressReportId).get();
    if (!repSnap.exists) return res.status(404).json({ message: 'Báo cáo không tồn tại.' });
    const repData = repSnap.data();
    const beforeStatus = repData.status;

    const now = admin.firestore.Timestamp.now();
    const ref = db.collection('reviews').doc();
    await ref.set({
      id: ref.id,
      progressReportId,
      indicatorId: repData.indicatorId,
      resolutionId: repData.resolutionId || '',
      reviewedByUserId: req.user.uid,
      reviewerRole: req.user.role,
      comment: comment || '',
      status,
      reviewedAt: now,
    });

    // Đồng bộ trạng thái báo cáo: passed -> approved, need_clarification -> rejected (yêu cầu làm lại)
    const nextStatus = status === 'passed' ? 'approved' : 'rejected';
    await repSnap.ref.update({
      status: nextStatus,
    });

    await writeAudit({
      collection: 'reviews',
      docId: ref.id,
      resolutionId: repData.resolutionId || '',
      action: 'submit_review',
      actor: req.user,
      before: { reportStatus: beforeStatus },
      after: { reviewStatus: status, reportStatus: nextStatus },
      sourceFileUrl: repData.evidenceFileUrl || '',
      sourceStoragePath: repData.evidenceStoragePath || '',
      message: `Thẩm tra báo cáo ${progressReportId}: ${status}`,
    });

    return res.status(201).json({ message: 'Đã ghi nhận thẩm tra.', reviewId: ref.id });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi thẩm tra.', detail: e.message });
  }
}

/**
 * GET /api/reports?resolutionId=...&indicatorId=...&limit=50
 * Mọi role đăng nhập đều xem được — để Ban chọn báo cáo từ dropdown thay vì dán ID.
 */
async function listReports(req, res) {
  try {
    const { resolutionId, indicatorId, status } = req.query;
    let q = db.collection('progressReports');
    if (resolutionId) q = q.where('resolutionId', '==', resolutionId);
    if (indicatorId) q = q.where('indicatorId', '==', indicatorId);
    if (status) q = q.where('status', '==', status);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    let docs = [];
    try {
      const snap = await q.orderBy('reportedAt', 'desc').limit(limit).get();
      docs = snap.docs;
    } catch (indexErr) {
      // Chưa tạo composite index (where + orderBy) → fallback: lấy rồi sort tay
      console.warn('[reports] thiếu index, fallback sort tay:', indexErr.message);
      const snap = await q.limit(limit).get();
      docs = snap.docs.sort((a, b) => {
        const ta = a.data().reportedAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.data().reportedAt?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      });
    }
    const data = docs.map((d) => {
      const v = d.data();
      return {
        id: v.id,
        indicatorId: v.indicatorId,
        resolutionId: v.resolutionId,
        actualValue: v.actualValue,
        progressPercentage: v.progressPercentage,
        remarks: v.remarks || '',
        period: v.period || '',
        departmentId: v.departmentId || '',
        evidenceFileUrl: v.evidenceFileUrl || '',
        status: v.status,
        reportedAt: v.reportedAt?.toDate?.()?.toISOString() ?? '',
      };
    });
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi lấy danh sách báo cáo.', detail: e.message });
  }
}

/**
 * GET /api/reviews?progressReportId=... — lịch sử thẩm tra 1 báo cáo.
 */
async function listReviews(req, res) {
  try {
    const { progressReportId } = req.query;
    if (!progressReportId) return res.status(400).json({ message: 'Thiếu progressReportId.' });
    let docs = [];
    try {
      const snap = await db
        .collection('reviews')
        .where('progressReportId', '==', progressReportId)
        .orderBy('reviewedAt', 'desc')
        .limit(50)
        .get();
      docs = snap.docs;
    } catch (indexErr) {
      console.warn('[reviews] thiếu index, fallback sort tay:', indexErr.message);
      const snap = await db
        .collection('reviews')
        .where('progressReportId', '==', progressReportId)
        .limit(50)
        .get();
      docs = snap.docs.sort((a, b) => {
        const ta = a.data().reviewedAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.data().reviewedAt?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      });
    }
    const data = docs.map((d) => {
      const v = d.data();
      return {
        id: v.id,
        status: v.status,
        comment: v.comment || '',
        reviewerRole: v.reviewerRole || '',
        reviewedAt: v.reviewedAt?.toDate?.()?.toISOString() ?? '',
      };
    });
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi lấy lịch sử thẩm tra.', detail: e.message });
  }
}

module.exports = { submitReport, submitReview, listReports, listReviews };
