/**
 * controllers/resolutionController.js
 * POST /api/resolutions/upload-ocr
 * Luồng: validate file -> upload Storage -> OCR -> tạo resolutions/{id} status='draft'
 */
const { admin, db, storage } = require('../config/firebaseAdmin');
const { uploadBuffer, inferStoragePathFromUrl, serveStoredFile } = require('../services/storageService');
const { ocrResolutionFile } = require('../services/ocrService');
const { extractIndicatorsFromText } = require('../services/indicatorExtractor');
const { saveNodeRecursive } = require('./indicatorController');
const { writeAudit } = require('../services/auditService');

/**
 * Chuyên viên HĐND upload PDF Nghị quyết, hệ thống OCR auto-fill.
 * Nhận: multipart/form-data { file: PDF/PNG/JPG, title?, codeNumber? (override tay) }
 * Trả: resolution draft + fields OCR để Frontend hiển thị form bên phải.
 */
async function uploadOcrResolution(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn file PDF/Ảnh nghị quyết (field: file).' });
    }
    const { buffer, originalname, mimetype } = req.file;

    // 1. Upload file gốc lên Firebase Storage
    const year = new Date().getFullYear();
    const { fileUrl, storagePath } = await uploadBuffer(
      buffer, originalname, mimetype, `resolutions/${year}`
    );

    // 2. OCR trích xuất thông tin (không để OCR làm sập request nếu Vision lỗi)
    let fields = { codeNumber: '', title: '', issuanceDate: new Date(), signer: '' };
    let ocrRawText = '';
    let confidence = 0;
    let engine = 'none';
    try {
      const ocr = await ocrResolutionFile(buffer, mimetype);
      fields = ocr.fields;
      ocrRawText = ocr.ocrRawText;
      confidence = ocr.confidence;
      engine = ocr.engine;
    } catch (ocrErr) {
      console.warn('[upload-ocr] OCR failed, vẫn tạo draft:', ocrErr.message);
    }

    // 3. Cho phép Frontend override (khi chuyên viên sửa tay trước khi submit,
    //    hoặc gửi kèm ngay trong form upload)
    if (req.body.codeNumber) fields.codeNumber = String(req.body.codeNumber);
    if (req.body.title) fields.title = String(req.body.title);
    if (req.body.signer) fields.signer = String(req.body.signer);

    // 4. Tạo document nháp trong Firestore
    const now = admin.firestore.Timestamp.now();
    const docRef = db.collection('resolutions').doc();
    const draft = {
      id: docRef.id,
      codeNumber: fields.codeNumber || `DRAFT-${docRef.id.slice(0, 6).toUpperCase()}`,
      title: fields.title || 'Nghị quyết (đang chờ hoàn thiện trích yếu)',
      issuanceDate: admin.firestore.Timestamp.fromDate(new Date(fields.issuanceDate)),
      signer: fields.signer || '',
      fileUrl,
      storagePath,
      status: 'draft',
      ocrRawText,
      ocrConfidence: confidence,
      ocrEngine: engine,
      createdByUserId: req.user?.uid || 'unknown',
      createdAt: now,
      updatedAt: now,
    };
    await docRef.set(draft);

    // 5. Tự tách chỉ tiêu từ văn bản OCR → khỏi nhập tay ở Cây chỉ tiêu.
    // Thất bại thì bỏ qua êm (giữ NQ draft, chuyên viên nhập tay như cũ).
    let extractedIndicators = [];
    if (ocrRawText && ocrRawText.trim().length >= 50) {
      try {
        const base = new Date(fields.issuanceDate);
        const baseMs = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
        const defaultDeadline = new Date(baseMs + 90 * 86400000).toISOString().slice(0, 10);
        const { tree } = extractIndicatorsFromText(ocrRawText, { defaultDeadline });
        if (tree.length) {
          const batch = db.batch();
          const saved = [];
          const ctx = { id: docRef.id, codeNumber: draft.codeNumber, fileUrl };
          for (const node of tree) await saveNodeRecursive(batch, node, ctx, null, saved);
          await batch.commit();
          extractedIndicators = saved;
          draft.status = 'pending_ban_review';
          await docRef.update({
            status: 'pending_ban_review',
            updatedAt: admin.firestore.Timestamp.now(),
          });
        }
      } catch (extractErr) {
        console.warn('[upload-ocr] auto-extract bỏ qua:', extractErr.message);
      }
    }

    // CSDL dùng chung: audit append-only + đóng dấu thời gian + gắn văn bản nguồn
    await writeAudit({
      collection: 'resolutions',
      docId: docRef.id,
      resolutionId: docRef.id,
      action: 'create_resolution',
      actor: req.user,
      after: { codeNumber: draft.codeNumber, title: draft.title, status: draft.status, extractedCount: extractedIndicators.length },
      sourceFileUrl: fileUrl,
      sourceStoragePath: storagePath,
      message: `Upload NQ ${draft.codeNumber} (engine ${engine})` + (extractedIndicators.length ? `, tự tách ${extractedIndicators.length} chỉ tiêu` : ''),
    });

    return res.status(201).json({
      message: 'Upload & OCR thành công. Đã tạo bản nháp, chuyên viên kiểm tra lại trước khi trình.',
      data: {
        ...draft,
        issuanceDate: draft.issuanceDate.toDate().toISOString(),
        createdAt: draft.createdAt.toDate().toISOString(),
        updatedAt: draft.updatedAt.toDate().toISOString(),
      },
      extractedIndicators,
    });
  } catch (err) {
    console.error('[upload-ocr] error:', err);
    if (err.message?.includes('Chỉ chấp nhận file')) {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: 'Lỗi xử lý upload/OCR.', detail: err.message });
  }
}

/**
 * GET /api/resolutions — mọi role đăng nhập đều được xem (để tab/máy khác
 * vẫn thấy NQ do chuyên viên tạo, khỏi phụ thuộc RAM/localStorage).
 */
async function listResolutions(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const snap = await db.collection('resolutions').orderBy('createdAt', 'desc').limit(limit).get();
    const data = snap.docs.map((d) => {
      const v = d.data();
      return {
        id: v.id,
        codeNumber: v.codeNumber || '',
        title: v.title || '',
        status: v.status || 'draft',
        signer: v.signer || '',
        fileUrl: v.fileUrl || '',
        storagePath: v.storagePath || '',
        issuanceDate: v.issuanceDate?.toDate?.()?.toISOString() ?? null,
        ocrConfidence: v.ocrConfidence ?? 0,
        ocrEngine: v.ocrEngine ?? 'none',
        banReview: v.banReview ? {
          status: v.banReview.status,
          comment: v.banReview.comment || '',
          reviewedBy: v.banReview.reviewedBy || '',
          reviewedAt: v.banReview.reviewedAt?.toDate?.()?.toISOString() ?? null,
        } : null,
        createdAt: v.createdAt?.toDate?.()?.toISOString() ?? '',
      };
    });
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi lấy danh sách nghị quyết.', detail: e.message });
  }
}

/**
 * GET /api/resolutions/:id — chi tiết 1 NQ (kèm ocrRawText để tab Text OCR xem lại,
 * fileUrl/storagePath để khung PDF gốc tải qua server khi link public lỗi).
 */
async function getResolutionDetail(req, res) {
  try {
    const snap = await db.collection('resolutions').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ message: 'Nghị quyết không tồn tại.' });
    const v = snap.data();
    return res.json({
      data: {
        id: v.id,
        codeNumber: v.codeNumber || '',
        title: v.title || '',
        status: v.status || 'draft',
        signer: v.signer || '',
        fileUrl: v.fileUrl || '',
        storagePath: v.storagePath || '',
        issuanceDate: v.issuanceDate?.toDate?.()?.toISOString() ?? null,
        banReview: v.banReview ? {
          status: v.banReview.status,
          comment: v.banReview.comment || '',
          reviewedBy: v.banReview.reviewedBy || '',
          reviewedAt: v.banReview.reviewedAt?.toDate?.()?.toISOString() ?? null,
        } : null,
        ocrRawText: v.ocrRawText || '',
        ocrConfidence: v.ocrConfidence ?? 0,
        ocrEngine: v.ocrEngine || 'none',
        createdAt: v.createdAt?.toDate?.()?.toISOString() ?? '',
        updatedAt: v.updatedAt?.toDate?.()?.toISOString() ?? '',
      },
    });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi lấy chi tiết nghị quyết.', detail: e.message });
  }
}

/**
 * GET /api/resolutions/:id/file — proxy/stream file gốc qua backend (cần đăng nhập).
 * Stream trực tiếp từ Cloudinary (vượt qua ACL deny và CORS header), Firebase Storage, hoặc Local disk.
 */
async function getResolutionFile(req, res) {
  try {
    const snap = await db.collection('resolutions').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ message: 'Nghị quyết không tồn tại.' });
    const v = snap.data();

    // Doc cũ thiếu storagePath → đoán từ fileUrl rồi ghi bù để lần sau khỏi đoán
    const storagePath = v.storagePath || inferStoragePathFromUrl(v.fileUrl, storage.name);
    if (!v.storagePath && storagePath) {
      snap.ref.update({ storagePath }).catch(() => {});
    }

    const fallbackName = `${(v.codeNumber || 'nghi-quyet').replace(/[^\w.\-]+/g, '_')}.pdf`;
    return serveStoredFile({
      req,
      res,
      fileUrl: v.fileUrl,
      storagePath,
      fallbackName,
    });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi lấy file gốc.', detail: e.message });
  }
}

/**
 * POST /api/resolutions/:id/ban-review — Ban HĐND xã thẩm tra cây chỉ tiêu trước khi chuyển Thường trực
 * Body: { status: 'approved' | 'rejected', comment: string }
 * - approved: chuyển sang pending_approval (Thường trực HĐND bắt đầu duyệt & giao việc)
 * - rejected: chuyển sang revision_requested (yêu cầu Chuyên viên sửa lại)
 */
async function banReviewResolution(req, res) {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        message: 'Trạng thái thẩm tra phải là "approved" (đồng ý) hoặc "rejected" (yêu cầu sửa).',
      });
    }

    const docRef = db.collection('resolutions').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ message: 'Không tìm thấy Nghị quyết.' });
    }

    const resData = snap.data();
    const now = admin.firestore.Timestamp.now();
    const isApproved = status === 'approved';
    const nextStatus = isApproved ? 'pending_approval' : 'revision_requested';

    const banReviewData = {
      status,
      comment: (comment || '').trim() || (isApproved ? 'Ban HĐND đồng ý thông qua cây chỉ tiêu.' : 'Ban HĐND yêu cầu chỉnh sửa cây chỉ tiêu.'),
      reviewedBy: req.user.email || req.user.uid,
      reviewedByUid: req.user.uid,
      reviewedAt: now,
    };

    await docRef.update({
      status: nextStatus,
      banReview: banReviewData,
      updatedAt: now,
    });

    // Cập nhật trạng thái các chỉ tiêu thuộc NQ
    const indSnap = await db.collection('indicators').where('resolutionId', '==', id).get();
    if (!indSnap.empty) {
      const batch = db.batch();
      indSnap.docs.forEach((d) => {
        batch.update(d.ref, {
          status: isApproved ? 'pending_approval' : 'revision_requested',
          updatedAt: now,
        });
      });
      await batch.commit();
    }

    // Ghi audit log truy vết CSDL dùng chung
    await writeAudit({
      collection: 'resolutions',
      docId: id,
      resolutionId: id,
      action: 'ban_review_resolution',
      actor: req.user,
      before: { status: resData.status, banReview: resData.banReview || null },
      after: { status: nextStatus, banReview: banReviewData },
      sourceFileUrl: resData.fileUrl || '',
      sourceStoragePath: resData.storagePath || '',
      message: isApproved
        ? `Ban HĐND đồng ý thông qua cây chỉ tiêu NQ ${resData.codeNumber || id}, chuyển Thường trực duyệt.`
        : `Ban HĐND yêu cầu chỉnh sửa cây chỉ tiêu NQ ${resData.codeNumber || id}: ${banReviewData.comment}`,
    });

    return res.json({
      message: isApproved
        ? 'Ban HĐND đã đồng ý thông qua cây chỉ tiêu. Đã báo sang Thường trực để phê duyệt & giao việc.'
        : 'Ban HĐND đã gửi yêu cầu chỉnh sửa cây chỉ tiêu về Chuyên viên.',
      data: {
        id,
        status: nextStatus,
        banReview: {
          ...banReviewData,
          reviewedAt: now.toDate().toISOString(),
        },
      },
    });
  } catch (e) {
    console.error('[resolutions/ban-review]', e);
    return res.status(500).json({ message: 'Lỗi thẩm tra cây chỉ tiêu.', detail: e.message });
  }
}

module.exports = {
  uploadOcrResolution,
  listResolutions,
  getResolutionDetail,
  getResolutionFile,
  banReviewResolution,
};
