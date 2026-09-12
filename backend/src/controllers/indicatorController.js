/**
 * controllers/indicatorController.js
 * POST /api/indicators/tree       — Chuyên viên dựng cây chỉ tiêu (đệ quy)
 * GET  /api/indicators?resolutionId=... — Lấy danh sách chỉ tiêu của 1 nghị quyết
 * PUT  /api/indicators/:id/approve — Thường trực duyệt + giao việc + deadline
 */
const { admin, db } = require('../config/firebaseAdmin');
const { writeAudit } = require('../services/auditService');

/** Lưu đệ quy 1 node + children trong 1 batch, gom danh sách đã lưu vào `out` */
async function saveNodeRecursive(batch, node, resolutionCtx, parentId = null, out = []) {
  const col = db.collection('indicators');
  const ref = node.id ? col.doc(node.id) : col.doc();
  const now = admin.firestore.Timestamp.now();
  const snap = node.id ? await ref.get() : null;

  batch.set(
    ref,
    {
      id: ref.id,
      resolutionId: resolutionCtx.id,
      // Denormalize "sản sinh 1 lần, dùng nhiều lần": truy vết NQ gốc không cần join
      resolutionCodeNumber: resolutionCtx.codeNumber || '',
      resolutionFileUrl: resolutionCtx.fileUrl || '',
      parentId,
      title: node.title,
      targetValue: Number(node.targetValue),
      unit: node.unit,
      frequency: node.frequency || 'quarterly',
      deadline: admin.firestore.Timestamp.fromDate(new Date(node.deadline)),
      status: snap?.exists ? snap.data().status : 'draft',
      assignedDepartments: node.assignedDepartments || [],
      createdAt: snap?.exists ? snap.data().createdAt : now,
      updatedAt: now,
    },
    { merge: true }
  );
  out.push({
    id: ref.id,
    title: node.title,
    parentId,
    deadline: node.deadline,
    dept: node.assignedDepartments?.[0]?.departmentId || 'ubnd-xa',
    role: node.assignedDepartments?.[0]?.role || 'primary',
  });

  for (const child of node.children || []) {
    await saveNodeRecursive(batch, child, resolutionCtx, ref.id, out);
  }
  return ref.id;
}

async function upsertTree(req, res) {
  try {
    const { resolutionId, tree } = req.body; // tree: IndicatorTreeNodeInput[]
    if (!resolutionId || !Array.isArray(tree)) {
      return res.status(400).json({ message: 'Body cần { resolutionId, tree: [...] }.' });
    }
    // Lấy NQ gốc để denormalize + gắn văn bản nguồn vào audit
    const resSnap = await db.collection('resolutions').doc(resolutionId).get();
    if (!resSnap.exists) return res.status(404).json({ message: 'Nghị quyết không tồn tại.' });
    const resData = resSnap.data();
    const resolutionCtx = {
      id: resolutionId,
      codeNumber: resData.codeNumber || '',
      fileUrl: resData.fileUrl || '',
    };
    const batch = db.batch();
    const saved = [];
    for (const node of tree) await saveNodeRecursive(batch, node, resolutionCtx, node.parentId ?? null, saved);
    await batch.commit();

    const beforeStatus = resData.status || 'draft';
    await db.collection('resolutions').doc(resolutionId).update({
      status: 'pending_approval',
      updatedAt: admin.firestore.Timestamp.now(),
    });

    await writeAudit({
      collection: 'indicators',
      docId: resolutionId,
      resolutionId,
      action: 'upsert_tree',
      actor: req.user,
      before: { resolutionStatus: beforeStatus },
      after: { savedCount: saved.length, resolutionStatus: 'pending_approval', indicators: saved.map((s) => s.id) },
      sourceFileUrl: resData.fileUrl || '',
      sourceStoragePath: resData.storagePath || '',
      message: `Dựng cây ${saved.length} chỉ tiêu cho NQ ${resData.codeNumber}`,
    });
    return res.json({
      message: `Đã lưu ${saved.length} chỉ tiêu và trình Thường trực phê duyệt.`,
      indicators: saved,
    });
  } catch (e) {
    console.error('[indicators/tree]', e);
    return res.status(500).json({ message: 'Lỗi lưu cây chỉ tiêu.', detail: e.message });
  }
}

/** GET /api/indicators?resolutionId=... — mọi vai trò đăng nhập đều được xem */
async function listIndicators(req, res) {
  try {
    const { resolutionId } = req.query;
    if (!resolutionId) return res.status(400).json({ message: 'Thiếu resolutionId.' });
    const snap = await db.collection('indicators').where('resolutionId', '==', resolutionId).get();
    const items = snap.docs
      .map((d) => {
        const v = d.data();
        return {
          id: v.id,
          title: v.title,
          parentId: v.parentId ?? null,
          targetValue: v.targetValue,
          unit: v.unit,
          frequency: v.frequency,
          deadline: v.deadline?.toDate?.()?.toISOString().slice(0, 10) ?? null,
          status: v.status,
          assignedDepartments: v.assignedDepartments || [],
          createdAt: v.createdAt?.toDate?.()?.toISOString() ?? '',
        };
      })
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return res.json({ data: items });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi lấy danh sách chỉ tiêu.', detail: e.message });
  }
}

async function approveIndicator(req, res) {
  try {
    const { id } = req.params;
    const { assignedDepartments, deadline, status } = req.body;
    const ref = db.collection('indicators').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ message: 'Không tìm thấy chỉ tiêu.' });
    const before = snap.data();

    await ref.update({
      ...(assignedDepartments && { assignedDepartments }),
      ...(deadline && { deadline: admin.firestore.Timestamp.fromDate(new Date(deadline)) }),
      status: status || 'assigned',
      updatedAt: admin.firestore.Timestamp.now(),
    });

    await writeAudit({
      collection: 'indicators',
      docId: id,
      resolutionId: before.resolutionId || '',
      action: 'approve_indicator',
      actor: req.user,
      before: { status: before.status, assignedDepartments: before.assignedDepartments, deadline: before.deadline?.toDate?.()?.toISOString?.() ?? null },
      after: { status: status || 'assigned', assignedDepartments: assignedDepartments || before.assignedDepartments, deadline: deadline || null },
      sourceFileUrl: before.resolutionFileUrl || '',
      message: `Duyệt & giao việc chỉ tiêu "${before.title}"`,
    });
    return res.json({ message: `Đã duyệt & giao việc chỉ tiêu ${id}.` });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi phê duyệt.', detail: e.message });
  }
}

module.exports = { upsertTree, listIndicators, approveIndicator };
