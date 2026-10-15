import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  CornerDownRight,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  ListTree,
  Plus,
  RefreshCw,
  Rows3,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import api, { API_ROOT, blobErrorMessage, getToken } from "../lib/api";
import { DEPTS, FREQS, ROLES, alertLevelFor, cx, deptName, freqName, resolutionStatusLabel, resolutionStatusTone } from "../lib/meta";
import { useToast } from "./Toaster";
import { AlertDot, Badge, Button, Card, CardHeader, EmptyState, Field, IconButton, Select, TextArea } from "./ui";

let seq = 0;
const nid = () => `local-${Date.now()}-${seq++}`;

const blankNode = (parent = null) => ({
  key: nid(),
  parent,
  title: "",
  target: "",
  unit: "%",
  freq: "quarterly",
  deadline: "",
  dept: "ubnd-xa",
  role: "primary",
});

function toNested(flat) {
  const byParent = new Map();
  for (const n of flat) {
    if (!byParent.has(n.parent)) byParent.set(n.parent, []);
    byParent.get(n.parent).push(n);
  }
  const build = (parent) =>
    (byParent.get(parent) ?? []).map((n) => ({
      // Giữ id server (khóa không phải local-*) để lưu lại là CẬP NHẬT, không tạo trùng
      ...(n.key && !String(n.key).startsWith("local-") ? { id: n.key } : {}),
      title: n.title.trim(),
      targetValue: Number(n.target) || 0,
      unit: n.unit.trim() || "%",
      frequency: n.freq,
      deadline: n.deadline || new Date().toISOString().slice(0, 10),
      assignedDepartments: [{ departmentId: n.dept, role: n.role }],
      children: build(n.key),
    }));
  return build(null);
}

// Server → dòng nhập tay (giữ key = id server để lần lưu sau update đúng dòng)
function serverToFlat(list) {
  return (list ?? []).map((n) => ({
    key: n.id,
    parent: n.parentId ?? null,
    title: n.title || "",
    target: n.targetValue ?? "",
    unit: n.unit || "%",
    freq: n.frequency || "quarterly",
    deadline: n.deadline || "",
    dept: n.dept || n.assignedDepartments?.[0]?.departmentId || "ubnd-xa",
    role: n.role || n.assignedDepartments?.[0]?.role || "primary",
  }));
}

export default function IndicatorTree({
  role,
  resolution,
  filePreview,
  onGo,
  onSubmitted,
  onPickResolution,
  onResolutionUpdated,
}) {
  const toast = useToast();
  const [nodes, setNodes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [leftTab, setLeftTab] = useState("pdf"); // pdf | text
  const [resList, setResList] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [banComment, setBanComment] = useState("");
  const [reviewingBan, setReviewingBan] = useState(false);

  // Danh sách NQ từ server — mở lại NQ cũ không cần chung tab upload
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/resolutions", { params: { limit: 30 } });
        if (data.data?.length) setResList(data.data);
      } catch {
        /* offline — giữ NQ đang mở */
      }
    })();
  }, []);

  // Tải cây đã lưu của NQ đang mở về bảng nhập tay để sửa / bổ sung tiếp
  const loadSaved = useCallback(
    async (silent = false) => {
      const rid = resolution?.id;
      if (!rid) return [];
      try {
        setLoadingSaved(true);
        const { data } = await api.get("/indicators", { params: { resolutionId: rid } });
        const list = data.data ?? [];
        if (list.length) {
          setNodes(serverToFlat(list));
          if (!silent) toast("success", `Đã tải ${list.length} chỉ tiêu đã lưu.`);
        } else if (!silent) {
          toast("info", "NQ này chưa có chỉ tiêu nào — nhập mới ở dưới.");
        }
        return list;
      } catch (e) {
        if (!silent) toast("error", e.response?.data?.message || "Tải cây đã lưu thất bại.");
        return [];
      } finally {
        setLoadingSaved(false);
      }
    },
    [resolution?.id, toast]
  );

  // Vào tab / đổi NQ mà bảng trống → tự nạp cây server (không đè khi đang nhập dở)
  useEffect(() => {
    if (resolution?.id && nodes.length === 0 && !loadingSaved) {
      loadSaved(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution?.id]);
  // Ưu tiên blob preview (xem ngay, không dính CORS/bucket) → fallback fileUrl server
  const displaySrc = filePreview?.url || resolution?.fileUrl || "";
  const displayType = filePreview?.type || "";
  const isImage =
    displayType.startsWith("image/") || /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(displaySrc || "");

  const numbering = useMemo(() => {
    const kids = new Map();
    for (const n of nodes) {
      if (!kids.has(n.parent)) kids.set(n.parent, []);
      kids.get(n.parent).push(n.key);
    }
    const out = new Map();
    const walk = (parent, prefix) => {
      (kids.get(parent) ?? []).forEach((key, i) => {
        const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        out.set(key, num);
        walk(key, num);
      });
    };
    walk(null, "");
    return out;
  }, [nodes]);

  const depthOf = useMemo(() => {
    const byKey = new Map(nodes.map((n) => [n.key, n]));
    const memo = new Map();
    const depth = (n) => {
      if (!n.parent || !byKey.has(n.parent)) return 0;
      if (memo.has(n.key)) return memo.get(n.key);
      const d = 1 + depth(byKey.get(n.parent));
      memo.set(n.key, d);
      return d;
    };
    return new Map(nodes.map((n) => [n.key, depth(n)]));
  }, [nodes]);

  const openResolution = (id) => {
    const found = resList.find((r) => r.id === id);
    if (!found) return;
    setNodes([]);
    onPickResolution?.(found);
  };

  if (!resolution) {
    return (
      <Card>
        <CardHeader
          icon={FolderOpen}
          title="Mở nghị quyết cũ để làm tiếp"
          sub="Chọn NQ đã upload từ server — cây đã lưu sẽ tự tải về bảng"
        />
        <div className="space-y-3 px-5 py-4">
          {resList.length > 0 ? (
            <Field label="Nghị quyết trên server">
              <Select defaultValue="" onChange={(e) => e.target.value && openResolution(e.target.value)}>
                <option value="">— Chọn nghị quyết —</option>
                {resList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.codeNumber} — {(r.title || "").slice(0, 60)} [{r.status}]
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <EmptyState
              icon={FileText}
              title="Chưa có nghị quyết để phân khai"
              hint="Sang bước Upload & OCR tải file PDF lên trước — màn hình này sẽ hiện file bên trái để bạn vừa nhìn vừa nhập."
              action={
                <Button tone="secondary" onClick={() => onGo("upload")}>
                  Sang bước Upload & OCR
                </Button>
              }
            />
          )}
        </div>
      </Card>
    );
  }

  const patch = (key, p) => setNodes((prev) => prev.map((n) => (n.key === key ? { ...n, ...p } : n)));
  const addRoot = () => setNodes((prev) => [...prev, blankNode(null)]);
  const addChild = (key) => setNodes((prev) => [...prev, blankNode(key)]);
  const addSibling = (key) => {
    const node = nodes.find((n) => n.key === key);
    setNodes((prev) => [...prev, blankNode(node?.parent ?? null)]);
  };
  const remove = (key) => {
    const kill = new Set([key]);
    let grown = true;
    while (grown) {
      grown = false;
      for (const n of nodes) {
        if (n.parent && kill.has(n.parent) && !kill.has(n.key)) {
          kill.add(n.key);
          grown = true;
        }
      }
    }
    setNodes((prev) => prev.filter((n) => !kill.has(n.key)));
  };

  const submit = async () => {
    if (!getToken()) return toast("error", "Bạn đã bị đăng xuất — đăng nhập lại để tiếp tục.");
    if (nodes.length === 0) return toast("error", "Bảng đang trống — bấm + Thêm chỉ tiêu để nhập.");
    const bad = nodes.find((n) => !n.title.trim() || n.target === "" || !n.deadline);
    if (bad) return toast("error", `Chỉ tiêu ${numbering.get(bad.key) ?? ""} thiếu tên / con số / deadline.`);
    try {
      setSaving(true);
      const { data } = await api.post("/indicators/tree", {
        resolutionId: resolution.id,
        tree: toNested(nodes),
      });
      toast("success", data.message || "Đã lưu cây chỉ tiêu và gửi Ban HĐND xã thẩm tra.");
      onSubmitted?.(nodes, data.indicators ?? []);
      onResolutionUpdated?.({ ...resolution, status: "pending_ban_review" });
      setResList((prev) =>
        prev.map((r) => (r.id === resolution.id ? { ...r, status: "pending_ban_review" } : r))
      );
      // Nạp lại cây từ server để khóa local thành id server — sửa tiếp không bị tạo trùng
      const fresh = await loadSaved(true);
      if (!fresh.length) setNodes((prev) => [...prev]);
    } catch (e) {
      toast("error", e.response?.data?.message || "Lưu cây thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleBanReview = async (status) => {
    if (!resolution?.id) return;
    if (!getToken()) return toast("error", "Bạn đã bị đăng xuất — đăng nhập lại để tiếp tục.");
    try {
      setReviewingBan(true);
      const { data } = await api.post(`/resolutions/${encodeURIComponent(resolution.id)}/ban-review`, {
        status,
        comment: banComment.trim(),
      });
      toast("success", data.message || "Đã lưu ý kiến thẩm tra của Ban HĐND.");
      const updatedRes = {
        ...resolution,
        status: data.data?.status || (status === "approved" ? "pending_approval" : "revision_requested"),
        banReview: data.data?.banReview,
      };
      onResolutionUpdated?.(updatedRes);
      setResList((prev) =>
        prev.map((r) =>
          r.id === resolution.id
            ? { ...r, status: updatedRes.status, banReview: updatedRes.banReview }
            : r
        )
      );
      setBanComment("");
    } catch (e) {
      toast("error", e.response?.data?.message || "Thẩm tra thất bại.");
    } finally {
      setReviewingBan(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <Badge tone="sky">{resolution.codeNumber}</Badge>
        <p className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight" title={resolution.title}>
          {resolution.title}
        </p>
        {resList.length > 0 && (
          <select
            value={resolution.id}
            onChange={(e) => e.target.value && openResolution(e.target.value)}
            title="Mở nghị quyết cũ để làm tiếp"
            className="max-w-56 cursor-pointer truncate rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none transition-all hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-900"
          >
            {resList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.codeNumber} [{r.status}]
              </option>
            ))}
            {!resList.some((r) => r.id === resolution.id) && (
              <option value={resolution.id}>{resolution.codeNumber} (đang mở)</option>
            )}
          </select>
        )}
        <Button
          tone="secondary"
          onClick={() => loadSaved(false)}
          disabled={loadingSaved}
          className="!px-2.5 !py-1.5 !text-xs"
        >
          <Download className="size-3.5" /> {loadingSaved ? "Đang tải…" : "Tải cây đã lưu"}
        </Button>
        {(resolution.fileUrl || resolution.id) && (
          <a
            href={`${API_ROOT}/resolutions/${resolution.id}/file?token=${encodeURIComponent(getToken() || "")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:text-emerald-400"
          >
            <ExternalLink className="size-3.5" /> Mở PDF tab mới
          </a>
        )}
        <Badge tone={resolutionStatusTone(resolution.status)}>
          {resolutionStatusLabel(resolution.status)}
        </Badge>
      </div>

      {/* Trạng thái quy trình Ban HĐND thẩm tra */}
      {resolution.status === "pending_ban_review" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-extrabold text-amber-900 dark:text-amber-200">
                Đang chờ Ban HĐND xã thẩm tra cây chỉ tiêu
              </p>
              <p className="mt-0.5 leading-relaxed text-amber-800/90 dark:text-amber-300/90">
                Chuyên viên đã gửi cây chỉ tiêu cho Ban HĐND xã. Sau khi Ban HĐND đồng ý thông qua, Nghị quyết mới được chuyển sang Thường trực để phê duyệt & giao việc.
              </p>
            </div>
          </div>
          {(role === "ban_hdnd" || role === "thuong_truc") && (
            <Badge tone="amber">Bạn có quyền thẩm tra bên dưới</Badge>
          )}
        </div>
      )}

      {resolution.status === "revision_requested" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-300 bg-red-50/90 p-4 text-xs shadow-sm dark:border-red-900/60 dark:bg-red-950/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="font-extrabold text-red-900 dark:text-red-200">
                Ban HĐND yêu cầu chỉnh sửa cây chỉ tiêu
              </p>
              <p className="mt-0.5 leading-relaxed text-red-800/90 dark:text-red-300/90">
                Ý kiến Ban: <b>"{resolution.banReview?.comment || "Chưa phù hợp"}"</b>
                {resolution.banReview?.reviewedBy ? ` (${resolution.banReview.reviewedBy})` : ""}.
                Chuyên viên hãy chỉnh sửa các chỉ tiêu bên dưới rồi bấm <b>"Lưu & Gửi Ban HĐND thẩm tra"</b>.
              </p>
            </div>
          </div>
        </div>
      )}

      {resolution.status === "pending_approval" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300 bg-sky-50/90 p-4 text-xs shadow-sm dark:border-sky-900/60 dark:bg-sky-950/40">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
            <div>
              <p className="font-extrabold text-sky-900 dark:text-sky-200">
                Ban HĐND đã đồng ý thông qua — Sẵn sàng chuyển Thường trực
              </p>
              <p className="mt-0.5 leading-relaxed text-sky-800/90 dark:text-sky-300/90">
                Ý kiến thẩm tra: <i>"{resolution.banReview?.comment || "Đồng ý"}"</i>
                {resolution.banReview?.reviewedBy ? ` (${resolution.banReview.reviewedBy})` : ""}.
                Nghị quyết đã được chuyển sang Thường trực để phê duyệt & giao việc.
              </p>
            </div>
          </div>
          <Button onClick={() => onGo("approve")} className="!px-3 !py-1.5 !text-xs">
            Sang tab Phê duyệt →
          </Button>
        </div>
      )}

      {resolution.status === "approved" && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50/90 p-3.5 text-xs text-emerald-900 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
          <ShieldCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="font-semibold leading-relaxed">
            <b>Thường trực HĐND đã phê duyệt & giao việc:</b> Các chỉ tiêu đã có đơn vị chủ trì và hạn hoàn thành, sẵn sàng tiếp nhận báo cáo tiến độ.
          </p>
        </div>
      )}

      {/* Khung thao tác thẩm tra nhanh dành riêng cho Ban HĐND (hoặc Thường trực) */}
      {(role === "ban_hdnd" || role === "thuong_truc") && (
        <Card className="border-amber-300/80 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20">
          <CardHeader
            icon={ShieldCheck}
            title="Thẩm tra cây chỉ tiêu (Dành cho Ban HĐND)"
            sub="Đối chiếu chỉ tiêu bên phải với văn bản gốc bên trái trước khi chuyển Thường trực duyệt"
            action={
              <Badge tone={resolution.status === "pending_approval" ? "emerald" : "amber"}>
                {resolution.status === "pending_approval" ? "Đã thông qua" : "Cần thẩm tra"}
              </Badge>
            }
          />
          <div className="space-y-3 px-4 py-3">
            <Field label="Ý kiến / Nhận xét thẩm tra của Ban HĐND">
              <TextArea
                value={banComment}
                onChange={(e) => setBanComment(e.target.value)}
                placeholder="Nhập ý kiến thẩm tra: số lượng chỉ tiêu có đầy đủ, con số kế hoạch có khớp văn bản, tính khả thi..."
                rows={2}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleBanReview("approved")}
                disabled={reviewingBan}
                className="!bg-emerald-600 hover:!bg-emerald-700 !text-white"
              >
                <CheckCircle2 className="size-4" />
                {reviewingBan ? "Đang xử lý…" : "Ban HĐND Đồng ý (Chuyển Thường trực)"}
              </Button>
              <Button
                tone="secondary"
                onClick={() => handleBanReview("rejected")}
                disabled={reviewingBan}
                className="!border-red-300 !text-red-700 hover:!bg-red-50 dark:!border-red-800 dark:!text-red-300"
              >
                <AlertTriangle className="size-4" />
                {reviewingBan ? "Đang xử lý…" : "Yêu cầu chỉnh sửa"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {/* TRÁI: file nghị quyết — luôn hiện bên cạnh để vừa nhìn vừa nhập */}
        <Card className="xl:sticky xl:top-24">
          <CardHeader
            icon={FileText}
            title="Nghị quyết gốc"
            sub={filePreview?.url ? "Bản xem ngay sau upload — không cần mở tab mới" : "Nhìn bên này, nhập liệu bên phải"}
            action={
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {[
                  { id: "pdf", name: "PDF gốc" },
                  { id: "text", name: "Text OCR" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setLeftTab(t.id)}
                    className={cx(
                      "rounded-md px-2.5 py-1 text-xs font-bold transition-all",
                      leftTab === t.id
                        ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            }
          />
          <div className="px-4 py-4">
            {leftTab === "text" ? (
              <div className="space-y-2">
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <p><span className="font-bold">Số hiệu:</span> {resolution.codeNumber || "—"}</p>
                  <p><span className="font-bold">Người ký:</span> {resolution.signer || "—"}</p>
                </div>
                <p className="text-xs font-bold">Trích yếu: <span className="font-medium">{resolution.title || "—"}</span></p>
                <pre className="h-[52vh] min-h-96 overflow-auto rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs leading-relaxed whitespace-pre-wrap dark:border-slate-800 dark:bg-slate-900">
                  {resolution.ocrRawText || "Không có text OCR (bản này tạo tay hoặc OCR thất bại)."}
                </pre>
              </div>
            ) : filePreview?.url ? (
              <div className="space-y-2">
                {isImage ? (
                  <img
                    src={filePreview.url}
                    alt="Nghị quyết gốc"
                    className="h-[62vh] min-h-96 w-full rounded-xl border border-slate-200/80 bg-slate-50 object-contain dark:border-slate-800 dark:bg-slate-900"
                  />
                ) : (
                  <object
                    data={filePreview.url}
                    type="application/pdf"
                    className="h-[62vh] min-h-96 w-full rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <iframe
                      title="PDF nghị quyết"
                      src={filePreview.url}
                      className="h-full w-full rounded-xl"
                    />
                  </object>
                )}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={filePreview.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-600/10 dark:text-emerald-400"
                  >
                    <ExternalLink className="size-3.5" /> Phóng to tab mới
                  </a>
                  <a
                    href={filePreview.url}
                    download={filePreview?.name || resolution.codeNumber || "nghi-quyet"}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400"
                  >
                    Tải xuống
                  </a>
                </div>
              </div>
            ) : resolution?.id || resolution?.fileUrl ? (
              <ResolutionFileViewer resolution={resolution} />
            ) : (
              <EmptyState title="Không có file xem trước" hint="Document này thiếu fileUrl." />
            )}
          </div>
        </Card>

        {/* PHẢI: bảng cây nhập tay */}
        <Card>
          <CardHeader
            icon={ListTree}
            title="Bảng chỉ tiêu"
            sub="Đã tự tách từ OCR — kiểm tra, sửa/bổ sung rồi Lưu"
            action={<Badge tone="sky">{nodes.length} dòng</Badge>}
          />
          <div className="space-y-3 px-4 py-4">
            <div className="flex gap-2">
              <Button onClick={addRoot} className="flex-1">
                <Plus className="size-4" strokeWidth={2.5} /> Thêm chỉ tiêu
              </Button>
              <Button tone="secondary" onClick={submit} disabled={saving || nodes.length === 0} className="flex-1">
                <Send className="size-4" /> {saving ? "Đang gửi…" : "Lưu & Gửi Ban HĐND thẩm tra"}
              </Button>
            </div>

            {nodes.length === 0 ? (
              <EmptyState
                icon={ListTree}
                title="Bảng đang trống"
                hint="Văn bản này chưa tách được chỉ tiêu nào — đọc file PDF bên trái, bấm + Thêm chỉ tiêu rồi gõ tên, con số, chọn phòng ban và deadline."
                action={
                  <Button onClick={addRoot}>
                    <Plus className="size-4" strokeWidth={2.5} /> Thêm chỉ tiêu đầu tiên
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {nodes.map((n) => {
                  const depth = depthOf.get(n.key) ?? 0;
                  return (
                    <motion.li
                      key={n.key}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ marginLeft: depth * 28 }}
                      className={
                        depth === 0
                          ? "rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
                          : "relative rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-3 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-emerald-800/50 dark:bg-emerald-950/20"
                      }
                    >
                      {depth > 0 && (
                        <span
                          aria-hidden
                          className="absolute top-3 bottom-3 rounded-full bg-emerald-400/70 dark:bg-emerald-600/60"
                          style={{ left: -16, width: 3 }}
                        />
                      )}
                      <div className="flex items-center gap-2">
                        {depth > 0 && (
                          <span className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-600/10 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            <CornerDownRight className="size-3.5" />
                            Cấp {depth + 1}
                          </span>
                        )}
                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          {numbering.get(n.key)}
                        </span>
                        <AlertDot level={alertLevelFor(n.deadline || null)} />
                        <input
                          value={n.title}
                          onChange={(e) => patch(n.key, { title: e.target.value })}
                          placeholder={depth === 0 ? "Tên nhóm mục tiêu… (vd: Giảm hộ nghèo còn dưới 2%)" : "Tên chỉ tiêu con… (vd: Hỗ trợ sinh kế 50 hộ)"}
                          className={cx(
                            "min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-sm outline-none transition-all duration-200",
                            "hover:bg-slate-50 focus:bg-white focus:ring-4 focus:ring-emerald-500/20 dark:hover:bg-slate-800 dark:focus:bg-slate-900",
                            depth === 0 ? "font-bold tracking-tight" : "font-medium"
                          )}
                        />
                        <div className="flex shrink-0 items-center">
                          <IconButton label="Thêm chỉ tiêu con" onClick={() => addChild(n.key)}>
                            <Plus className="size-4" />
                          </IconButton>
                          <IconButton label="Thêm ngang hàng" onClick={() => addSibling(n.key)}>
                            <Rows3 className="size-4" />
                          </IconButton>
                          <IconButton label="Xóa dòng" onClick={() => remove(n.key)} className="hover:!bg-red-500/10 hover:!text-red-500">
                            <Trash2 className="size-4" />
                          </IconButton>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">Con số KH</span>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              min={0}
                              value={n.target}
                              onChange={(e) => patch(n.key, { target: e.target.value })}
                              placeholder="0"
                              className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none transition-all duration-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                            />
                            <input
                              value={n.unit}
                              onChange={(e) => patch(n.key, { unit: e.target.value })}
                              placeholder="Đơn vị"
                              title="Đơn vị tính (%, hộ, km, tỷ đồng…)"
                              className="w-20 shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none transition-all duration-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                            />
                          </div>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">Chu kỳ BC</span>
                          <Select value={n.freq} onChange={(e) => patch(n.key, { freq: e.target.value })} title={freqName(n.freq)} className="!px-2 !py-1.5 !text-xs">
                            {FREQS.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </Select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">Deadline</span>
                          <input
                            type="date"
                            value={n.deadline}
                            onChange={(e) => patch(n.key, { deadline: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none transition-all duration-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">Phòng ban</span>
                          <Select value={n.dept} onChange={(e) => patch(n.key, { dept: e.target.value })} title={deptName(n.dept)} className="!px-2 !py-1.5 !text-xs">
                            {DEPTS.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </Select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-600">Vai trò</span>
                          <Select value={n.role} onChange={(e) => patch(n.key, { role: e.target.value })} className="!px-2 !py-1.5 !text-xs">
                            {ROLES.map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </Select>
                        </label>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const isImageUrl = (url) => /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url || "");

const EXPECTED_BACKEND_VERSION = "1.4.0-pdf-proxy-2026-09-12";

// Hỏi backend đang chạy là bản nào — phân biệt bản cũ (process cũ giữ cổng) với bản mới
async function probeBackend() {
  try {
    const res = await fetch(`${API_ROOT}/health`);
    if (!res.ok) return `Backend trả health HTTP ${res.status} (bản cũ hoặc đang lỗi)`;
    const j = await res.json().catch(() => ({}));
    if (!j.version)
      return "Backend đang chạy BẢN CŨ (không có version) — có process cũ giữ cổng, giết nó rồi npm run dev lại";
    if (j.version !== EXPECTED_BACKEND_VERSION)
      return `Backend bản ${j.version} (cần ${EXPECTED_BACKEND_VERSION}) — restart backend để lên bản mới`;
    return `Backend đúng bản mới ${j.version} · project ${j.projectId || "?"} · mode ${j.storageMode || "?"}`;
  } catch {
    return `Không nối được backend ở ${API_ROOT} — sai VITE_API_URL hoặc backend chưa chạy`;
  }
}

/**
 * Khung PDF gốc cho NQ cũ (không còn blob xem ngay sau upload).
 * Link fileUrl public hay 403 → ƯU TIÊN tải qua GET /api/resolutions/:id/file kèm token.
 * Thất bại thì hiện rõ lỗi + cách kiểm tra, kèm nút dùng link trực tiếp.
 */
function ResolutionFileViewer({ resolution }) {
  const toast = useToast();
  const [blobUrl, setBlobUrl] = useState(null);
  const [blobMime, setBlobMime] = useState("");
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [useDirect, setUseDirect] = useState(false);

  const directUrl = resolution?.fileUrl || "";
  const rid = resolution?.id || "";

  const loadViaServer = useCallback(async () => {
    if (!rid) {
      setLoading(false);
      return;
    }
    if (!getToken()) {
      setServerError("Chưa đăng nhập (thiếu token) — đăng nhập lại rồi bấm Thử lại.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setServerError("");
      setUseDirect(false);
      // Đi qua instance api để tự refresh token khi 401 (fetch trần không có cơ chế này)
      const res = await api.get(`/resolutions/${rid}/file`, { responseType: "blob" });
      const blob = res.data;
      if (!blob?.size) throw new Error("Server trả về file rỗng.");
      const url = URL.createObjectURL(blob);
      setBlobUrl((prev) => {
        if (prev) {
          try {
            URL.revokeObjectURL(prev);
          } catch {
            /* ignore */
          }
        }
        return url;
      });
      setBlobMime(res.headers?.["content-type"] || blob.type || "");
    } catch (e) {
      let msg = await blobErrorMessage(e);
      // 401 mà không có "Chi tiết:" = backend cũ (chưa có code mới) → hỏi /health để chứng minh
      if (/401/.test(msg) && !/Chi tiết:/.test(msg)) {
        msg += ` | ${await probeBackend()}`;
      }
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  }, [rid]);

  useEffect(() => {
    setBlobUrl((prev) => {
      if (prev) {
        try {
          URL.revokeObjectURL(prev);
        } catch {
          /* ignore */
        }
      }
      return null;
    });
    setBlobMime("");
    setServerError("");
    setUseDirect(false);
    if (rid) loadViaServer();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rid]);

  useEffect(
    () => () => {
      if (blobUrl) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          /* ignore */
        }
      }
    },
    [blobUrl]
  );

  const serverStreamUrl = rid
    ? `${API_ROOT}/resolutions/${rid}/file?token=${encodeURIComponent(getToken() || "")}`
    : directUrl;
  const viewingBlob = Boolean(blobUrl) && !useDirect;
  const src = viewingBlob ? blobUrl : useDirect ? serverStreamUrl : "";
  const isImage = viewingBlob
    ? blobMime.startsWith("image/")
    : isImageUrl(directUrl);

  return (
    <div className="space-y-2">
      {loading && !src ? (
        <div className="grid h-[62vh] min-h-96 place-items-center rounded-xl border border-slate-200/80 bg-slate-50 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Đang tải file gốc qua server…
        </div>
      ) : src ? (
        isImage ? (
          <img
            key={src}
            src={src}
            alt="Nghị quyết gốc"
            className="h-[62vh] min-h-96 w-full rounded-xl border border-slate-200/80 bg-slate-50 object-contain dark:border-slate-800 dark:bg-slate-900"
          />
        ) : (
          <object
            key={src}
            data={src}
            type="application/pdf"
            className="h-[62vh] min-h-96 w-full rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
          >
            <iframe title="PDF nghị quyết" src={src} className="h-full w-full rounded-xl" />
          </object>
        )
      ) : (
        <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
          <p className="text-xs font-medium text-slate-500">
            {serverError || !rid
              ? "Chưa tải được file — xem chi tiết lỗi ở dưới."
              : "NQ này thiếu file gốc — sang tab Text OCR để xem nội dung trích xuất."}
          </p>
        </div>
      )}

      {serverError && !viewingBlob && (
        <div className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed dark:border-red-900/50 dark:bg-red-950/30">
          <p className="font-bold text-red-700 dark:text-red-300">
            Không tải được qua server: {serverError}
          </p>
          <p className="font-medium text-red-600/90 dark:text-red-400/90">
            NQ {resolution?.codeNumber || ""} · ID {String(rid).slice(0, 8)}… · link trực tiếp:{" "}
            {directUrl ? "có" : "không có"} · storagePath: {resolution?.storagePath ? "có" : "không có"}
          </p>
          <ul className="list-disc pl-5 font-medium text-red-600/90 dark:text-red-400/90">
            <li>Backend đã restart sau khi cập nhật code chưa? (cần route mới /resolutions/:id/file)</li>
            <li>
              STORAGE_MODE trong backend/.env có đúng với lúc upload file? (local / firebase / cloudinary)
            </li>
            <li>Mở tab mới bằng link trực tiếp xem báo gì (403 là bucket chưa public).</li>
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={loadViaServer}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 transition-colors outline-none hover:border-emerald-300 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Đang tải…" : "Thử lại qua server"}
        </button>
        {viewingBlob && (
          <span className="rounded-full bg-sky-600/10 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:text-sky-300">
            đang xem qua server
          </span>
        )}
        {serverError && directUrl && !useDirect && (
          <button
            type="button"
            onClick={() => {
              setUseDirect(true);
              toast("info", "Đang thử link trực tiếp — nếu vẫn trắng là link đã hỏng.");
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2 py-1 text-xs font-bold text-amber-700 transition-colors outline-none hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:text-amber-300"
          >
            Dùng link trực tiếp
          </button>
        )}
        {useDirect && (
          <button
            type="button"
            onClick={() => loadViaServer()}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400"
          >
            Quay lại xem qua server
          </button>
        )}
        {src && (
          <>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:text-emerald-400"
            >
              <ExternalLink className="size-3.5" /> Phóng to tab mới
            </a>
            <a
              href={src}
              download={resolution?.codeNumber || "nghi-quyet"}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400"
            >
              <Download className="size-3.5" /> Tải xuống
            </a>
          </>
        )}
      </div>
    </div>
  );
}
