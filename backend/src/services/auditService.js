/**
 * services/auditService.js
 * Trọng tâm CSDL dùng chung HĐND số cấp xã:
 *  - "Sản sinh dữ liệu một lần, chia sẻ sử dụng nhiều lần": mọi document đều gắn
 *    resolutionId (+ codeNumber/title denormalize) để truy vết từ NQ -> chỉ tiêu -> báo cáo -> thẩm tra.
 *  - Tự động đóng dấu thời gian: mọi ghi đều có createdAt/updatedAt/reportedAt/reviewedAt.
 *  - Lưu vết lịch sử (Audit Log): collection `auditLogs`, append-only, không update/delete.
 *  - Bắt buộc văn bản nguồn: mỗi audit của hành động ghi đều kèm sourceFileUrl (PDF NQ / evidence).
 */
const { admin, db } = require('../config/firebaseAdmin');

function now() {
  return admin.firestore.Timestamp.now();
}

/** Gắn createdAt/updatedAt cho document mới */
function stampCreate(obj = {}) {
  const t = now();
  return { ...obj, createdAt: obj.createdAt || t, updatedAt: t };
}

/** Gắn updatedAt cho document cập nhật */
function stampUpdate(obj = {}) {
  return { ...obj, updatedAt: now() };
}

/** Cắt object lớn (ocrRawText...) để audit log không phình */
function trimForAudit(obj, maxStr = 2000) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v.length > maxStr) out[k] = `${v.slice(0, maxStr)}...[cắt ${v.length - maxStr} ký tự]`;
    else if (v && typeof v === 'object' && !Array.isArray(v) && v.toDate) out[k] = v.toDate().toISOString();
    else out[k] = v;
  }
  return out;
}

/**
 * Ghi 1 dòng lịch sử. Không bao giờ làm sập request chính (try/catch nội bộ).
 * @param {object} p { collection, docId, resolutionId?, action, actor(req.user), before?, after?, sourceFileUrl?, sourceStoragePath?, message? }
 */
async function writeAudit(p = {}) {
  try {
    const ref = db.collection('auditLogs').doc();
    await ref.set({
      id: ref.id,
      collection: p.collection || '',
      docId: p.docId || '',
      resolutionId: p.resolutionId || '',
      action: p.action || 'write',
      actor: {
        uid: p.actor?.uid || 'unknown',
        email: p.actor?.email || '',
        role: p.actor?.role || '',
        departmentId: p.actor?.departmentId || '',
      },
      before: trimForAudit(p.before || null),
      after: trimForAudit(p.after || null),
      sourceFileUrl: p.sourceFileUrl || '',
      sourceStoragePath: p.sourceStoragePath || '',
      message: p.message || '',
      createdAt: now(),
    });
    return ref.id;
  } catch (e) {
    console.warn('[audit] ghi log thất bại (bỏ qua):', e.message);
    return null;
  }
}

module.exports = { now, stampCreate, stampUpdate, writeAudit, trimForAudit };
