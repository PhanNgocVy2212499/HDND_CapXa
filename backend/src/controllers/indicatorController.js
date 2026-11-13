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
    targetValue: node.targetValue,
    unit: node.unit,
    frequency: node.frequency || 'quarterly',
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

    // Quy trình mới: bóc tách chỉ tiêu sau khi Thường trực ký ban hành
    const beforeStatus = resData.status || 'draft';
    const allowed = new Set(['issued', 'extracted', 'pending_distribution', 'distributed', 'draft', 'pending_ban_review', 'revision_requested', 'pending_approval', 'approved', 'pending_completion']);
    if (!allowed.has(beforeStatus)) {
      return res.status(400).json({ message: `Không thể bóc tách chỉ tiêu ở trạng thái "${beforeStatus}". Cần Thường trực ký ban hành trước.` });
    }

    const resolutionCtx = {
      id: resolutionId,
      codeNumber: resData.codeNumber || '',
      fileUrl: resData.fileUrl || '',
    };
    const batch = db.batch();
    const saved = [];
    for (const node of tree) await saveNodeRecursive(batch, node, resolutionCtx, node.parentId ?? null, saved);
    await batch.commit();

    // Nếu đã ký ban hành (luồng mới) -> chờ phân chỉ tiêu; nếu luồng cũ -> giữ hành vi cũ
    const nextStatus = (['issued', 'extracted', 'pending_distribution', 'distributed'].includes(beforeStatus))
      ? 'pending_distribution'
      : 'pending_ban_review';
    await db.collection('resolutions').doc(resolutionId).update({
      status: nextStatus,
      extractedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    await writeAudit({
      collection: 'indicators',
      docId: resolutionId,
      resolutionId,
      action: 'upsert_tree',
      actor: req.user,
      before: { resolutionStatus: beforeStatus },
      after: { savedCount: saved.length, resolutionStatus: nextStatus, indicators: saved.map((s) => s.id) },
      sourceFileUrl: resData.fileUrl || '',
      sourceStoragePath: resData.storagePath || '',
      message: `Bộ phận giúp việc bóc tách/lưu ${saved.length} chỉ tiêu cho NQ ${resData.codeNumber}`,
    });
    return res.json({
      message: `Đã bóc tách và lưu ${saved.length} chỉ tiêu. Tiếp tục phân chỉ tiêu về các ban đúng với chỉ tiêu.`,
      indicators: saved,
      resolutionStatus: nextStatus,
    });
  } catch (e) {
    console.error('[indicators/tree]', e);
    return res.status(500).json({ message: 'Lỗi lưu/bóc tách chỉ tiêu.', detail: e.message });
  }
}

/** GET /api/indicators?resolutionId=...&limit=... — mọi vai trò đăng nhập đều được xem
 * - Có resolutionId: chỉ tiêu của 1 nghị quyết (giữ nguyên cho các màn nghiệp vụ).
 * - Không có resolutionId: tất cả chỉ tiêu (mới nhất trước, giới hạn limit) để Tổng quan
 *   tổng hợp nhiều nghị quyết mà không cần gọi N lần.
 */
async function listIndicators(req, res) {
  try {
    const { resolutionId } = req.query;
    const limit = Math.min(Number(req.query.limit) || 200, 500);
    const mapItem = (d) => {
      const v = d.data();
      return {
        id: v.id,
        title: v.title,
        parentId: v.parentId ?? null,
        resolutionId: v.resolutionId || '',
        resolutionCodeNumber: v.resolutionCodeNumber || '',
        targetValue: v.targetValue,
        unit: v.unit,
        frequency: v.frequency,
        deadline: v.deadline?.toDate?.()?.toISOString().slice(0, 10) ?? null,
        status: v.status,
        alertLevel: v.alertLevel || null,
        progressPercentage: v.progressPercentage ?? null,
        currentValue: v.currentValue ?? null,
        assignedDepartments: v.assignedDepartments || [],
        createdAt: v.createdAt?.toDate?.()?.toISOString() ?? '',
      };
    };
    if (!resolutionId) {
      let docs = [];
      try {
        const snap = await db.collection('indicators').orderBy('createdAt', 'desc').limit(limit).get();
        docs = snap.docs;
      } catch (indexErr) {
        // Chưa có index / dữ liệu cũ thiếu createdAt → fallback lấy rồi sort tay
        console.warn('[indicators] thiếu index, fallback sort tay:', indexErr.message);
        const snap = await db.collection('indicators').limit(limit).get();
        docs = snap.docs.sort((a, b) =>
          String(b.data().createdAt?.toDate?.()?.toISOString() ?? '').localeCompare(
            String(a.data().createdAt?.toDate?.()?.toISOString() ?? '')
          )
        );
      }
      return res.json({ data: docs.map(mapItem) });
    }
    const snap = await db.collection('indicators').where('resolutionId', '==', resolutionId).get();
    const items = snap.docs
      .map(mapItem)
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

    // Tương thích luồng cũ: kiểm tra trạng thái NQ khi còn dùng luồng Ban HĐND
    if (before.resolutionId) {
      const resSnap = await db.collection('resolutions').doc(before.resolutionId).get();
      if (resSnap.exists) {
        const resData = resSnap.data();
        const st = resData.status;
        // Luồng mới cho phép duyệt/giao việc bổ sung khi đã ban hành & phân chỉ tiêu
        const newFlow = ['issued', 'extracted', 'pending_distribution', 'distributed', 'pending_completion', 'completed'];
        if (!newFlow.includes(st)) {
          if (st === 'pending_ban_review') {
            return res.status(400).json({ message: `Nghị quyết "${resData.codeNumber || before.resolutionId}" đang chờ thẩm tra.` });
          }
          if (st === 'revision_requested') {
            return res.status(400).json({ message: `Nghị quyết "${resData.codeNumber || before.resolutionId}" đang bị yêu cầu chỉnh sửa.` });
          }
          if (st === 'draft' || st === 'pending_issue') {
            return res.status(400).json({ message: `Nghị quyết "${resData.codeNumber || before.resolutionId}" chưa được Thường trực ký ban hành.` });
          }
        }
      }
    }

    await ref.update({
      ...(assignedDepartments && { assignedDepartments }),
      ...(deadline && { deadline: admin.firestore.Timestamp.fromDate(new Date(deadline)) }),
      status: status || 'assigned',
      updatedAt: admin.firestore.Timestamp.now(),
    });

    if (before.resolutionId) {
      const resRef = db.collection('resolutions').doc(before.resolutionId);
      const resSnap = await resRef.get();
      if (resSnap.exists && resSnap.data().status === 'pending_approval') {
        await resRef.update({ status: 'approved', updatedAt: admin.firestore.Timestamp.now() }).catch(() => {});
      }
    }

    await writeAudit({
      collection: 'indicators',
      docId: id,
      resolutionId: before.resolutionId || '',
      action: 'approve_indicator',
      actor: req.user,
      before: { status: before.status, assignedDepartments: before.assignedDepartments, deadline: before.deadline?.toDate?.()?.toISOString?.() ?? null },
      after: { status: status || 'assigned', assignedDepartments: assignedDepartments || before.assignedDepartments, deadline: deadline || null },
      sourceFileUrl: before.resolutionFileUrl || '',
      message: `Phê duyệt/giao việc chỉ tiêu "${before.title}"`,
    });
    return res.json({ message: `Đã cập nhật giao việc chỉ tiêu ${id}.` });
  } catch (e) {
    return res.status(500).json({ message: 'Lỗi phê duyệt.', detail: e.message });
  }
}

/** Bộ phận giúp việc phân các chỉ tiêu về các ban đúng với chỉ tiêu */
async function distributeIndicators(req, res) {
  try {
    const resolutionId = req.params.id || req.body.resolutionId;
    const { assignments } = req.body || {}; // optional: [{indicatorId, assignedDepartments}]
    if (!resolutionId) return res.status(400).json({ message: 'Thiếu resolutionId.' });

    const resRef = db.collection('resolutions').doc(resolutionId);
    const resSnap = await resRef.get();
    if (!resSnap.exists) return res.status(404).json({ message: 'Nghị quyết không tồn tại.' });
    const resData = resSnap.data();
    const beforeStatus = resData.status;

    if (!['issued', 'extracted', 'pending_distribution', 'distributed'].includes(beforeStatus)) {
      return res.status(400).json({ message: `Chỉ phân chỉ tiêu sau khi ký ban hành và bóc tách (trạng thái: ${beforeStatus}).` });
    }

    const indSnap = await db.collection('indicators').where('resolutionId', '==', resolutionId).get();
    if (indSnap.empty) return res.status(400).json({ message: 'Chưa có chỉ tiêu nào để phân. Hãy bóc tách chỉ tiêu trước.' });

    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();
    const assignMap = new Map((assignments || []).map((a) => [a.indicatorId, a.assignedDepartments]));
    let missing = 0;
    indSnap.docs.forEach((d) => {
      const v = d.data();
      const depts = assignMap.get(d.id) || v.assignedDepartments || [];
      if (!depts.length) missing += 1;
      batch.update(d.ref, {
        ...(assignMap.has(d.id) ? { assignedDepartments: assignMap.get(d.id) } : {}),
        status: depts.length ? 'assigned' : (v.status || 'draft'),
        distributedAt: now,
        updatedAt: now,
      });
    });
    batch.update(resRef, { status: 'distributed', distributedAt: now, updatedAt: now });
    await batch.commit();

    await writeAudit({
      collection: 'indicators', docId: resolutionId, resolutionId, action: 'distribute_indicators',
      actor: req.user, before: { resolutionStatus: beforeStatus }, after: { resolutionStatus: 'distributed', count: indSnap.size, missingAssignments: missing },
      sourceFileUrl: resData.fileUrl || '', sourceStoragePath: resData.storagePath || '',
      message: `Bộ phận giúp việc phân ${indSnap.size} chỉ tiêu về các ban (NQ ${resData.codeNumber || resolutionId})`,
    });

    return res.json({
      message: missing
        ? `Đã phân chỉ tiêu (${indSnap.size} chỉ tiêu, ${missing} chưa gán ban cụ thể — kiểm tra lại).`
        : `Đã phân ${indSnap.size} chỉ tiêu về các ban đúng với chỉ tiêu.`,
      data: { resolutionId, status: 'distributed', count: indSnap.size, missingAssignments: missing },
    });
  } catch (e) {
    console.error('[distribute]', e);
    return res.status(500).json({ message: 'Lỗi phân chỉ tiêu.', detail: e.message });
  }
}

module.exports = { upsertTree, listIndicators, approveIndicator, distributeIndicators, saveNodeRecursive };
