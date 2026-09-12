/**
 * controllers/resolutionController.js
 * POST /api/resolutions/upload-ocr
 * Luồng: validate file -> upload Storage -> OCR -> tạo resolutions/{id} status='draft'
 */
const { admin, db } = require('../config/firebaseAdmin');
const { uploadBuffer } = require('../services/storageService');
const { ocrResolutionFile } = require('../services/ocrService');
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

    // CSDL dùng chung: audit append-only + đóng dấu thời gian + gắn văn bản nguồn
    await writeAudit({
      collection: 'resolutions',
      docId: docRef.id,
      resolutionId: docRef.id,
      action: 'create_resolution',
      actor: req.user,
      after: { codeNumber: draft.codeNumber, title: draft.title, status: 'draft' },
      sourceFileUrl: fileUrl,
      sourceStoragePath: storagePath,
      message: `Upload NQ ${draft.codeNumber} (engine ${engine})`,
    });

    return res.status(201).json({
      message: 'Upload & OCR thành công. Đã tạo bản nháp, chuyên viên kiểm tra lại trước khi trình.',
      data: {
        ...draft,
        issuanceDate: draft.issuanceDate.toDate().toISOString(),
        createdAt: draft.createdAt.toDate().toISOString(),
        updatedAt: draft.updatedAt.toDate().toISOString(),
      },
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
        issuanceDate: v.issuanceDate?.toDate?.()?.toISOString() ?? null,
        ocrConfidence: v.ocrConfidence ?? 0,
        ocrEngine: v.ocrEngine ?? 'none',
        createdAt: v.createdAt?.toDate?.()?.toISOString() ?? '',
      };
    });
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi lấy danh sách nghị quyết.', detail: e.message });
  }
}

module.exports = { uploadOcrResolution, listResolutions };
