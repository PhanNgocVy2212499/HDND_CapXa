/**
 * controllers/auditController.js
 * GET /api/audit-logs — Nhật ký lịch sử thay đổi (minh bạch, công khai nội bộ).
 * Mọi role đăng nhập đều được xem. Append-only: không có POST/PUT/DELETE qua API.
 */
const { db } = require('../config/firebaseAdmin');

async function listAuditLogs(req, res) {
  try {
    const { resolutionId, collection, docId } = req.query;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    let q = db.collection('auditLogs');
    if (resolutionId) q = q.where('resolutionId', '==', resolutionId);
    if (collection) q = q.where('collection', '==', collection);
    if (docId) q = q.where('docId', '==', docId);
    let docs = [];
    try {
      const snap = await q.orderBy('createdAt', 'desc').limit(limit).get();
      docs = snap.docs;
    } catch (indexErr) {
      console.warn('[audit-logs] thiếu index, fallback sort tay:', indexErr.message);
      const snap = await q.limit(limit).get();
      docs = snap.docs.sort((a, b) => {
        const ta = a.data().createdAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.data().createdAt?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      });
    }
    const data = docs.map((d) => {
      const v = d.data();
      return {
        id: v.id,
        collection: v.collection,
        docId: v.docId,
        resolutionId: v.resolutionId || '',
        action: v.action,
        actor: v.actor || {},
        before: v.before || null,
        after: v.after || null,
        sourceFileUrl: v.sourceFileUrl || '',
        message: v.message || '',
        createdAt: v.createdAt?.toDate?.()?.toISOString() ?? '',
      };
    });
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi lấy nhật ký.', detail: e.message });
  }
}

module.exports = { listAuditLogs };
