import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FileText,
  FolderOpen,
  ListTree,
  MessagesSquare,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { alertLevelFor, daysLeft, deptName } from "../lib/meta";
import { AlertDot, Badge, Button, Card, CardHeader, EmptyState, Modal, ProgressBar, ProgressRing, Select } from "./ui";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function Dashboard({ resolution, nodes, reports, reviews, onGo, onPickResolution }) {
  // Reload/tab mới: props RAM trắng nhưng server vẫn có → tự tải lại để Tổng quan không bị xóa
  const [fetchedNodes, setFetchedNodes] = useState([]);
  const [fetchedReports, setFetchedReports] = useState([]);
  const [selected, setSelected] = useState(null);
  // Tổng hợp nhiều nghị quyết: trước đây chỉ tải NQ đang mở nên thêm bao nhiêu NQ cũng thấy có 1
  const [allResolutions, setAllResolutions] = useState([]);
  const [allIndicators, setAllIndicators] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [scope, setScope] = useState("all");
  const [listLoading, setListLoading] = useState(false);

  const toNode = (n) => ({
    key: n.id,
    parent: n.parentId ?? null,
    title: n.title,
    deadline: n.deadline || "",
    dept: n.assignedDepartments?.[0]?.departmentId || "ubnd-xa",
    approved: ["assigned", "in_progress", "completed"].includes(n.status),
    resolutionId: n.resolutionId || "",
    resolutionCodeNumber: n.resolutionCodeNumber || "",
  });

  const loadAll = useCallback(async () => {
    try {
      setListLoading(true);
      const [resRes, indRes, repRes] = await Promise.all([
        api.get("/resolutions", { params: { limit: 30 } }).catch(() => null),
        api.get("/indicators", { params: { limit: 200 } }).catch(() => null),
        api.get("/reports", { params: { limit: 100 } }).catch(() => null),
      ]);
      const resolutions = resRes?.data?.data ?? [];
      if (resolutions.length) setAllResolutions(resolutions);
      if (indRes?.data?.data) {
        setAllIndicators(indRes.data.data);
      } else if (resolutions.length) {
        // Backend cũ bắt buộc resolutionId → tải từng NQ rồi gộp (tối đa 15)
        const lists = await Promise.all(
          resolutions.slice(0, 15).map((r) =>
            api.get("/indicators", { params: { resolutionId: r.id } }).catch(() => null)
          )
        );
        const merged = [];
        lists.forEach((resp, i) => {
          for (const n of resp?.data?.data ?? []) {
            merged.push({
              ...n,
              resolutionId: n.resolutionId || resolutions[i].id,
              resolutionCodeNumber: n.resolutionCodeNumber || resolutions[i].codeNumber || "",
            });
          }
        });
        if (merged.length) setAllIndicators(merged);
      }
      if (repRes?.data?.data) setAllReports(repRes.data.data);
    } catch {
      /* giữ dữ liệu cục bộ, không báo lỗi ồn */
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Mở NQ để làm tiếp: set NQ đang mở ở App + nhảy sang Cây chỉ tiêu (tự tải cây đã lưu)
  const handleContinue = useCallback(
    (r) => {
      if (!r?.id) return;
      setScope(r.id);
      if (r.id !== resolution?.id) onPickResolution?.(r);
      onGo("tree");
    },
    [onPickResolution, onGo, resolution?.id]
  );
  useEffect(() => {
    if ((nodes?.length || 0) > 0 && (reports?.length || 0) > 0) return;
    if (!resolution?.id) return;
    (async () => {
      try {
        const [indRes, repRes] = await Promise.all([
          (nodes?.length || 0) === 0
            ? api.get("/indicators", { params: { resolutionId: resolution.id } })
            : Promise.resolve(null),
          (reports?.length || 0) === 0
            ? api.get("/reports", { params: { resolutionId: resolution.id, limit: 50 } })
            : Promise.resolve(null),
        ]);
        if (indRes?.data?.data) {
          setFetchedNodes(
            indRes.data.data.map((n) => ({
              key: n.id,
              parent: n.parentId ?? null,
              title: n.title,
              deadline: n.deadline || "",
              dept: n.assignedDepartments?.[0]?.departmentId || "ubnd-xa",
              approved: ["assigned", "in_progress", "completed"].includes(n.status),
            }))
          );
        }
        if (repRes?.data?.data) setFetchedReports(repRes.data.data);
      } catch {
        /* giữ số liệu localStorage, không báo lỗi ồn */
      }
    })();
  }, [resolution?.id, nodes?.length, reports?.length]);

  const displayNodes = useMemo(() => {
    if (allIndicators.length > 0) {
      const serverNodes = allIndicators.map(toNode);
      // Server đã có NQ đang mở → bỏ bản local trùng để khỏi đếm 2 lần
      const serverHasCurrent =
        resolution?.id && serverNodes.some((n) => n.resolutionId === resolution.id);
      const local = serverHasCurrent ? [] : nodes || [];
      const combined = [...local, ...serverNodes];
      if (scope === "all") return combined;
      return combined.filter((n) => (n.resolutionId || resolution?.id || "") === scope);
    }
    return nodes?.length > 0 ? nodes : fetchedNodes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allIndicators, nodes, fetchedNodes, scope, resolution?.id]);

  const displayReports = useMemo(() => {
    if (allReports.length > 0) {
      const serverHasCurrent =
        resolution?.id && allReports.some((r) => r.resolutionId === resolution.id);
      const local = serverHasCurrent ? [] : reports || [];
      const combined = [...local, ...allReports];
      if (scope === "all") return combined;
      return combined.filter((r) => (r.resolutionId || resolution?.id || "") === scope);
    }
    return reports?.length > 0 ? reports : fetchedReports;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReports, reports, fetchedReports, scope, resolution?.id]);

  const activeResolution = useMemo(() => {
    if (scope === "all") return null;
    return (
      allResolutions.find((r) => r.id === scope) ||
      (resolution?.id === scope ? resolution : null)
    );
  }, [scope, allResolutions, resolution]);

  const totalResolutions =
    allResolutions.length > 0 ? allResolutions.length : resolution ? 1 : 0;

  const stats = useMemo(() => {
    const avg =
      displayReports.length > 0
        ? Math.round(displayReports.reduce((s, r) => s + (Number(r.progressPercentage) || 0), 0) / displayReports.length)
        : 0;
    const passed = reviews.filter((r) => r.status === "passed").length;
    const scopeHint =
      scope === "all"
        ? `${totalResolutions} văn bản trên server`
        : (activeResolution?.codeNumber ?? resolution?.codeNumber ?? "Chưa upload");
    return [
      { icon: FileText, label: "Nghị quyết", value: String(totalResolutions), hint: scopeHint, tone: "text-sky-500" },
      { icon: ListTree, label: "Chỉ tiêu", value: String(displayNodes.length), hint: displayNodes.length ? `${displayNodes.filter((n) => !n.parent).length} nhóm gốc` : "Chưa dựng cây", tone: "text-emerald-500" },
      { icon: ClipboardList, label: "Báo cáo", value: String(displayReports.length), hint: displayReports.length ? `TB ${avg}% hoàn thành` : "Chưa có báo cáo", tone: "text-amber-500" },
      { icon: MessagesSquare, label: "Thẩm tra đạt", value: String(passed), hint: `${reviews.length} lượt thẩm tra`, tone: "text-violet-500" },
    ];
  }, [resolution, activeResolution, totalResolutions, scope, displayNodes, displayReports, reviews]);

  const overall = useMemo(() => {
    if (!displayReports.length) return 0;
    return Math.round(displayReports.reduce((s, r) => s + (Number(r.progressPercentage) || 0), 0) / displayReports.length);
  }, [displayReports]);

  // Danh sách tiến độ từng chỉ tiêu (báo cáo mới nhất của mỗi chỉ tiêu), % thấp trước
  const progressList = useMemo(() => {
    const byIndicator = new Map();
    for (const r of displayReports) {
      const key = r.indicatorId || r.id;
      if (!key) continue;
      if (!byIndicator.has(key)) byIndicator.set(key, []);
      byIndicator.get(key).push(r);
    }
    const latestOf = (arr) =>
      [...arr].sort((a, b) =>
        String(b.at || b.reportedAt || b.createdAt || "").localeCompare(
          String(a.at || a.reportedAt || a.createdAt || "")
        )
      )[0];
    return displayNodes
      .map((n) => {
        const id = n.key || n.id;
        const list = byIndicator.get(id) || [];
        const last = list.length ? latestOf(list) : null;
        return {
          ...n,
          left: n.left ?? daysLeft(n.deadline),
          progress: last ? Number(last.progressPercentage) || 0 : 0,
          reportCount: list.length,
        };
      })
      .sort((a, b) => a.progress - b.progress);
  }, [displayNodes, displayReports]);

  const alerts = useMemo(() => {
    const red = [];
    const yellow = [];
    for (const n of displayNodes) {
      const level = alertLevelFor(n.deadline);
      if (level === "green") continue;
      const entry = { ...n, left: daysLeft(n.deadline) };
      (level === "red" ? red : yellow).push(entry);
    }
    return { red, yellow };
  }, [displayNodes]);

  const steps = useMemo(
    () => [
      { id: "upload", label: "Upload & OCR", done: !!resolution || totalResolutions > 0 },
      { id: "tree", label: "Cây chỉ tiêu", done: displayNodes.length > 0 },
      {
        id: "review",
        label: "Ban HĐND thẩm tra",
        done:
          allResolutions.some((r) => ["pending_approval", "approved", "completed"].includes(r.status)) ||
          ["pending_approval", "approved", "completed"].includes(resolution?.status),
      },
      { id: "approve", label: "Thường trực duyệt", done: displayNodes.some((n) => n.approved) },
      { id: "report", label: "Báo cáo tiến độ", done: displayReports.length > 0 },
      { id: "review", label: "Thẩm tra báo cáo", done: reviews.some((r) => r.status === "passed") },
    ],
    [resolution, totalResolutions, allResolutions, displayNodes, displayReports, reviews]
  );

  const scopeCounts = useMemo(() => {
    const map = new Map();
    for (const n of displayNodes) {
      const rid = n.resolutionId || resolution?.id || "";
      if (!rid) continue;
      map.set(rid, (map.get(rid) ?? 0) + 1);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayNodes, resolution?.id]);

  return (
    <div className="space-y-5">
      {/* Pipeline */}
      <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
        <Card className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  onClick={() => onGo(s.id)}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold tracking-tight transition-all duration-200 outline-none hover:border-emerald-300 hover:bg-emerald-50 focus-visible:ring-4 focus-visible:ring-emerald-500/30 active:scale-95 dark:border-slate-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-500/10"
                >
                  {s.done ? (
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                  ) : (
                    <span className="grid size-3.5 place-items-center rounded-full border border-slate-300 text-[9px] font-extrabold text-slate-600 dark:border-slate-600">
                      {i + 1}
                    </span>
                  )}
                  <span className={s.done ? "text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-500"}>
                    {s.label}
                  </span>
                </button>
                {i < steps.length - 1 && <ArrowRight className="size-3.5 text-slate-300 dark:text-slate-600" />}
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Phạm vi nghị quyết: mặc định xem tất cả, khỏi tưởng mất dữ liệu */}
      <motion.div {...fadeUp} transition={{ duration: 0.3 }}>
        <Card className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-52 flex-1">
              <label className="mb-1.5 block text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">
                Phạm vi nghị quyết
              </label>
              <Select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">
                  Tất cả ({totalResolutions} NQ · {displayNodes.length} chỉ tiêu)
                </option>
                {allResolutions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.codeNumber} — {(r.title || "").slice(0, 50)} · {scopeCounts.get(r.id) ?? 0} chỉ tiêu
                  </option>
                ))}
                {resolution && !allResolutions.some((r) => r.id === resolution.id) && (
                  <option value={resolution.id}>
                    {resolution.codeNumber} — {(resolution.title || "").slice(0, 50)} (đang mở)
                  </option>
                )}
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                tone="secondary"
                onClick={loadAll}
                disabled={listLoading}
                className="!px-3 !py-2 !text-xs"
              >
                <RefreshCw className={`size-3.5 ${listLoading ? "animate-spin" : ""}`} />
                {listLoading ? "Đang tải…" : "Tải lại"}
              </Button>
            </div>
          </div>
          {scope !== "all" && activeResolution && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600 dark:text-slate-400" title={activeResolution.title}>
                Đang xem: <b>{activeResolution.codeNumber}</b> — {activeResolution.title}
              </p>
              {activeResolution.id !== resolution?.id && (
                <Button onClick={() => handleContinue(activeResolution)} className="!px-3 !py-1.5 !text-xs">
                  <FolderOpen className="size-3.5" /> Mở NQ này để làm tiếp
                </Button>
              )}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
          >
            <Card className="px-4 py-4 transition-all duration-200 hover:shadow-md">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <s.icon className={`size-4.5 ${s.tone}`} strokeWidth={2.2} />
                </span>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
              <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{s.value}</p>
              <p className="mt-0.5 truncate text-xs font-medium text-slate-600" title={s.hint}>
                {s.hint}
              </p>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Overall progress */}
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.1 }} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader icon={CheckCircle2} title="Tiến độ tổng quan" sub="Trung bình các báo cáo đã gửi · bấm từng dòng để xem chi tiết" />
            <div className="space-y-4 px-5 py-5">
              <div className="flex items-center gap-5">
                <ProgressRing value={overall} />
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-500 dark:text-slate-400">Hoàn thành</span>
                      <span className="text-slate-800 dark:text-slate-100">{overall}%</span>
                    </div>
                    <ProgressBar value={overall} />
                  </div>
                  {activeResolution ? (
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="truncate text-xs font-bold tracking-tight" title={activeResolution.title}>
                        {activeResolution.codeNumber} — {activeResolution.title}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-600">
                        Ký bởi {activeResolution.signer || "—"} · {displayNodes.length} chỉ tiêu
                      </p>
                    </div>
                  ) : scope === "all" && totalResolutions > 0 ? (
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-xs font-bold tracking-tight">
                        Đang xem tất cả {totalResolutions} nghị quyết
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-600">
                        {displayNodes.length} chỉ tiêu · {displayReports.length} báo cáo — chọn 1 NQ ở trên để lọc
                      </p>
                    </div>
                  ) : resolution ? (
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="truncate text-xs font-bold tracking-tight" title={resolution.title}>
                        {resolution.codeNumber} — {resolution.title}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-600">
                        Ký bởi {resolution.signer || "—"} · {displayNodes.length} chỉ tiêu
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-slate-600">
                      Chưa có dữ liệu — bắt đầu ở bước Upload &amp; OCR.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-extrabold tracking-tight text-slate-500 dark:text-slate-400">
                  Danh sách tiến độ ({progressList.length})
                </p>
                {progressList.length === 0 ? (
                  <EmptyState title="Trống" hint="Chưa có chỉ tiêu nào — dựng cây chỉ tiêu trước." />
                ) : (
                  <ul className="slim-scroll max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {progressList.map((n) => (
                      <li key={n.key || n.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(n)}
                          title="Bấm để xem chi tiết"
                          className="w-full cursor-pointer rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-left transition-all duration-200 outline-none hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-sm focus-visible:ring-4 focus-visible:ring-emerald-500/30 active:scale-[0.99] dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-emerald-700 dark:hover:bg-emerald-500/10"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate text-xs font-bold tracking-tight">
                              {n.title || "(chưa đặt tên)"}
                            </p>
                            <span className="shrink-0 text-xs font-extrabold text-slate-700 dark:text-slate-200">
                              {n.progress}%
                            </span>
                          </div>
                          <div className="mt-1.5">
                            <ProgressBar value={n.progress} />
                          </div>
                          <p className="mt-1 text-[11px] font-medium text-slate-500">
                            {deptName(n.dept)} · {n.reportCount} báo cáo · hạn {n.deadline || "—"}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Alerts */}
        <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.16 }} className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader
              icon={AlertTriangle}
              title="Cảnh báo deadline"
              sub="Đồng bộ logic cron backend (đỏ: quá hạn · vàng: ≤ 7 ngày)"
              action={
                <div className="flex gap-1.5">
                  <Badge tone="red">{alerts.red.length} đỏ</Badge>
                  <Badge tone="amber">{alerts.yellow.length} vàng</Badge>
                </div>
              }
            />
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <AlertColumn
                tone="red"
                title="Quá hạn"
                icon={CircleAlert}
                items={alerts.red}
                onGo={onGo}
                onSelect={setSelected}
                emptyHint="Không có chỉ tiêu quá hạn. Tuyệt vời!"
              />
              <AlertColumn
                tone="yellow"
                title="Sắp đến hạn"
                icon={AlertTriangle}
                items={alerts.yellow}
                onGo={onGo}
                onSelect={setSelected}
                emptyHint="Không có chỉ tiêu cận hạn trong 7 ngày tới."
              />
            </div>
          </Card>
        </motion.div>
      </div>

      <AlertDetailModal
        item={selected}
        nodes={displayNodes}
        reports={displayReports}
        resolution={activeResolution || resolution}
        resolutions={allResolutions}
        onClose={() => setSelected(null)}
        onGo={(v) => {
          setSelected(null);
          onGo(v);
        }}
        onContinue={(r) => {
          setSelected(null);
          handleContinue(r);
        }}
      />
    </div>
  );
}

function AlertColumn({ tone, title, icon: Icon, items, emptyHint, onGo, onSelect }) {
  return (
    <div>
      <p
        className={`mb-2 flex items-center gap-1.5 text-xs font-extrabold tracking-tight ${
          tone === "red" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
        }`}
      >
        <Icon className="size-3.5" /> {title} ({items.length})
      </p>
      {items.length === 0 ? (
        <EmptyState title="Trống" hint={emptyHint} />
      ) : (
        <ul className="slim-scroll max-h-56 space-y-2 overflow-y-auto pr-1">
          {items.map((n) => (
            <li key={n.key}>
              <button
                type="button"
                onClick={() => onSelect?.(n)}
                title="Bấm để xem chi tiết"
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-left transition-all duration-200 outline-none hover:border-emerald-300 hover:bg-emerald-50/60 hover:shadow-sm focus-visible:ring-4 focus-visible:ring-emerald-500/30 active:scale-[0.99] dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-emerald-700 dark:hover:bg-emerald-500/10"
              >
                <AlertDot level={tone === "red" ? "red" : "yellow"} pulse />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold tracking-tight">{n.title || "(chưa đặt tên)"}</p>
                  <p className="text-xs font-medium text-slate-600">
                    {deptName(n.dept)} · hạn {n.deadline || "—"} ·{" "}
                    {n.left < 0 ? `quá ${Math.abs(n.left)} ngày` : `còn ${n.left} ngày`}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-slate-300 dark:text-slate-600" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 && (
        <button
          onClick={() => onGo("tree")}
          className="mt-2 text-xs font-bold text-emerald-600 transition-colors hover:text-emerald-500 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:text-emerald-400"
        >
          Sang bước Cây chỉ tiêu →
        </button>
      )}
    </div>
  );
}

function formatDateVN(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("vi-VN");
}

function AlertDetailModal({ item, nodes, reports, resolution, resolutions, onClose, onGo, onContinue }) {
  const related = useMemo(() => {
    if (!item) return [];
    const id = item.key || item.id;
    return (reports || []).filter((r) => (r.indicatorId || r.id) === id);
  }, [item, reports]);

  const latest = useMemo(() => {
    if (related.length === 0) return null;
    return [...related].sort((a, b) =>
      String(b.at || b.reportedAt || b.createdAt || "").localeCompare(
        String(a.at || a.reportedAt || a.createdAt || "")
      )
    )[0];
  }, [related]);

  const history = useMemo(() => {
    return [...related]
      .sort((a, b) =>
        String(b.at || b.reportedAt || b.createdAt || "").localeCompare(
          String(a.at || a.reportedAt || a.createdAt || "")
        )
      )
      .slice(0, 5);
  }, [related]);

  const parentTitle = useMemo(() => {
    if (!item?.parent) return null;
    return nodes?.find((n) => (n.key || n.id) === item.parent)?.title || null;
  }, [item, nodes]);

  const progress = latest ? Number(latest.progressPercentage) || 0 : 0;
  const isOverdue = (item?.left ?? 0) < 0;

  // Chỉ tiêu thuộc NQ khác NQ đang mở → cần mở NQ đó trước khi làm tiếp
  const itemResolution =
    resolutions?.find((r) => r.id === (item?.resolutionId || "")) ||
    (item?.resolutionId && resolution?.id === item.resolutionId ? resolution : null);
  const needsSwitch =
    Boolean(item?.resolutionId) &&
    itemResolution &&
    itemResolution.id !== resolution?.id;

  return (
    <Modal open={Boolean(item)} onClose={onClose} title="Chi tiết chỉ tiêu">
      {item && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.left === null || item.left === undefined ? (
              <Badge tone="slate">Chưa có deadline</Badge>
            ) : (
              <Badge tone={isOverdue ? "red" : "amber"}>
                {item.left < 0 ? `Quá hạn ${Math.abs(item.left)} ngày` : `Còn ${item.left} ngày`}
              </Badge>
            )}
            <Badge tone={item.approved ? "emerald" : "slate"}>
              {item.approved ? "Đã phê duyệt" : "Chưa phê duyệt"}
            </Badge>
            {latest && <Badge tone="sky">{related.length} báo cáo</Badge>}
          </div>

          <p className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">
            {item.title || "(chưa đặt tên)"}
          </p>

          <dl className="grid gap-2.5 text-xs sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <dt className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400">
                <Building2 className="size-3.5" /> Đơn vị
              </dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                {deptName(item.dept)}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <dt className="flex items-center gap-1.5 font-bold text-slate-500 dark:text-slate-400">
                <CalendarDays className="size-3.5" /> Deadline
              </dt>
              <dd className="mt-1 font-semibold text-slate-800 dark:text-slate-100">
                {formatDateVN(item.deadline)}
              </dd>
            </div>
          </dl>

          {(parentTitle || resolution || item?.resolutionCodeNumber) && (
            <div className="space-y-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              {parentTitle && (
                <p>
                  <span className="font-bold">Nhóm cha:</span> {parentTitle}
                </p>
              )}
              {(item?.resolutionCodeNumber || resolution) && (
                <p className="truncate" title={resolution?.title || item?.resolutionCodeNumber}>
                  <span className="font-bold">Nghị quyết:</span>{" "}
                  {item?.resolutionCodeNumber || resolution.codeNumber}
                  {resolution?.title &&
                  (!item?.resolutionCodeNumber ||
                    item.resolutionCodeNumber === resolution.codeNumber)
                    ? ` — ${resolution.title}`
                    : ""}
                </p>
              )}
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-500 dark:text-slate-400">Tiến độ mới nhất</span>
              <span className="text-slate-800 dark:text-slate-100">{progress}%</span>
            </div>
            <ProgressBar value={progress} />
            {latest ? (
              <p className="mt-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                Kỳ {latest.period || "—"} · số liệu {latest.actualValue ?? "—"} ·{" "}
                {(latest.at || latest.reportedAt)
                  ? new Date(latest.at || latest.reportedAt).toLocaleDateString("vi-VN")
                  : "chưa rõ ngày"}
                {latest.remarks ? ` · ${latest.remarks}` : ""}
              </p>
            ) : (
              <p className="mt-1.5 text-xs font-medium text-slate-500">
                Chưa có báo cáo nào cho chỉ tiêu này.
              </p>
            )}
          </div>

          {history.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-extrabold tracking-tight text-slate-500 dark:text-slate-400">
                Lịch sử báo cáo ({related.length})
              </p>
              <ul className="slim-scroll max-h-44 space-y-1.5 overflow-y-auto pr-1">
                {history.map((r, i) => (
                  <li
                    key={r.id || r.reportId || `${r.period}-${i}`}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">
                        {r.period || "Chưa rõ kỳ"} · {r.progressPercentage ?? 0}%
                      </span>
                      <span className="shrink-0 font-medium text-slate-500">
                        {(r.at || r.reportedAt)
                          ? new Date(r.at || r.reportedAt).toLocaleDateString("vi-VN")
                          : "—"}
                      </span>
                    </div>
                    {(r.actualValue !== undefined || r.remarks || r.evidenceFileUrl) && (
                      <p className="mt-0.5 truncate font-medium text-slate-600 dark:text-slate-400">
                        {r.actualValue !== undefined ? `Số liệu ${r.actualValue} · ` : ""}
                        {r.remarks || ""}
                        {r.evidenceFileUrl ? " · có minh chứng" : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            <Button tone="secondary" onClick={() => onGo("tree")} className="!px-3 !py-2 !text-xs">
              Cây chỉ tiêu
            </Button>
            <Button tone="secondary" onClick={() => onGo("report")} className="!px-3 !py-2 !text-xs">
              Báo cáo
            </Button>
            <Button onClick={() => onGo("review")} className="!px-3 !py-2 !text-xs">
              Thẩm tra
            </Button>
          </div>
          {needsSwitch && (
            <Button onClick={() => onContinue(itemResolution)} className="w-full !py-2.5 !text-xs">
              <FolderOpen className="size-3.5" /> Mở {itemResolution.codeNumber} để làm tiếp (cây / duyệt / báo cáo / thẩm tra)
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
