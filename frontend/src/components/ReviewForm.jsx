import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  ListTree,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import api, { API_ROOT, blobErrorMessage, getToken } from "../lib/api";
import { cx, deptName, freqName, resolutionStatusLabel, resolutionStatusTone } from "../lib/meta";
import { useToast } from "./Toaster";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Select, TextArea } from "./ui";

const statusTone = (s) =>
  s === "approved" ? "emerald" : s === "rejected" ? "red" : s === "submitted" ? "amber" : "slate";

const statusLabel = (s) =>
  s === "approved" ? "Đã duyệt" : s === "rejected" ? "Cần làm lại" : s === "submitted" ? "Chờ thẩm tra" : s || "—";

export default function ReviewForm({
  role,
  resolution,
  indicators,
  reportId,
  timeline,
  onReviewed,
  onResolutionUpdated,
}) {
  const toast = useToast();
  // Tab 1: Thẩm tra cây chỉ tiêu | Tab 2: Thẩm tra báo cáo tiến độ
  const [subTab, setSubTab] = useState(reportId ? "report" : "tree");

  // State thẩm tra Cây chỉ tiêu (Mới - theo luồng Ban HĐND)
  const [resList, setResList] = useState([]);
  const [treeResId, setTreeResId] = useState(resolution?.id || "");
  const [treeIndicators, setTreeIndicators] = useState([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [banStatus, setBanStatus] = useState("approved");
  const [banComment, setBanComment] = useState("");
  const [sendingBan, setSendingBan] = useState(false);

  // State thẩm tra Báo cáo tiến độ (hiện có)
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [id, setId] = useState(reportId ?? "");
  const [status, setStatus] = useState("passed");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  // Tải danh sách Nghị quyết để Ban thẩm tra cây chỉ tiêu
  const fetchResolutions = async () => {
    try {
      const { data } = await api.get("/resolutions", { params: { limit: 50 } });
      const list = data.data ?? [];
      setResList(list);
      if (!treeResId && list.length > 0) {
        // Ưu tiên NQ đang chờ Ban thẩm tra (pending_ban_review)
        const pending = list.find((r) => r.status === "pending_ban_review") || list[0];
        setTreeResId(pending.id);
      }
    } catch {
      /* offline */
    }
  };

  useEffect(() => {
    fetchResolutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tải danh sách chỉ tiêu của NQ được chọn
  const fetchTreeIndicators = async (rid) => {
    if (!rid) {
      setTreeIndicators([]);
      return;
    }
    try {
      setLoadingTree(true);
      const { data } = await api.get("/indicators", { params: { resolutionId: rid } });
      setTreeIndicators(data.data ?? []);
    } catch (e) {
      toast("error", e.response?.data?.message || "Tải danh sách chỉ tiêu thất bại.");
    } finally {
      setLoadingTree(false);
    }
  };

  useEffect(() => {
    if (treeResId) fetchTreeIndicators(treeResId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [treeResId]);

  useEffect(() => {
    setId(reportId ?? "");
  }, [reportId]);

  // Tải báo cáo từ server — Ban chọn từ dropdown
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

  const selectedReport = reports.find((r) => r.id === id) || null;
  const selectedTreeRes = resList.find((r) => r.id === treeResId) || resolution || null;

  // Gửi thẩm tra Cây chỉ tiêu
  const submitTreeReview = async () => {
    if (!treeResId) return toast("error", "Vui lòng chọn Nghị quyết cần thẩm tra.");
    if (!getToken()) return toast("error", "Chưa có token — cần đăng nhập tài khoản Ban HĐND.");
    try {
      setSendingBan(true);
      const { data } = await api.post(`/resolutions/${encodeURIComponent(treeResId)}/ban-review`, {
        status: banStatus,
        comment: banComment.trim(),
      });
      toast("success", data.message || "Đã lưu kết luận thẩm tra cây chỉ tiêu.");
      const nextStatus = data.data?.status || (banStatus === "approved" ? "pending_approval" : "revision_requested");
      const updatedRes = {
        ...selectedTreeRes,
        status: nextStatus,
        banReview: data.data?.banReview,
      };
      setResList((prev) =>
        prev.map((r) => (r.id === treeResId ? { ...r, status: nextStatus, banReview: updatedRes.banReview } : r))
      );
      if (resolution?.id === treeResId) {
        onResolutionUpdated?.(updatedRes);
      }
      setBanComment("");
    } catch (e) {
      toast("error", e.response?.data?.message || "Thẩm tra cây chỉ tiêu thất bại.");
    } finally {
      setSendingBan(false);
    }
  };

  // Gửi thẩm tra Báo cáo tiến độ
  const submitReportReview = async () => {
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

  const pendingTreeCount = resList.filter((r) => r.status === "pending_ban_review").length;
  const pendingReportCount = reports.filter((r) => r.status === "submitted").length;

  return (
    <div className="space-y-4">
      {/* Tab chuyển đổi thẩm tra dành cho Ban HĐND */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSubTab("tree")}
            className={cx(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all outline-none",
              subTab === "tree"
                ? "bg-[#a31f1f] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            )}
          >
            <ListTree className="size-4" />
            <span>1. Thẩm tra Cây chỉ tiêu NQ</span>
            {pendingTreeCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-900">
                {pendingTreeCount} chờ
              </span>
            )}
          </button>

          <button
            onClick={() => setSubTab("report")}
            className={cx(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all outline-none",
              subTab === "report"
                ? "bg-[#a31f1f] text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            )}
          >
            <FileText className="size-4" />
            <span>2. Thẩm tra Báo cáo tiến độ</span>
            {pendingReportCount > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-900">
                {pendingReportCount} chờ
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="rose">Nhiệm vụ Ban HĐND xã</Badge>
        </div>
      </div>

      {/* PHÂN HỆ 1: THẨM TRA CÂY CHỈ TIÊU (Theo yêu cầu của người dùng) */}
      {subTab === "tree" && (
        <div className="grid gap-5 xl:grid-cols-5">
          {/* CỘT TRÁI: FORM THẨM TRA CÂY CHỈ TIÊU */}
          <Card className="xl:col-span-2">
            <CardHeader
              icon={ShieldCheck}
              title="Thẩm định dự thảo chỉ tiêu"
              sub="Ban HĐND đồng ý thông qua trước khi gửi Thường trực"
              action={
                <Button
                  tone="secondary"
                  onClick={fetchResolutions}
                  className="!px-3 !py-1.5 !text-xs"
                >
                  <RefreshCw className="size-3.5" /> Tải lại
                </Button>
              }
            />
            <div className="space-y-3 px-5 py-4">
              <Field label="Nghị quyết cần thẩm tra cây chỉ tiêu">
                <Select value={treeResId} onChange={(e) => setTreeResId(e.target.value)}>
                  <option value="">— Chọn Nghị quyết —</option>
                  {resList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.codeNumber} — {(r.title || "").slice(0, 45)} [{resolutionStatusLabel(r.status)}]
                    </option>
                  ))}
                </Select>
              </Field>

              {selectedTreeRes && (
                <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-xs leading-relaxed dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-[#a31f1f] dark:text-red-400">
                      {selectedTreeRes.codeNumber}
                    </span>
                    <Badge tone={resolutionStatusTone(selectedTreeRes.status)}>
                      {resolutionStatusLabel(selectedTreeRes.status)}
                    </Badge>
                  </div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    {selectedTreeRes.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Người ký: <b>{selectedTreeRes.signer || "—"}</b>
                    {(selectedTreeRes.fileUrl || selectedTreeRes.id) && (
                      <a
                        href={`${API_ROOT}/resolutions/${selectedTreeRes.id}/file?token=${encodeURIComponent(getToken() || "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 inline-flex items-center gap-1 font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                      >
                        <ExternalLink className="size-3" /> Xem PDF gốc
                      </a>
                    )}
                  </p>
                  {selectedTreeRes.banReview && (
                    <div className="mt-1.5 rounded-lg border border-slate-200 bg-white p-2 text-[11px] dark:border-slate-700 dark:bg-slate-900">
                      <p className="font-bold text-slate-600 dark:text-slate-300">
                        Ý kiến thẩm tra trước đó ({selectedTreeRes.banReview.reviewedBy || "Ban HĐND"}):
                      </p>
                      <p className="italic text-slate-700 dark:text-slate-200">
                        "{selectedTreeRes.banReview.comment}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Field label="Kết luận của Ban HĐND">
                <Select value={banStatus} onChange={(e) => setBanStatus(e.target.value)}>
                  <option value="approved">Đồng ý thông qua (Chuyển Thường trực duyệt & giao việc)</option>
                  <option value="rejected">Yêu cầu chỉnh sửa (Trả lại Chuyên viên sửa đổi)</option>
                </Select>
              </Field>

              <Field label="Ý kiến / Nhận xét thẩm tra">
                <TextArea
                  value={banComment}
                  onChange={(e) => setBanComment(e.target.value)}
                  placeholder="Đối chiếu các chỉ tiêu với nghị quyết gốc, con số kế hoạch, tính khả thi, phân công đơn vị..."
                  rows={3}
                />
              </Field>

              <Button
                onClick={submitTreeReview}
                disabled={sendingBan || !treeResId}
                className="w-full !bg-emerald-600 hover:!bg-emerald-700 !text-white"
              >
                <CheckCircle2 className="size-4" />
                {sendingBan ? "Đang gửi…" : "Gửi kết luận thẩm tra cây chỉ tiêu"}
              </Button>
            </div>
          </Card>

          {/* CỘT PHẢI: DANH SÁCH CHỈ TIÊU CỦA NQ CẦN THẨM TRA */}
          <Card className="xl:col-span-3">
            <CardHeader
              icon={ListTree}
              title="Danh sách chỉ tiêu phân khai"
              sub={selectedTreeRes ? `${selectedTreeRes.codeNumber} — ${treeIndicators.length} chỉ tiêu` : "Chọn Nghị quyết để xem chỉ tiêu"}
              action={
                <Badge tone="sky">
                  {treeIndicators.length} chỉ tiêu
                </Badge>
              }
            />
            <div className="px-5 py-4">
              {loadingTree ? (
                <div className="grid h-64 place-items-center text-xs font-semibold text-slate-500">
                  Đang tải danh sách chỉ tiêu…
                </div>
              ) : treeIndicators.length === 0 ? (
                <EmptyState
                  icon={ListTree}
                  title="Chưa có chỉ tiêu nào"
                  hint="Nghị quyết này chưa được Chuyên viên dựng cây chỉ tiêu."
                />
              ) : (
                <ul className="slim-scroll max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
                  {treeIndicators.map((item, idx) => (
                    <li
                      key={item.id}
                      className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
                    >
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-500 dark:bg-slate-800">
                          {idx + 1}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-xs font-bold tracking-tight">
                          {item.title}
                        </p>
                        <Badge tone="slate">{item.status || "draft"}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600 sm:grid-cols-4 dark:text-slate-400">
                        <div>
                          <span className="font-semibold text-slate-500">Kế hoạch:</span>{" "}
                          <b>{item.targetValue} {item.unit}</b>
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Chu kỳ:</span>{" "}
                          {freqName(item.frequency)}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Deadline:</span>{" "}
                          {item.deadline || "—"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-500">Đơn vị:</span>{" "}
                          {deptName(item.assignedDepartments?.[0]?.departmentId || "ubnd-xa")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* PHÂN HỆ 2: THẨM TRA BÁO CÁO TIẾN ĐỘ (Hiển thị khi chọn tab report) */}
      {subTab === "report" && (
        <div className="grid gap-5 xl:grid-cols-5">
          <Card className="xl:col-span-2">
            <CardHeader
              icon={ShieldCheck}
              title="Thẩm tra báo cáo tiến độ"
              sub={resolution ? `${resolution.codeNumber} — chọn báo cáo để thẩm tra` : "Chọn báo cáo để thẩm tra"}
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

              {selectedReport && (
                <div className="space-y-1.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs leading-relaxed dark:border-slate-800 dark:bg-slate-800/40">
                  <p className="font-bold tracking-tight">
                    {indicatorTitle(selectedReport.indicatorId)}{" "}
                    <Badge tone={statusTone(selectedReport.status)}>{statusLabel(selectedReport.status)}</Badge>
                  </p>
                  <p>
                    <span className="font-semibold">Số liệu:</span> {selectedReport.actualValue} ·{" "}
                    <span className="font-semibold">Tiến độ:</span> {selectedReport.progressPercentage}% ·{" "}
                    <span className="font-semibold">Kỳ:</span> {selectedReport.period || "—"} ·{" "}
                    <span className="font-semibold">Đơn vị:</span> {selectedReport.departmentId || "—"}
                  </p>
                  {selectedReport.remarks && (
                    <p>
                      <span className="font-semibold">Ghi chú:</span> {selectedReport.remarks}
                    </p>
                  )}
                </div>
              )}

              {selectedReport && <EvidenceViewer report={selectedReport} />}

              <Field label="Kết luận thẩm tra">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="passed">Đồng ý (passed)</option>
                  <option value="need_clarification">Yêu cầu giải trình (need_clarification)</option>
                </Select>
              </Field>
              <Field label="Nhận xét thẩm tra">
                <TextArea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Đối chiếu số liệu với minh chứng…" />
              </Field>
              <Button onClick={submitReportReview} disabled={sending || !id} className="w-full">
                <Send className="size-4" /> {sending ? "Đang gửi…" : "Gửi thẩm tra báo cáo"}
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
      )}
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
  const [loadError, setLoadError] = useState("");

  const directUrl = report?.evidenceFileUrl || "";
  const serverStreamUrl = report?.id
    ? `${API_ROOT}/reports/${report.id}/evidence?token=${encodeURIComponent(getToken() || "")}`
    : directUrl;

  const loadViaServer = useCallback(async () => {
    if (!report?.id) return;
    if (!getToken()) {
      setLoadError("Chưa đăng nhập — đăng nhập lại để xem qua server.");
      return;
    }
    try {
      setLoading(true);
      setLoadError("");
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
    } catch (e) {
      const msg = await blobErrorMessage(e);
      setLoadError(msg);
      console.warn("Lỗi tải minh chứng qua server:", msg);
    } finally {
      setLoading(false);
    }
  }, [report?.id]);

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
    setLoadError("");
    if (report?.id) {
      loadViaServer();
    }
  }, [report?.id, loadViaServer]);

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

  const src = blobUrl || (!loading && !loadError ? directUrl : "");
  const isImage = blobMime
    ? blobMime.startsWith("image/")
    : isImageUrl(directUrl);
  const fileName = `minh-chung-${report.period || report.id || "bao-cao"}`;
  const actionUrl = blobUrl || serverStreamUrl;

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
          {report.id && (
            <button
              type="button"
              onClick={loadViaServer}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors outline-none hover:border-emerald-300 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
            >
              <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Đang tải…" : "Thử lại qua server"}
            </button>
          )}
          {actionUrl && (
            <>
              <a
                href={actionUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors outline-none hover:border-emerald-300 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-slate-700 dark:text-slate-300"
              >
                <ExternalLink className="size-3" /> Mở tab mới
              </a>
              <a
                href={actionUrl}
                download={fileName}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 transition-colors outline-none hover:border-emerald-300 hover:text-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-slate-700 dark:text-slate-300"
              >
                <Download className="size-3" /> Tải xuống
              </a>
            </>
          )}
        </div>
      </div>

      {!report.evidenceFileUrl && !report.evidenceStoragePath ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-amber-700 dark:text-amber-300">
          Báo cáo này không có file minh chứng (dữ liệu cũ trước khi bắt buộc đính kèm). Hãy yêu cầu đơn vị
          gửi lại báo cáo kèm văn bản nguồn.
        </p>
      ) : loading && !src ? (
        <div className="grid h-80 place-items-center rounded-lg border border-slate-200/80 bg-slate-50 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Đang tải file minh chứng qua server…
        </div>
      ) : src ? (
        isImage ? (
          <img
            src={src}
            alt="File minh chứng"
            className="max-h-80 w-full rounded-lg border border-slate-200/80 bg-slate-50 object-contain dark:border-slate-800 dark:bg-slate-900"
          />
        ) : (
          <object
            key={src}
            data={src}
            type="application/pdf"
            className="h-80 w-full rounded-lg border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
          >
            <iframe title="File minh chứng" src={src} className="h-full w-full rounded-lg" />
          </object>
        )
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <p className="font-bold">Chưa tải được file minh chứng.</p>
          <p>{loadError || "Bấm 'Thử lại qua server' để tải lại file minh chứng."}</p>
        </div>
      )}
    </div>
  );
}
