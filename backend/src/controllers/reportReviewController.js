/**
 * controllers/reportController.js + reviewController.js (gộp file cho gọn demo)
 * POST /api/reports — Cơ quan thực hiện gửi báo cáo (kèm file minh chứng)
 * POST /api/reviews — Ban HĐND thẩm tra
 */
const { admin, db, storage } = require('../config/firebaseAdmin');
const { uploadBuffer, inferStoragePathFromUrl } = require('../services/storageService');
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

    return res.status(201).json({ message: 'Đã gửi báo cáo tiến độ.', reportId: ref.id, evidenceFileUrl });
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

/**
 * GET /api/reports/:id/evidence — proxy file minh chứng qua backend (cần đăng nhập).
 * Lý do: URL Storage public có thể 403 nếu bucket chưa makePublic / Rules private.
 * Đi qua backend + verifyFirebaseToken thì Ban luôn xem được (mọi role đăng nhập).
 */
async function getReportEvidence(req, res) {
  try {
    const { id } = req.params;
    const snap = await db.collection('progressReports').doc(id).get();
    if (!snap.exists) return res.status(404).json({ message: 'Báo cáo không tồn tại.' });
    const v = snap.data();
    const mode = process.env.STORAGE_MODE || 'firebase';

    // Doc cũ thiếu evidenceStoragePath → đoán từ evidenceFileUrl rồi ghi bù
    const storagePath = v.evidenceStoragePath || inferStoragePathFromUrl(v.evidenceFileUrl, storage.name);
    if (!v.evidenceStoragePath && storagePath) {
      snap.ref.update({ evidenceStoragePath: storagePath }).catch(() => {});
    }

    // Chế độ local: file nằm ở backend/public/<storagePath> (Express đã serve static)
    if (mode === 'local') {
      const path = require('path');
      const fs = require('fs');
      const abs = path.join(__dirname, '..', '..', 'public', storagePath);
      if (storagePath && fs.existsSync(abs)) return res.sendFile(abs);
      if (v.evidenceFileUrl) return res.redirect(v.evidenceFileUrl);
      return res.status(404).json({ message: 'Không tìm thấy file minh chứng.' });
    }

    // Cloudinary: link secure_url đã public → redirect thẳng
    if (mode === 'cloudinary') {
      if (v.evidenceFileUrl) return res.redirect(v.evidenceFileUrl);
      return res.status(404).json({ message: 'Báo cáo này thiếu file minh chứng.' });
    }

    // Firebase: ưu tiên signed URL (xem được kể cả khi file private)
    if (storagePath) {
      try {
        const file = storage.file(storagePath);
        const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 3600 * 1000 });
        return res.redirect(url);
      } catch (e) {
        console.warn('[evidence] signed URL thất bại, fallback download:', e.message);
        try {
          const [buffer] = await storage.file(storagePath).download();
          const name = storagePath.split('/').pop() || 'minh-chung';
          if (/\.pdf$/i.test(name)) res.type('application/pdf');
          else if (/\.png$/i.test(name)) res.type('image/png');
          else if (/\.jpe?g$/i.test(name)) res.type('image/jpeg');
          res.set('Content-Disposition', `inline; filename="${name}"`);
          return res.send(buffer);
        } catch (e2) {
          // rơi xuống redirect public URL bên dưới
        }
      }
    }
    if (v.evidenceFileUrl) return res.redirect(v.evidenceFileUrl);
    return res.status(404).json({ message: 'Báo cáo này thiếu file minh chứng.' });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi lấy file minh chứng.', detail: e.message });
  }
}

module.exports = { submitReport, submitReview, listReports, listReviews, getReportEvidence };
