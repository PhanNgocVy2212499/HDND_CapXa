import { motion } from "framer-motion";
import { BadgeCheck, CalendarClock, CheckCircle2, Download, ListTree } from "lucide-react";
import { useEffect, useState } from "react";
import api, { getToken } from "../lib/api";
import { DEPTS, ROLES, deptName } from "../lib/meta";
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

export default function ApproveAssign({ resolution, indicators, onApproved, onPickResolution }) {
  const toast = useToast();
  const [rows, setRows] = useState(() => toRows(indicators));
  const [loading, setLoading] = useState(false);
  const [manualId, setManualId] = useState("");
  const [manualDeadline, setManualDeadline] = useState("");
  const [resList, setResList] = useState([]);
  const [activeResId, setActiveResId] = useState(resolution?.id || "");
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

  const approve = async (row, deadlineOverride) => {
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
      toast("success", data.message || "Đã duyệt và giao việc.");
      onApproved?.(row.id);
    } catch (e) {
      patchRow(row.id, { busy: false });
      toast("error", e.response?.data?.message || "Phê duyệt thất bại — cần quyền Thường trực.");
    }
  };

  const approveAll = async () => {
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
          title="Duyệt từng chỉ tiêu"
          sub={activeResolution ? `${activeResolution.codeNumber} — ${rows.length} chỉ tiêu` : "Chọn nghị quyết ở dưới để tải cây chỉ tiêu"}
          action={
            rows.length > 0 && (
              <Badge tone={doneCount === rows.length ? "emerald" : "amber"}>
                {doneCount}/{rows.length} đã duyệt
              </Badge>
            )
          }
        />
        <div className="space-y-2.5 px-4 py-4">
          <Field label="Nghị quyết cần duyệt (lấy từ server — tab/máy nào cũng thấy)">
            <Select value={activeResId} onChange={(e) => pickResolution(e.target.value)}>
              <option value="">— Chọn nghị quyết —</option>
              {resList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.codeNumber} — {(r.title || "").slice(0, 60)} [{r.status}]
                </option>
              ))}
            </Select>
          </Field>
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
                <Button onClick={approveAll} disabled={doneCount === rows.length} className="flex-1">
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
                        <Button onClick={() => approve(r)} disabled={r.busy} className="!px-3 !py-1.5 !text-xs">
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
    </div>
  );
}
