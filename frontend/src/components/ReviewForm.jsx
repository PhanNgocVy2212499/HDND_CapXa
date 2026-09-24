import { AnimatePresence, motion } from "framer-motion";
import { Download, ExternalLink, FileText, MessageSquareText, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import api, { blobErrorMessage, getToken } from "../lib/api";
import { useToast } from "./Toaster";
import { Badge, Button, Card, CardHeader, Field, Select, TextArea } from "./ui";

const statusTone = (s) =>
  s === "approved" ? "emerald" : s === "rejected" ? "red" : s === "submitted" ? "amber" : "slate";

const statusLabel = (s) =>
  s === "approved" ? "Đã duyệt" : s === "rejected" ? "Cần làm lại" : s === "submitted" ? "Chờ thẩm tra" : s || "—";

export default function ReviewForm({ resolution, indicators, reportId, timeline, onReviewed }) {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [id, setId] = useState(reportId ?? "");
  const [status, setStatus] = useState("passed");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setId(reportId ?? "");
  }, [reportId]);

  // Tải báo cáo từ server — Ban chọn từ dropdown, khỏi dán ID
  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = {};
      if (resolution?.id) params.resolutionId = resolution.id;
      params.limit = 50;
      const { data } = await api.get("/reports", { params });
      const list = data.data ?? [];
      setReports(list);
      if (!id && list.length > 0) {
        const firstPending = list.find((r) => r.status === "submitted") || list[0];
        setId(firstPending.id);
      }
      if (list.length === 0) toast("info", "Chưa có báo cáo nào để thẩm tra.");
    } catch (e) {
      toast("error", e.response?.data?.message || "Tải báo cáo thất bại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolution?.id]);

  const indicatorTitle = (indicatorId) =>
    indicators?.find((n) => n.id === indicatorId)?.title || indicatorId?.slice(0, 8) || "—";

  const selected = reports.find((r) => r.id === id) || null;

  const submit = async () => {
    if (!id.trim()) return toast("error", "Chọn báo cáo cần thẩm tra ở dropdown trên.");
    if (!comment.trim()) return toast("error", "Viết nhận xét thẩm tra trước khi gửi.");
    if (!getToken()) return toast("error", "Chưa có token — cần token của Ban HĐND / Thường trực.");
    try {
      setSending(true);
      const { data } = await api.post("/reviews", {
        progressReportId: id.trim(),
        status,
        comment: comment.trim(),
      });
      toast("success", data.message || "Đã ghi nhận thẩm tra.");
      setReports((prev) =>
        prev.map((r) => (r.id === id.trim() ? { ...r, status: status === "passed" ? "approved" : "rejected" } : r))
      );
      onReviewed?.({ status, comment: comment.trim(), at: new Date().toISOString() });
      setComment("");
    } catch (e) {
      toast("error", e.response?.data?.message || "Gửi thẩm tra thất bại.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <Card className="xl:col-span-2">
        <CardHeader
          icon={ShieldCheck}
          title="Thẩm tra báo cáo"
          sub={resolution ? `${resolution.codeNumber} — chọn báo cáo để duyệt` : "Chọn báo cáo để duyệt"}
          action={
            <Button tone="secondary" onClick={fetchReports} disabled={loading} className="!px-3 !py-1.5 !text-xs">
              <Download className="size-3.5" /> {loading ? "Đang tải…" : "Tải lại"}
            </Button>
          }
        />
        <div className="space-y-3 px-5 py-4">
          <Field label="Báo cáo cần thẩm tra">
            {reports.length > 0 ? (
              <Select value={id} onChange={(e) => setId(e.target.value)}>
                <option value="">— Chọn báo cáo —</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{statusLabel(r.status)}] {r.period || ""} · {indicatorTitle(r.indicatorId).slice(0, 40)} · {r.progressPercentage}% ·{" "}
                    {r.reportedAt ? new Date(r.reportedAt).toLocaleDateString("vi-VN") : ""}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-medium text-slate-500 dark:bg-slate-800/50">
                {loading ? "Đang tải báo cáo…" : "Chưa có báo cáo — bấm Tải lại hoặc chờ đơn vị gửi."}
              </p>
            )}
          </Field>

          {selected && (
            <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs leading-relaxed dark:border-slate-800 dark:bg-slate-800/40">
              <p className="font-bold tracking-tight">
                {indicatorTitle(selected.indicatorId)}{" "}
                <Badge tone={statusTone(selected.status)}>{statusLabel(selected.status)}</Badge>
              </p>
              <p>
                <span className="font-semibold">Số liệu:</span> {selected.actualValue} ·{" "}
                <span className="font-semibold">Tiến độ:</span> {selected.progressPercentage}% ·{" "}
                <span className="font-semibold">Kỳ:</span> {selected.period || "—"} ·{" "}
                <span className="font-semibold">Đơn vị:</span> {selected.departmentId || "—"}
              </p>
              {selected.remarks && (
                <p>
                  <span className="font-semibold">Ghi chú:</span> {selected.remarks}
                </p>
              )}
            </div>
          )}

          {selected && <EvidenceViewer report={selected} />}

          <Field label="Kết luận">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="passed">Đồng ý (passed)</option>
              <option value="need_clarification">Yêu cầu giải trình (need_clarification)</option>
            </Select>
          </Field>
          <Field label="Nhận xét">
            <TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Đối chiếu số liệu với minh chứng…" />
          </Field>
          <Button onClick={submit} disabled={sending || !id} className="w-full">
            <Send className="size-4" /> {sending ? "Đang gửi…" : "Gửi thẩm tra"}
          </Button>
        </div>
      </Card>

      <Card className="xl:col-span-3">
        <CardHeader
          icon={MessageSquareText}
          title="Trao đổi thẩm tra"
          sub="Luồng ghi chú 2 chiều quanh báo cáo"
          action={<Badge tone="slate">{timeline.length} lượt</Badge>}
        />
        <div className="px-5 py-4">
          {timeline.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs font-medium leading-relaxed text-slate-600 dark:bg-slate-800/50">
              Chưa có lượt thẩm tra nào trong phiên này.
              <br />
              Chọn báo cáo + gửi nhận xét ở khung bên trái — hội thoại sẽ hiện tại đây.
            </p>
          ) : (
            <ul className="slim-scroll max-h-96 space-y-2.5 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {timeline.map((t, i) => {
                  const ok = t.status === "passed";
                  return (
                    <motion.li
                      key={`${t.at}-${i}`}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${ok ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                          ok
                            ? "rounded-br-md bg-emerald-600 text-white dark:bg-emerald-500"
                            : "rounded-bl-md border border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-800"
                        }`}
                      >
                        <p className={`mb-1 text-[10px] font-extrabold tracking-tight ${ok ? "text-emerald-100" : "text-amber-600 dark:text-amber-400"}`}>
                          {ok ? "ĐỒNG Ý" : "YÊU CẦU GIẢI TRÌNH"} · {new Date(t.at).toLocaleString("vi-VN")}
                        </p>
                        <p className={`text-[13px] font-medium leading-relaxed ${ok ? "text-white" : "text-slate-700 dark:text-slate-200"}`}>
                          {t.comment}
                        </p>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

const isImageUrl = (url) => /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url || "");

/**
 * Khung xem file minh chứng ngay trong màn Thẩm tra — khỏi mở tab mới để đối chiếu.
 * - Mặc định preview thẳng evidenceFileUrl (public).
 * - Nếu link public 403 (bucket chưa makePublic), bấm "Xem qua server":
 *   fetch GET /api/reports/:id/evidence kèm Bearer token → blob URL preview/tải.
 */
function EvidenceViewer({ report }) {
  const toast = useToast();
  const [blobUrl, setBlobUrl] = useState(null);
  const [blobMime, setBlobMime] = useState("");
  const [loading, setLoading] = useState(false);

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
  }, [report?.id]);

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

  if (!report) return null;

  const directUrl = report.evidenceFileUrl || "";
  const src = blobUrl || directUrl;
  const isImage = blobMime
    ? blobMime.startsWith("image/")
    : isImageUrl(directUrl);
  const fileName = `minh-chung-${report.period || report.id || "bao-cao"}`;

  const loadViaServer = async () => {
    if (!report.id) return;
    if (!getToken()) {
      toast("error", "Bạn đã bị đăng xuất — đăng nhập lại để xem qua server.");
      return;
    }
    try {
      setLoading(true);
      // Đi qua instance api để tự refresh token khi 401
      const res = await api.get(`/reports/${report.id}/evidence`, { responseType: "blob" });
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
      toast("success", "Đã tải minh chứng qua server.");
    } catch (e) {
      toast("error", await blobErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-extrabold tracking-tight">
          <FileText className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          File minh chứng
          {blobUrl && (
            <span className="rounded-full bg-sky-600/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
              qua server
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {!blobUrl && report.id && (
            <button
              type="button"
              onClick={loadViaServer}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors outline-none hover:border-emerald-300 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
            >
              <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Đang tải…" : "Xem qua server"}
            </button>
          )}
          {src && (
            <>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors outline-none hover:border-emerald-300 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-slate-700 dark:text-slate-300"
              >
                <ExternalLink className="size-3" /> Mở tab mới
              </a>
              <a
                href={src}
                download={fileName}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors outline-none hover:border-emerald-300 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-slate-700 dark:text-slate-300"
              >
                <Download className="size-3" /> Tải xuống
              </a>
            </>
          )}
        </div>
      </div>

      {!src ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-amber-700 dark:text-amber-300">
          Báo cáo này không có file minh chứng (dữ liệu cũ trước khi bắt buộc đính kèm). Hãy yêu cầu đơn vị
          gửi lại báo cáo kèm văn bản nguồn.
        </p>
      ) : isImage ? (
        <img
          src={src}
          alt="File minh chứng"
          className="max-h-80 w-full rounded-lg border border-slate-200/80 bg-slate-50 object-contain dark:border-slate-800 dark:bg-slate-900"
          onError={() => {
            if (!blobUrl && report.id && !loading) loadViaServer();
          }}
        />
      ) : (
        <object
          data={src}
          type="application/pdf"
          className="h-80 w-full rounded-lg border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
        >
          <iframe title="File minh chứng" src={src} className="h-full w-full rounded-lg" />
        </object>
      )}
      {!blobUrl && directUrl && (
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500">
          Đang xem link trực tiếp — nếu trắng/trang 403, bấm “Xem qua server”.
        </p>
      )}
    </div>
  );
}
