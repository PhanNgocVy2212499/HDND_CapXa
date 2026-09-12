import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FileText,
  ListTree,
  MessagesSquare,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import { alertLevelFor, daysLeft, deptName } from "../lib/meta";
import { AlertDot, Badge, Card, CardHeader, EmptyState, ProgressBar, ProgressRing } from "./ui";

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

export default function Dashboard({ resolution, nodes, reports, reviews, onGo }) {
  // Reload/tab mới: props RAM trắng nhưng server vẫn có → tự tải lại để Tổng quan không bị xóa
  const [fetchedNodes, setFetchedNodes] = useState([]);
  const [fetchedReports, setFetchedReports] = useState([]);
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

  const displayNodes = nodes?.length > 0 ? nodes : fetchedNodes;
  const displayReports = reports?.length > 0 ? reports : fetchedReports;
  const stats = useMemo(() => {
    const avg =
      displayReports.length > 0
        ? Math.round(displayReports.reduce((s, r) => s + (Number(r.progressPercentage) || 0), 0) / displayReports.length)
        : 0;
    const passed = reviews.filter((r) => r.status === "passed").length;
    return [
      { icon: FileText, label: "Nghị quyết", value: resolution ? "1" : "0", hint: resolution?.codeNumber ?? "Chưa upload", tone: "text-sky-500" },
      { icon: ListTree, label: "Chỉ tiêu", value: String(displayNodes.length), hint: displayNodes.length ? `${displayNodes.filter((n) => !n.parent).length} nhóm gốc` : "Chưa dựng cây", tone: "text-emerald-500" },
      { icon: ClipboardList, label: "Báo cáo", value: String(displayReports.length), hint: displayReports.length ? `TB ${avg}% hoàn thành` : "Chưa có báo cáo", tone: "text-amber-500" },
      { icon: MessagesSquare, label: "Thẩm tra đạt", value: String(passed), hint: `${reviews.length} lượt thẩm tra`, tone: "text-violet-500" },
    ];
  }, [resolution, displayNodes, displayReports, reviews]);

  const overall = useMemo(() => {
    if (!displayReports.length) return 0;
    return Math.round(displayReports.reduce((s, r) => s + (Number(r.progressPercentage) || 0), 0) / displayReports.length);
  }, [displayReports]);

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
  }, [nodes]);

  const steps = useMemo(
    () => [
      { id: "upload", label: "Upload & OCR", done: !!resolution },
      { id: "tree", label: "Cây chỉ tiêu", done: displayNodes.length > 0 },
      { id: "approve", label: "Phê duyệt", done: displayNodes.some((n) => n.approved) },
      { id: "report", label: "Báo cáo", done: displayReports.length > 0 },
      { id: "review", label: "Thẩm tra", done: reviews.some((r) => r.status === "passed") },
    ],
    [resolution, displayNodes, displayReports, reviews]
  );

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
            <CardHeader icon={CheckCircle2} title="Tiến độ tổng quan" sub="Trung bình các báo cáo đã gửi" />
            <div className="flex items-center gap-5 px-5 py-5">
              <ProgressRing value={overall} />
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-500 dark:text-slate-400">Hoàn thành</span>
                    <span className="text-slate-800 dark:text-slate-100">{overall}%</span>
                  </div>
                  <ProgressBar value={overall} />
                </div>
                {resolution ? (
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
                emptyHint="Không có chỉ tiêu quá hạn. Tuyệt vời!"
              />
              <AlertColumn
                tone="yellow"
                title="Sắp đến hạn"
                icon={AlertTriangle}
                items={alerts.yellow}
                onGo={onGo}
                emptyHint="Không có chỉ tiêu cận hạn trong 7 ngày tới."
              />
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

function AlertColumn({ tone, title, icon: Icon, items, emptyHint, onGo }) {
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
            <li
              key={n.key}
              className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 transition-all duration-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-800/40"
            >
              <AlertDot level={tone === "red" ? "red" : "yellow"} pulse />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold tracking-tight">{n.title || "(chưa đặt tên)"}</p>
                <p className="text-xs font-medium text-slate-600">
                  {deptName(n.dept)} · hạn {n.deadline || "—"} ·{" "}
                  {n.left < 0 ? `quá ${Math.abs(n.left)} ngày` : `còn ${n.left} ngày`}
                </p>
              </div>
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
