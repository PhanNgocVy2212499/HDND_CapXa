import { motion } from "framer-motion";
import { FileUp, Paperclip, Send } from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";
import api, { API_BASE, authFileHeaders, getToken } from "../lib/api";
import { useToast } from "./Toaster";
import { Button, Card, CardHeader, Field, ProgressRing, Select, TextInput, TextArea } from "./ui";

export default function ReportForm({ resolution, indicators, onReported }) {
  const toast = useToast();
  const [indicatorId, setIndicatorId] = useState("");
  const [actualValue, setActualValue] = useState("");
  const [pct, setPct] = useState(70);
  const [remarks, setRemarks] = useState("");
  const [period, setPeriod] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [fetched, setFetched] = useState([]);
  const options = indicators?.length > 0 ? indicators : fetched;

  // Tab mới: props rỗng → tự tải danh sách theo resolutionId để có dropdown
  useEffect(() => {
    if (indicators?.length === 0 && resolution?.id) {
      (async () => {
        try {
          const { data } = await api.get("/indicators", { params: { resolutionId: resolution.id } });
          if (data.data?.length) setFetched(data.data);
        } catch {
          /* giữ ô dán ID tay */
        }
      })();
    }
  }, [indicators?.length, resolution?.id]);

  const submit = async () => {
    if (!indicatorId.trim()) return toast("error", "Chọn chỉ tiêu cần báo cáo.");
    if (!file) return toast("error", "Bắt buộc đính kèm file minh chứng — báo cáo không có văn bản nguồn sẽ bị từ chối.");
    if (!getToken()) return toast("error", "Chưa có token — cần token của đơn vị thực hiện.");
    try {
      setSending(true);
      const fd = new FormData();
      fd.append("indicatorId", indicatorId.trim());
      fd.append("actualValue", actualValue === "" ? 0 : actualValue);
      fd.append("progressPercentage", pct);
      fd.append("remarks", remarks);
      if (period.trim()) fd.append("period", period.trim());
      if (file) fd.append("evidence", file);
      const { data } = await axios.post(`${API_BASE}/reports`, fd, {
        headers: authFileHeaders(),
        timeout: 90000,
      });
      toast("success", "Đã gửi báo cáo tiến độ.");
      onReported?.({ reportId: data.reportId, indicatorId: indicatorId.trim(), progressPercentage: pct });
      setRemarks("");
      setFile(null);
    } catch (e) {
      toast("error", e.response?.data?.message || "Gửi báo cáo thất bại.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader icon={FileUp} title="Báo cáo tiến độ định kỳ" sub="Nhập số liệu thực tế, % hoàn thành và file minh chứng" />
        <div className="space-y-3 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Chỉ tiêu báo cáo">
              {options?.length > 0 ? (
                <Select value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)}>
                  <option value="">— Chọn chỉ tiêu —</option>
                  {options.map((n) => (
                    <option key={n.id} value={n.id}>{n.title}</option>
                  ))}
                </Select>
              ) : (
                <TextInput mono value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)} placeholder="Dán indicatorId…" />
              )}
            </Field>
            <Field label="Kỳ báo cáo" hint='VD "2026-08" hoặc "2026-Q3"'>
              <TextInput value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-Q3" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Số liệu thực tế">
              <TextInput type="number" value={actualValue} onChange={(e) => setActualValue(e.target.value)} placeholder="0" />
            </Field>
            <Field label={`Tự đánh giá — ${pct}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                className="slider-emerald mt-3 w-full cursor-pointer"
                aria-label="% hoàn thành"
              />
            </Field>
          </div>
          <Field label="Ghi chú / khó khăn / kiến nghị">
            <TextArea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Tiến độ, vướng mắc, đề xuất…" />
          </Field>
          <Field label="File minh chứng (bắt buộc)" hint="100% báo cáo phải kèm văn bản nguồn mới có giá trị pháp lý">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-500 transition-all duration-200 outline-none hover:border-emerald-400 hover:bg-emerald-500/[0.03] hover:text-slate-700 focus-visible:ring-4 focus-visible:ring-emerald-500/30 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              <Paperclip className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{file ? file.name : "Đính kèm PDF / ảnh / Excel…"}</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </Field>
          <Button onClick={submit} disabled={sending} className="w-full">
            <Send className="size-4" /> {sending ? "Đang gửi…" : "Gửi báo cáo"}
          </Button>
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader icon={FileUp} title="Xem trước đánh giá" sub="Vòng % cập nhật theo slider" />
        <div className="grid place-items-center px-5 py-8">
          <motion.div key={pct} initial={{ scale: 0.94 }} animate={{ scale: 1 }} transition={{ duration: 0.2 }}>
            <ProgressRing value={pct} size={132} />
          </motion.div>
          <p className="mt-3 max-w-60 text-center text-xs font-medium leading-relaxed text-slate-600">
            {pct >= 100
              ? "Hoàn thành — sẵn sàng đề nghị nghiệm thu."
              : pct >= 70
                ? "Tiến độ tốt — duy trì nhịp báo cáo."
                : "Cần tăng tốc để kịp deadline."}
          </p>
        </div>
      </Card>
    </div>
  );
}
