/**
 * controllers/resolutionController.js
 * POST /api/resolutions/upload-ocr
 * Luồng: validate file -> upload Storage -> OCR -> tạo resolutions/{id} status='draft'
 */
const { admin, db, storage } = require('../config/firebaseAdmin');
const { uploadBuffer, inferStoragePathFromUrl, serveStoredFile } = require('../services/storageService');
const { ocrResolutionFile, cleanAdministrativeWords } = require('../services/ocrService');
const { extractIndicatorsFromText } = require('../services/indicatorExtractor');
const { saveNodeRecursive } = require('./indicatorController');
const { writeAudit } = require('../services/auditService');
const { generateResolutionDocx } = require('../services/docExportService');
const { sendResolutionDocxEmail } = require('../services/mailService');
const { syncToPostgres } = require('../config/postgres');

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
      const ocr = await ocrResolutionFile(buffer, mimetype, originalname);
      fields = ocr.fields;
      ocrRawText = ocr.ocrRawText;
      confidence = ocr.confidence;
      engine = ocr.engine;
    } catch (ocrErr) {
      console.warn('[upload-ocr] OCR failed, vẫn tạo draft:', ocrErr.message);
    }

    // 3. Cho phép Frontend override (khi chuyên viên sửa tay trước khi submit,
    //    hoặc gửi kèm ngay trong form upload)
    // 3. Cho phép Frontend override chỉ khi người dùng CHỦ ĐỘNG truyền isManualOverride="true"
    // hoặc khi kết quả OCR bị trống:
    if (req.body.isManualOverride === "true") {
      if (req.body.codeNumber) fields.codeNumber = String(req.body.codeNumber);
      if (req.body.title) fields.title = String(req.body.title);
      if (req.body.signer) fields.signer = String(req.body.signer);
    } else {
      if (!fields.codeNumber && req.body.codeNumber) fields.codeNumber = String(req.body.codeNumber);
      if (!fields.title && req.body.title) fields.title = String(req.body.title);
      if (!fields.signer && req.body.signer) fields.signer = String(req.body.signer);
    }

    // 4. Tạo document nháp trong Firestore
    const now = admin.firestore.Timestamp.now();
    const docRef = db.collection('resolutions').doc();
    const draft = {
      id: docRef.id,
      codeNumber: fields.codeNumber || `NQ-XA-${docRef.id.slice(0, 6).toUpperCase()}`,
      title: fields.title || 'Nghị quyết HĐND xã (đang chờ hoàn thiện trích yếu)',
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

    // Quy trình mới: giúp việc soạn thảo (draft). Việc bóc tách chỉ tiêu thực hiện
    // SAU KHI Thường trực ký ban hành, do bộ phận giúp việc thực hiện (không tự tách tại đây).
    const extractedIndicators = [];

    // CSDL dùng chung: audit append-only + đóng dấu thời gian + gắn văn bản nguồn
    await writeAudit({
      collection: 'resolutions',
      docId: docRef.id,
      resolutionId: docRef.id,
      action: 'create_resolution',
      actor: req.user,
      after: { codeNumber: draft.codeNumber, title: draft.title, status: draft.status, extractedCount: 0 },
      sourceFileUrl: fileUrl,
      sourceStoragePath: storagePath,
      message: `Bộ phận giúp việc soạn thảo NQ ${draft.codeNumber} (engine ${engine})`,
    });

    return res.status(201).json({
      message: 'Soạn thảo/OCR thành công. Đã tạo bản nháp, chờ Thường trực ký ban hành.',
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

async function completeTreeAndExport(req, res) {
  try {
    const id = req.params.id || req.body.resolutionId;
    if (!id) return res.status(400).json({ message: 'Thiếu resolutionId.' });

    const docRef = db.collection('resolutions').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ message: 'Không tìm thấy Nghị quyết.' });

    const resData = { id: snap.id, ...snap.data() };
    const recipientEmail = req.body.recipientEmail || process.env.UBND_EMAIL || 'ubnd@xa.gov.vn';

    let indicators = [];
    const indSnap = await db.collection('indicators').where('resolutionId', '==', id).get();
    if (!indSnap.empty) {
      indicators = indSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else if (Array.isArray(req.body.tree) && req.body.tree.length > 0) {
      indicators = req.body.tree;
    }

    const docxBuffer = await generateResolutionDocx(resData, indicators);
    const safeCode = (resData.codeNumber || id).replace(/[\/\\?%*:|"<>]/g, '_');
    const fileName = `Phan_khai_chi_tieu_${safeCode}.docx`;

    const mailResult = await sendResolutionDocxEmail({
      to: recipientEmail,
      resolution: resData,
      totalIndicators: indicators.length,
      docxBuffer,
      filename: fileName,
    });

    const now = admin.firestore.Timestamp.now();
    const newFlow = ['issued', 'extracted', 'pending_distribution', 'distributed', 'pending_completion', 'completed', 'pending_issue'];
    const nextStatus = newFlow.includes(resData.status) ? (resData.status === 'issued' ? 'pending_distribution' : resData.status) : 'pending_ban_review';
    const updateData = {
      status: nextStatus,
      completedTreeAt: now,
      completedTreeBy: req.user?.email || 'chuyen_vien',
      docxFileName: fileName,
      docxExportedAt: now,
      emailSentTo: recipientEmail,
      emailStatus: mailResult.success ? 'sent' : 'failed',
      updatedAt: now,
    };
    if (mailResult.previewUrl) updateData.emailPreviewUrl = mailResult.previewUrl;
    await docRef.update(updateData);

    try {
      await syncToPostgres(
        { ...resData, ...updateData },
        indicators,
        {
          fileName,
          recipientEmail,
          emailSent: mailResult.success,
          exportedBy: req.user?.email || 'chuyen_vien',
        }
      );
    } catch (pgErr) {
      console.warn('[PostgreSQL] Bỏ qua lỗi đồng bộ PG:', pgErr.message);
    }

    await writeAudit({
      collection: 'resolutions',
      docId: id,
      resolutionId: id,
      action: 'complete_tree_and_export_docx',
      actor: req.user,
      before: { status: resData.status },
      after: { status: nextStatus, docxFileName: fileName, emailSentTo: recipientEmail, emailStatus: mailResult.success ? 'sent' : 'failed' },
      sourceFileUrl: resData.fileUrl || '',
      sourceStoragePath: resData.storagePath || '',
      message: `Chuyên viên hoàn thành cây chỉ tiêu NQ ${resData.codeNumber || id}, xuất file Word ${fileName} và gửi email thông báo đến ${recipientEmail}.`,
    });

    return res.json({
      ok: true,
      message: `Hoàn tất xử lý cây chỉ tiêu! Đã xuất file Word và gửi email thông báo thành công đến ${recipientEmail}.`,
      data: {
        id,
        codeNumber: resData.codeNumber,
        status: nextStatus,
        fileName,
        downloadUrl: `/api/resolutions/${id}/export-docx`,
        recipientEmail,
        emailResult: mailResult,
        totalIndicators: indicators.length,
      },
    });
  } catch (err) {
    console.error('[complete-tree-and-export]', err);
    return res.status(500).json({ message: 'Lỗi hoàn thành cây chỉ tiêu và xuất file.', detail: err.message });
  }
}

async function exportResolutionDocx(req, res) {
  try {
    const { id } = req.params;
    const snap = await db.collection('resolutions').doc(id).get();
    if (!snap.exists) return res.status(404).json({ message: 'Không tìm thấy Nghị quyết.' });

    const resData = { id: snap.id, ...snap.data() };
    const indSnap = await db.collection('indicators').where('resolutionId', '==', id).get();
    const indicators = indSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const docxBuffer = await generateResolutionDocx(resData, indicators);
    const rawCode = (resData.codeNumber || id).replace(/[\/\\?%*:|"<>]/g, '_');
    const asciiCode = rawCode
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9_\-]/g, '_');
    const asciiFileName = `Phan_khai_chi_tieu_${asciiCode}.docx`;
    const utf8FileName = encodeURIComponent(`Phan_khai_chi_tieu_${rawCode}.docx`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiFileName}"; filename*=UTF-8''${utf8FileName}`);
    return res.send(docxBuffer);
  } catch (err) {
    console.error('[export-docx]', err);
    return res.status(500).json({ message: 'Lỗi xuất file Word.', detail: err.message });
  }
}


/**
 * Cập nhật thông tin nghị quyết (số hiệu, trích yếu, người ký, ngày ban hành)
 */
async function updateResolution(req, res) {
  try {
    const { id } = req.params;
    const { codeNumber, title, signer, issuanceDate } = req.body;
    const docRef = db.collection("resolutions").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ message: "Không tìm thấy nghị quyết." });

    const updateData = { updatedAt: admin.firestore.Timestamp.now() };
    if (codeNumber !== undefined) updateData.codeNumber = String(codeNumber).trim();
    if (title !== undefined) updateData.title = String(title).trim();
    if (signer !== undefined) updateData.signer = String(signer).trim();
    if (issuanceDate) updateData.issuanceDate = admin.firestore.Timestamp.fromDate(new Date(issuanceDate));

    await docRef.update(updateData);
    const updated = (await docRef.get()).data();
    return res.json({ ok: true, data: { ...updated, id } });
  } catch (err) {
    console.error("[updateResolution]", err);
    return res.status(500).json({ message: "Lỗi cập nhật nghị quyết.", detail: err.message });
  }
}

/** Bộ phận giúp việc trình Thường trực ký ban hành (draft/revision -> pending_issue) */
async function submitForIssue(req, res) {
  try {
    const { id } = req.params;
    const ref = db.collection('resolutions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: 'Không tìm thấy nghị quyết.' });
    const before = snap.data();
    if (!['draft', 'revision_requested'].includes(before.status)) {
      return res.status(400).json({ message: `Chỉ trình ký khi nghị quyết đang soạn thảo (trạng thái hiện tại: ${before.status}).` });
    }
    const now = admin.firestore.Timestamp.now();
    await ref.update({ status: 'pending_issue', updatedAt: now });
    await writeAudit({
      collection: 'resolutions', docId: id, resolutionId: id, action: 'submit_for_issue',
      actor: req.user, before: { status: before.status }, after: { status: 'pending_issue' },
      sourceFileUrl: before.fileUrl || '', sourceStoragePath: before.storagePath || '',
      message: `Bộ phận giúp việc trình Thường trực ký ban hành NQ ${before.codeNumber || id}`,
    });
    return res.json({ message: 'Đã trình Thường trực ký ban hành.', data: { id, status: 'pending_issue' } });
  } catch (e) {
    console.error('[submit-issue]', e);
    return res.status(500).json({ message: 'Lỗi trình ký ban hành.', detail: e.message });
  }
}

/** Thường trực ký ban hành nghị quyết (draft/pending_issue -> issued) */
async function issueResolution(req, res) {
  try {
    const { id } = req.params;
    const ref = db.collection('resolutions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: 'Không tìm thấy nghị quyết.' });
    const before = snap.data();
    if (!['draft', 'pending_issue'].includes(before.status)) {
      return res.status(400).json({ message: `Chỉ ký ban hành khi nghị quyết đang soạn thảo/chờ ký (trạng thái hiện tại: ${before.status}).` });
    }
    const now = admin.firestore.Timestamp.now();
    await ref.update({
      status: 'issued',
      issuedAt: now,
      issuedBy: req.user?.email || req.user?.uid || '',
      updatedAt: now,
    });
    await writeAudit({
      collection: 'resolutions', docId: id, resolutionId: id, action: 'issue_resolution',
      actor: req.user, before: { status: before.status }, after: { status: 'issued' },
      sourceFileUrl: before.fileUrl || '', sourceStoragePath: before.storagePath || '',
      message: `Thường trực đã ký ban hành NQ ${before.codeNumber || id}. Chuyển về bộ phận giúp việc bóc tách chỉ tiêu.`,
    });
    return res.json({ message: 'Thường trực đã ký ban hành. Bộ phận giúp việc tiến hành bóc tách chỉ tiêu.', data: { id, status: 'issued' } });
  } catch (e) {
    console.error('[issue]', e);
    return res.status(500).json({ message: 'Lỗi ký ban hành.', detail: e.message });
  }
}

/** Bộ phận giúp việc đẩy lên Thường trực xác nhận hoàn thành (distributed -> pending_completion) */
async function submitForCompletion(req, res) {
  try {
    const { id } = req.params;
    const ref = db.collection('resolutions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: 'Không tìm thấy nghị quyết.' });
    const before = snap.data();
    if (!['distributed', 'extracted', 'pending_distribution', 'issued', 'approved', 'pending_approval'].includes(before.status)) {
      return res.status(400).json({ message: `Chưa thể đẩy lên xác nhận hoàn thành ở trạng thái hiện tại: ${before.status}.` });
    }
    const now = admin.firestore.Timestamp.now();
    await ref.update({ status: 'pending_completion', submittedCompletionAt: now, updatedAt: now });
    await writeAudit({
      collection: 'resolutions', docId: id, resolutionId: id, action: 'submit_for_completion',
      actor: req.user, before: { status: before.status }, after: { status: 'pending_completion' },
      sourceFileUrl: before.fileUrl || '', sourceStoragePath: before.storagePath || '',
      message: `Bộ phận giúp việc đẩy NQ ${before.codeNumber || id} lên Thường trực xác nhận hoàn thành`,
    });
    return res.json({ message: 'Đã đẩy lên Thường trực xác nhận hoàn thành.', data: { id, status: 'pending_completion' } });
  } catch (e) {
    console.error('[submit-completion]', e);
    return res.status(500).json({ message: 'Lỗi đẩy lên xác nhận hoàn thành.', detail: e.message });
  }
}

/** Thường trực xác nhận đã hoàn thành (pending_completion -> completed) */
/** Bộ phận giúp việc tự bóc tách chỉ tiêu từ OCR (sau khi Thường trực ký ban hành) */
async function extractIndicators(req, res) {
  try {
    const { id } = req.params;
    const ref = db.collection('resolutions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: 'Không tìm thấy nghị quyết.' });
    const resData = snap.data();
    if (!['issued', 'extracted', 'pending_distribution'].includes(resData.status)) {
      return res.status(400).json({ message: `Chỉ bóc tách chỉ tiêu sau khi Thường trực ký ban hành (trạng thái: ${resData.status}).` });
    }
    // Re-clean OCR text để áp dụng các rule mới bổ sung (sửa lỗi dấu chữ)
    const ocrRawText = cleanAdministrativeWords(resData.ocrRawText || '');
    if (!ocrRawText.trim()) return res.status(400).json({ message: 'Nghị quyết không có nội dung OCR để bóc tách. Vui lòng nhập chỉ tiêu thủ công.' });

    const base = resData.issuanceDate?.toDate?.() || new Date();
    const baseMs = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
    const defaultDeadline = new Date(baseMs + 90 * 86400000).toISOString().slice(0, 10);
    const { tree, total } = extractIndicatorsFromText(ocrRawText, { defaultDeadline });
    if (!tree.length) return res.status(400).json({ message: 'Không tự nhận diện được chỉ tiêu từ văn bản. Vui lòng nhập thủ công.' });

    // Xóa chỉ tiêu cũ của NQ này (nếu có) rồi lưu kết quả bóc tách mới
    const oldSnap = await db.collection('indicators').where('resolutionId', '==', id).get();
    const batch = db.batch();
    oldSnap.docs.forEach((d) => batch.delete(d.ref));
    const saved = [];
    const ctx = { id, codeNumber: resData.codeNumber || '', fileUrl: resData.fileUrl || '' };
    for (const node of tree) await saveNodeRecursive(batch, node, ctx, null, saved);
    const now = admin.firestore.Timestamp.now();
    batch.update(ref, { status: 'pending_distribution', extractedAt: now, updatedAt: now });
    await batch.commit();

    await writeAudit({
      collection: 'indicators', docId: id, resolutionId: id, action: 'extract_indicators',
      actor: req.user, before: { status: resData.status }, after: { status: 'pending_distribution', count: saved.length },
      sourceFileUrl: resData.fileUrl || '', sourceStoragePath: resData.storagePath || '',
      message: `Bộ phận giúp việc bóc tách ${saved.length} chỉ tiêu từ OCR NQ ${resData.codeNumber || id}`,
    });
    return res.json({ message: `Đã bóc tách ${saved.length} chỉ tiêu. Kiểm tra và phân về các ban đúng với chỉ tiêu.`, indicators: saved, resolutionStatus: 'pending_distribution' });
  } catch (e) {
    console.error('[extract-indicators]', e);
    return res.status(500).json({ message: 'Lỗi bóc tách chỉ tiêu.', detail: e.message });
  }
}

async function confirmCompletion(req, res) {
  try {
    const { id } = req.params;
    const ref = db.collection('resolutions').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: 'Không tìm thấy nghị quyết.' });
    const before = snap.data();
    if (before.status !== 'pending_completion' && before.status !== 'distributed') {
      return res.status(400).json({ message: `Chỉ xác nhận hoàn thành khi đã được đẩy lên (trạng thái hiện tại: ${before.status}).` });
    }
    const now = admin.firestore.Timestamp.now();
    await ref.update({
      status: 'completed',
      completedAt: now,
      completedConfirmedBy: req.user?.email || req.user?.uid || '',
      updatedAt: now,
    });
    // Đánh dấu chỉ tiêu đã phân bổ là hoàn tất xử lý (không ghi đè in_progress nếu đang theo dõi)
    const indSnap = await db.collection('indicators').where('resolutionId', '==', id).get();
    if (!indSnap.empty) {
      const batch = db.batch();
      indSnap.docs.forEach((d) => {
        const st = d.data().status;
        if (st !== 'in_progress') batch.update(d.ref, { status: 'completed', updatedAt: now });
      });
      await batch.commit();
    }
    await writeAudit({
      collection: 'resolutions', docId: id, resolutionId: id, action: 'confirm_completion',
      actor: req.user, before: { status: before.status }, after: { status: 'completed' },
      sourceFileUrl: before.fileUrl || '', sourceStoragePath: before.storagePath || '',
      message: `Thường trực xác nhận NQ ${before.codeNumber || id} đã hoàn thành`,
    });
    return res.json({ message: 'Thường trực đã xác nhận hoàn thành.', data: { id, status: 'completed' } });
  } catch (e) {
    console.error('[confirm-completion]', e);
    return res.status(500).json({ message: 'Lỗi xác nhận hoàn thành.', detail: e.message });
  }
}

module.exports = {
  completeTreeAndExport,
  exportResolutionDocx,
  uploadOcrResolution,
  listResolutions,
  getResolutionDetail,
  getResolutionFile,
  banReviewResolution,
  updateResolution,
  submitForIssue,
  issueResolution,
  extractIndicators,
  submitForCompletion,
  confirmCompletion,
};
