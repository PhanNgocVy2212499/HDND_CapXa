import { motion } from "framer-motion";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  ListTree,
  Maximize2,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import api, { getToken } from "../lib/api";
import { DEPTS, ROLES, deptName, resolutionStatusLabel } from "../lib/meta";
import { useToast } from "./Toaster";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Select, TextInput } from "./ui";

const toRows = (list) =>
  (list ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    deadline: n.deadline || "",
    dept: n.dept || n.assignedDepartments?.[0]?.departmentId || "ubnd-xa",
    role: n.role || n.assignedDepartments?.[0]?.role || "primary",
    approved: ["assigned", "in_progress", "completed"].includes(n.status),
    busy: false,
  }));

export default function ApproveAssign({ resolution, indicators, onApproved, onPickResolution, onGo }) {
  const toast = useToast();
  const [rows, setRows] = useState(() => toRows(indicators));
  const [loading, setLoading] = useState(false);
  const [manualId, setManualId] = useState("");
  const [manualDeadline, setManualDeadline] = useState("");
  const [resList, setResList] = useState([]);
  const [activeResId, setActiveResId] = useState(resolution?.id || "");
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfFullscreen, setPdfFullscreen] = useState(false);
  const activeResolution = resList.find((r) => r.id === activeResId) || resolution || null;

  useEffect(() => {
    if (resolution?.id) setActiveResId(resolution.id);
  }, [resolution?.id]);

  // Tải danh sách NQ từ server — tab/máy khác vẫn thấy cái chuyên viên vừa lưu
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/resolutions", { params: { limit: 30 } });
        const list = data.data ?? [];
        setResList(list);
        if (!activeResId && list.length === 1) setActiveResId(list[0].id);
      } catch {
        /* offline — giữ props cũ */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (indicators?.length) setRows(toRows(indicators));
  }, [indicators]);

  useEffect(() => {
    let cancelled = false;
    const rid = activeResolution?.id;
    setPdfUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return "";
    });
    setPdfError("");
    if (!rid || !["draft", "pending_issue"].includes(activeResolution?.status)) {
      setPdfLoading(false);
      return undefined;
    }

    setPdfLoading(true);
    api
      .get(`/resolutions/${encodeURIComponent(rid)}/file`, { responseType: "blob" })
      .then(({ data }) => {
        if (cancelled) return;
        if (!data?.size) throw new Error("File PDF rỗng.");
        setPdfUrl(URL.createObjectURL(data));
      })
      .catch((error) => {
        if (!cancelled) {
          setPdfError(error?.response?.data?.message || "Không tải được file PDF gốc.");
        }
      })
      .finally(() => {
        if (!cancelled) setPdfLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeResolution?.id, activeResolution?.status]);

  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl]
  );

  useEffect(() => {
    if (!pdfFullscreen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setPdfFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pdfFullscreen]);

  // Tab mới / F5: props rỗng nhưng server vẫn có → tự tải lại theo resolutionId
  useEffect(() => {
    const rid = activeResId || resolution?.id;
    if (rows.length === 0 && rid && !loading) {
      (async () => {
        try {
          setLoading(true);
          const { data } = await api.get("/indicators", { params: { resolutionId: rid } });
          if (data.data?.length) setRows(toRows(data.data));
        } catch {
          /* giữ EmptyState + nút tải tay */
        } finally {
          setLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResId, resolution?.id]);

  const patchRow = (id, p) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const pickResolution = (id) => {
    setActiveResId(id);
    setRows([]);
    const found = resList.find((r) => r.id === id);
    if (found) {
      try {
        localStorage.setItem("hdnd_resolution", JSON.stringify(found));
      } catch {
        /* ignore */
      }
      onPickResolution?.(found);
    }
  };

  const fetchList = async () => {
    const rid = activeResId || resolution?.id;
    if (!rid) return toast("error", "Chưa chọn nghị quyết — chọn ở dropdown trên cùng.");
    try {
      setLoading(true);
      const { data } = await api.get("/indicators", { params: { resolutionId: rid } });
      if (!data.data?.length) return toast("info", "Nghị quyết này chưa có chỉ tiêu nào.");
      setRows(toRows(data.data));
      toast("success", `Đã tải ${data.data.length} chỉ tiêu.`);
    } catch (e) {
      toast("error", e.response?.data?.message || "Tải danh sách thất bại.");
    } finally {
      setLoading(false);
    }
  };

  const st = activeResolution?.status || "";
  const canIssue = ["draft", "pending_issue"].includes(st);
  const canConfirmCompletion = ["pending_completion", "distributed"].includes(st);
  const canApprove =
    ["pending_approval", "approved", "issued", "extracted", "pending_distribution", "distributed"].includes(st) ||
    (!activeResolution && rows.length > 0);

  const doIssue = async () => {
    const rid = activeResId || activeResolution?.id;
    if (!rid) return toast("error", "Chưa chọn nghị quyết.");
    if (!getToken()) return toast("error", "Bạn đã bị đăng xuất — đăng nhập lại.");
    try {
      setLoading(true);
      const { data } = await api.post(`/resolutions/${rid}/issue`);
      toast("success", data.message || "Đã ký ban hành.");
      onPickResolution?.({ ...(activeResolution || {}), id: rid, status: "issued" });
      setResList((prev) => prev.map((r) => (r.id === rid ? { ...r, status: "issued" } : r)));
    } catch (e) {
      toast("error", e.response?.data?.message || "Không thể ký ban hành (cần quyền Thường trực).");
    } finally {
      setLoading(false);
    }
  };

  const doConfirmCompletion = async () => {
    const rid = activeResId || activeResolution?.id;
    if (!rid) return toast("error", "Chưa chọn nghị quyết.");
    if (!getToken()) return toast("error", "Bạn đã bị đăng xuất — đăng nhập lại.");
    try {
      setLoading(true);
      const { data } = await api.post(`/resolutions/${rid}/confirm-completion`);
      toast("success", data.message || "Đã xác nhận hoàn thành.");
      onPickResolution?.({ ...(activeResolution || {}), id: rid, status: "completed" });
      setResList((prev) => prev.map((r) => (r.id === rid ? { ...r, status: "completed" } : r)));
    } catch (e) {
      toast("error", e.response?.data?.message || "Không thể xác nhận hoàn thành (cần quyền Thường trực).");
    } finally {
      setLoading(false);
    }
  };

  const approve = async (row, deadlineOverride) => {
    if (st === "pending_ban_review") {
      return toast("error", "Nghị quyết đang chờ thẩm tra (luồng cũ).");
    }
    if (st === "revision_requested") {
      return toast("error", "Nghị quyết đang bị yêu cầu chỉnh sửa.");
    }
    if (st === "draft" || st === "pending_issue") {
      return toast("error", "Nghị quyết chưa được Thường trực ký ban hành.");
    }
    const deadline = deadlineOverride ?? row.deadline;
    if (!deadline) return toast("error", `Chỉ tiêu "${row.title}" chưa có deadline.`);
    if (!getToken()) return toast("error", "Bạn đã bị đăng xuất — đăng nhập lại để tiếp tục.");
    try {
      patchRow(row.id, { busy: true });
      const { data } = await api.put(`/indicators/${encodeURIComponent(row.id)}/approve`, {
        deadline,
        assignedDepartments: [
          { departmentId: row.dept, departmentName: deptName(row.dept), role: row.role },
        ],
      });
      patchRow(row.id, { busy: false, approved: true });
      toast("success", data.message || "Đã cập nhật giao việc.");
      onApproved?.(row.id);
    } catch (e) {
      patchRow(row.id, { busy: false });
      toast("error", e.response?.data?.message || "Thao tác thất bại — kiểm tra quyền và trạng thái.");
    }
  };

  const approveAll = async () => {
    if (!canApprove) {
      return toast("error", "Chưa đủ điều kiện thực hiện thao tác này với trạng thái hiện tại.");
    }
    for (const r of rows.filter((r) => !r.approved)) {
      // eslint-disable-next-line no-await-in-loop
      await approve(r);
    }
  };

  const doneCount = rows.filter((r) => r.approved).length;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader
          icon={BadgeCheck}
          title="Thường trực HĐND — Ký ban hành / Xác nhận"
          sub={activeResolution ? `${activeResolution.codeNumber} — ${resolutionStatusLabel(activeResolution.status)}` : "Chọn nghị quyết để xử lý"}
          action={
            rows.length > 0 && (
              <Badge tone={doneCount === rows.length ? "emerald" : "amber"}>
                {doneCount}/{rows.length} chỉ tiêu đã xử lý
              </Badge>
            )
          }
        />
        <div className="space-y-3 px-4 py-4">
          <Field label="Nghị quyết (đồng bộ server)">
            <Select value={activeResId} onChange={(e) => pickResolution(e.target.value)}>
              <option value="">— Chọn nghị quyết —</option>
              {resList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.codeNumber} — {(r.title || "").slice(0, 50)} [{resolutionStatusLabel(r.status)}]
                </option>
              ))}
            </Select>
          </Field>

          {/* Quy trình mới: Thường trực ký ban hành */}
          {activeResolution && canIssue && (
            <div className="flex items-start gap-3 rounded-xl border border-sky-300 bg-sky-50/90 p-3.5 text-xs text-sky-900 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" />
              <div className="flex-1">
                <p className="font-extrabold">Chờ Thường trực ký ban hành</p>
                <p className="mt-0.5 leading-relaxed">Xem lại file PDF nghị quyết bên dưới trước khi ký ban hành. Sau khi ký, nghị quyết được chuyển về bộ phận giúp việc để bóc tách chỉ tiêu.</p>
                <div className="mt-3 overflow-hidden rounded-xl border border-sky-200 bg-white dark:border-sky-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-2 border-b border-sky-100 px-3 py-2 dark:border-sky-900">
                    <span className="flex min-w-0 items-center gap-2 font-bold">
                      <FileText className="size-4 shrink-0" />
                      <span className="truncate">{activeResolution.codeNumber || "Nghị quyết"} — PDF gốc</span>
                    </span>
                    {pdfUrl && (
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setPdfFullscreen(true)}
                          className="inline-flex items-center gap-1 font-bold text-sky-700 hover:underline dark:text-sky-300"
                        >
                          <Maximize2 className="size-3.5" /> Xem toàn màn hình
                        </button>
                        <a
                          href={pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-sky-700 hover:underline dark:text-sky-300"
                        >
                          <ExternalLink className="size-3.5" /> Mở tab mới
                        </a>
                      </div>
                    )}
                  </div>
                  {pdfLoading ? (
                    <div className="grid h-[32rem] place-items-center text-slate-500">Đang tải file PDF…</div>
                  ) : pdfUrl ? (
                    <iframe title="PDF nghị quyết chờ ký ban hành" src={pdfUrl} className="h-[28rem] w-full" />
                  ) : (
                    <div className="grid h-32 place-items-center px-4 text-center text-red-700 dark:text-red-300">
                      {pdfError || "Nghị quyết chưa có file PDF gốc để xem."}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  className="mt-2 !py-1.5 !px-3 !text-xs"
                  onClick={doIssue}
                  disabled={loading || pdfLoading || !pdfUrl}
                  title={!pdfUrl ? "Cần tải được file PDF gốc trước khi ký." : "Ký ban hành nghị quyết sau khi xem file PDF"}
                >
                  <CheckCircle2 className="size-3.5" /> {loading ? "Đang xử lý…" : "Ký ban hành nghị quyết"}
                </Button>
              </div>
            </div>
          )}

          {activeResolution?.status === "issued" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <div>
                <b>Đã ký ban hành.</b> Bộ phận giúp việc tiến hành bóc tách chỉ tiêu và phân về các ban.
              </div>
              <Button
                type="button"
                className="!py-1.5 !px-3 !text-xs !bg-emerald-600 hover:!bg-emerald-700 !text-white"
                onClick={() => onGo?.("tree")}
              >
                Chuyển sang Bóc tách chỉ tiêu →
              </Button>
            </div>
          )}
          {activeResolution && ["extracted", "pending_distribution", "distributed"].includes(activeResolution.status) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
              Trạng thái: <b>{resolutionStatusLabel(activeResolution.status)}</b>. Bộ phận giúp việc sẽ đẩy lên để Thường trực xác nhận hoàn thành.
            </div>
          )}

          {/* Quy trình mới: Thường trực xác nhận hoàn thành */}
          {activeResolution && canConfirmCompletion && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50/90 p-3.5 text-xs text-emerald-900 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1">
                <p className="font-extrabold">{activeResolution.status === "pending_completion" ? "Chờ Thường trực xác nhận hoàn thành" : "Sẵn sàng xác nhận hoàn thành"}</p>
                <p className="mt-0.5 leading-relaxed">Bộ phận giúp việc đã hoàn tất xử lý và đẩy lên. Thường trực xác nhận nghị quyết đã hoàn thành.</p>
                <Button type="button" className="mt-2 !py-1.5 !px-3 !text-xs !bg-emerald-600 hover:!bg-emerald-700" onClick={doConfirmCompletion} disabled={loading}>
                  <ShieldCheck className="size-3.5" /> {loading ? "Đang xử lý…" : "Xác nhận đã hoàn thành"}
                </Button>
              </div>
            </div>
          )}
          {activeResolution?.status === "completed" && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50/90 p-3 text-xs font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              Thường trực đã xác nhận nghị quyết hoàn thành.
            </div>
          )}

          {/* Tương thích luồng cũ */}
          {activeResolution?.status === "pending_ban_review" && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              Dữ liệu luồng cũ: đang chờ thẩm tra. {onGo && <button type="button" className="font-bold underline ml-1" onClick={() => onGo("tree")}>Mở Cây chỉ tiêu</button>}
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState
              icon={ListTree}
              title="Chưa có chỉ tiêu nào để duyệt"
              hint="Chọn nghị quyết ở dropdown trên rồi bấm tải — cây do chuyên viên lưu sẽ hiện ở đây, khỏi cần chung tab."
              action={
                <Button tone="secondary" onClick={fetchList} disabled={loading || !activeResId}>
                  <Download className="size-4" /> {loading ? "Đang tải…" : "Tải danh sách từ server"}
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex gap-2">
                <Button tone="secondary" onClick={fetchList} disabled={loading} className="flex-1">
                  <Download className="size-4" /> Tải lại
                </Button>
                <Button
                  onClick={approveAll}
                  disabled={doneCount === rows.length || !canApprove}
                  className="flex-1"
                  title={!canApprove ? "Cần Ban HĐND xã đồng ý thông qua trước khi Thường trực phê duyệt" : ""}
                >
                  <CheckCircle2 className="size-4" /> Duyệt tất cả
                </Button>
              </div>
              <ul className="space-y-2">
                {rows.map((r, i) => (
                  <motion.li
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-slate-200/80 p-3 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark: text-slate-600">
                        {i + 1}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm font-bold tracking-tight" title={r.title}>
                        {r.title}
                      </p>
                      {r.approved ? (
                        <Badge tone="emerald"><CheckCircle2 className="size-3" /> Đã duyệt</Badge>
                      ) : (
                        <Button
                          onClick={() => approve(r)}
                          disabled={r.busy || !canApprove}
                          title={!canApprove ? "Chờ Ban HĐND đồng ý trước" : ""}
                          className="!px-3 !py-1.5 !text-xs"
                        >
                          {r.busy ? "Đang duyệt…" : "Duyệt"}
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        type="date"
                        value={r.deadline}
                        disabled={r.approved}
                        onChange={(e) => patchRow(r.id, { deadline: e.target.value })}
                        title="Ấn định deadline"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none transition-all duration-200 hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                      />
                      <Select
                        value={r.dept}
                        disabled={r.approved}
                        onChange={(e) => patchRow(r.id, { dept: e.target.value })}
                        title="Đơn vị"
                        className="!px-2 !py-1.5 !text-xs"
                      >
                        {DEPTS.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </Select>
                      <Select
                        value={r.role}
                        disabled={r.approved}
                        onChange={(e) => patchRow(r.id, { role: e.target.value })}
                        title="Vai trò"
                        className="!px-2 !py-1.5 !text-xs"
                      >
                        {ROLES.map((x) => (
                          <option key={x.id} value={x.id}>{x.name}</option>
                        ))}
                      </Select>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </>
          )}

          <details className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
            <summary className="cursor-pointer text-xs font-bold text-slate-500 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark: text-slate-600">
              Duyệt thủ công theo ID (trường hợp đặc biệt)
            </summary>
            <div className="grid gap-2 py-2 sm:grid-cols-3">
              <TextInput mono value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="indicatorId…" className="!py-1.5 !text-xs" />
              <TextInput type="date" value={manualDeadline} onChange={(e) => setManualDeadline(e.target.value)} className="!py-1.5 !text-xs" />
              <Button
                tone="secondary"
                className="!py-1.5 !text-xs"
                onClick={() => manualId.trim() && approve({ id: manualId.trim(), title: manualId.trim(), dept: "ubnd-xa", role: "primary" }, manualDeadline)}
              >
                Duyệt ID này
              </Button>
            </div>
          </details>
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader icon={CalendarClock} title="Trước khi duyệt" sub="Checklist của Thường trực" />
        <ul className="space-y-2.5 px-5 py-4 text-[13px] font-medium leading-relaxed text-slate-500 dark: text-slate-600">
          {[
            "Mỗi chỉ tiêu có đúng 1 đơn vị chủ trì, deadline khả thi.",
            "Chu kỳ báo cáo khớp tính chất chỉ tiêu (tháng / quý / năm).",
            "Bấm Duyệt tất cả khi mọi dòng đã chuẩn — từng dòng vẫn sửa được trước khi duyệt.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
              {t}
            </li>
          ))}
        </ul>
        <div className="px-5 pb-4">
          <Field label="resolutionId đang xử lý">
            <TextInput mono value={activeResId || ""} readOnly placeholder="Chưa có" />
          </Field>
        </div>
      </Card>
      {pdfFullscreen && pdfUrl && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-slate-950"
          role="dialog"
          aria-modal="true"
          aria-label="Xem toàn màn hình nghị quyết"
        >
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 text-white">
            <div className="flex min-w-0 items-center gap-2 text-sm font-bold">
              <FileText className="size-4 shrink-0 text-sky-300" />
              <span className="truncate">
                {activeResolution?.codeNumber || "Nghị quyết"} — Xem PDF trước khi ký ban hành
              </span>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-white"
              >
                <ExternalLink className="size-3.5" /> Mở tab mới
              </a>
              <button
                type="button"
                onClick={() => setPdfFullscreen(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold hover:bg-slate-800"
              >
                <X className="size-3.5" /> Đóng
              </button>
            </div>
          </div>
          <iframe
            title="PDF nghị quyết toàn màn hình"
            src={pdfUrl}
            className="min-h-0 flex-1 bg-slate-800"
          />
        </div>
      )}
    </div>
  );
}
