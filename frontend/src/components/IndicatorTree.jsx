import { motion } from "framer-motion";
import { CornerDownRight, ExternalLink, FileText, ListTree, Plus, Rows3, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import api, { getToken } from "../lib/api";
import { DEPTS, FREQS, ROLES, alertLevelFor, cx, deptName, freqName } from "../lib/meta";
import { useToast } from "./Toaster";
import { AlertDot, Badge, Button, Card, CardHeader, EmptyState, IconButton, Select } from "./ui";

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

export default function IndicatorTree({ resolution, filePreview, onGo, onSubmitted }) {
  const toast = useToast();
  const [nodes, setNodes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [leftTab, setLeftTab] = useState("pdf"); // pdf | text
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

  if (!resolution) {
    return (
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
      toast("success", data.message || "Đã lưu cây chỉ tiêu và trình phê duyệt.");
      onSubmitted?.(nodes, data.indicators ?? []);
    } catch (e) {
      toast("error", e.response?.data?.message || "Lưu cây thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <Badge tone="sky">{resolution.codeNumber}</Badge>
        <p className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight" title={resolution.title}>
          {resolution.title}
        </p>
        {resolution.fileUrl && (
          <a
            href={resolution.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:text-emerald-400"
          >
            <ExternalLink className="size-3.5" /> Mở PDF tab mới
          </a>
        )}
      </div>

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
            ) : displaySrc ? (
              <div className="space-y-2">
                {isImage ? (
                  <img
                    src={displaySrc}
                    alt="Nghị quyết gốc"
                    className="h-[62vh] min-h-96 w-full rounded-xl border border-slate-200/80 bg-slate-50 object-contain dark:border-slate-800 dark:bg-slate-900"
                  />
                ) : (
                  <object
                    data={displaySrc}
                    type="application/pdf"
                    className="h-[62vh] min-h-96 w-full rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <iframe
                      title="PDF nghị quyết"
                      src={displaySrc}
                      className="h-full w-full rounded-xl"
                    />
                  </object>
                )}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={displaySrc}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-600/10 dark:text-emerald-400"
                  >
                    <ExternalLink className="size-3.5" /> Phóng to tab mới
                  </a>
                  <a
                    href={displaySrc}
                    download={filePreview?.name || resolution.codeNumber || "nghi-quyet"}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400"
                  >
                    Tải xuống
                  </a>
                  {!filePreview?.url && (
                    <span className="px-2 py-1 text-[11px] font-medium text-amber-600">
                      Đang xem qua link server — nếu trắng, sang tab Text OCR vẫn làm được.
                    </span>
                  )}
                </div>
              </div>
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
            sub="Nhập tay 100% theo file bên trái"
            action={<Badge tone="sky">{nodes.length} dòng</Badge>}
          />
          <div className="space-y-3 px-4 py-4">
            <div className="flex gap-2">
              <Button onClick={addRoot} className="flex-1">
                <Plus className="size-4" strokeWidth={2.5} /> Thêm chỉ tiêu
              </Button>
              <Button tone="secondary" onClick={submit} disabled={saving || nodes.length === 0} className="flex-1">
                <Save className="size-4" /> {saving ? "Đang lưu…" : "Lưu & trình duyệt"}
              </Button>
            </div>

            {nodes.length === 0 ? (
              <EmptyState
                icon={ListTree}
                title="Bảng đang trống"
                hint="Đọc file PDF bên trái, bấm + Thêm chỉ tiêu rồi gõ tên, con số, chọn phòng ban và deadline từ danh sách xổ xuống."
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
