import { motion } from "framer-motion";
import { CloudUpload, FileCheck2, FileText, FileSpreadsheet, ScanText, Sparkles, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import api, { authFileHeaders, getToken } from "../lib/api";
import { useToast } from "./Toaster";
import { Badge, Button, Card, CardHeader, Field, Skeleton, TextInput, TextArea } from "./ui";

const ACCEPT = [".pdf", ".png", ".jpg", ".jpeg"];

export default function UploadOcr({ resolution, onCreated, onGo }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ codeNumber: "", title: "", signer: "", issuanceDate: "" });
  const [extracted, setExtracted] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const pick = (f) => {
    if (!f) return;
    const ok = ["application/pdf", "image/png", "image/jpeg"].includes(f.type);
    if (!ok) return toast("error", "Chỉ chấp nhận file PDF, PNG hoặc JPG.");
    setPreviewUrl((prev) => {
      try {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      } catch {
        /* ignore */
      }
      return URL.createObjectURL(f);
    });
    setFile(f);
    // Reset form khi chọn file mới để OCR tự bóc tách chính xác từ văn bản mới
    setForm({ codeNumber: "", title: "", signer: "", issuanceDate: "" });
    setExtracted([]);
  };

  // Nạp nhanh file mẫu thực tế: Nghị quyết số 32/NQ-HĐND xã Châu Thành
  const loadSampleNQ32 = async () => {
    try {
      setLoading(true);
      const res = await fetch("/sample-nq32.pdf");
      if (!res.ok) throw new Error("Không tải được file mẫu trên server.");
      const blob = await res.blob();
      const sampleFile = new File(
        [blob],
        "Nghị quyết số 32-HĐND xã về việc bổ sung dự toán Ngân sách xã năm 2026_0001.signed.signed.pdf",
        { type: "application/pdf" }
      );
      setFile(sampleFile);
      setPreviewUrl("/sample-nq32.pdf");
      setForm({
        codeNumber: "32/NQ-HĐND",
        title: "Nghị quyết về việc bổ sung dự toán ngân sách xã năm 2026",
        signer: "Thạch Thị Sa Thy",
        issuanceDate: "15/10/2026",
      });
      toast("info", "Đã nạp file mẫu Nghị quyết số 32/NQ-HĐND xã Châu Thành. Bấm 'Upload & OCR' để xử lý.");
    } catch (err) {
      toast("error", err.message || "Lỗi khi nạp file mẫu.");
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!file) return toast("error", "Hãy chọn file nghị quyết HĐND cấp xã trước.");
    if (!getToken()) return toast("error", "Chưa có token — mở nút token ở header để dán token chuyên viên.");
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("file", file);
      // Gửi file sạch để OCR tự động bóc tách từ file mới
      const { data } = await api.post("/resolutions/upload-ocr", fd, {
        headers: authFileHeaders(),
        timeout: 90000,
      });
      const r = data.data;
      const list = data.extractedIndicators ?? [];
      setExtracted(list);
      setForm({
        codeNumber: r.codeNumber ?? "",
        title: r.title ?? "",
        signer: r.signer ?? "",
        issuanceDate: r.issuanceDate ? new Date(r.issuanceDate).toLocaleDateString("vi-VN") : "",
      });
      toast(
        "success",
        list.length
          ? `OCR thành công — đã tự bóc tách ${list.length} chỉ tiêu từ văn bản nghị quyết.`
          : "OCR xong — kiểm tra lại thông tin rồi chuyển sang bước Cây chỉ tiêu."
      );
      onCreated?.(r, previewUrl ? { url: previewUrl, type: file?.type || "", name: file?.name || "" } : null, list);
    } catch (e) {
      toast("error", e.response?.data?.message || "Upload/OCR thất bại. Kiểm tra backend và token.");
    } finally {
      setLoading(false);
    }
  };

  const saveEditedFields = async () => {
    if (!resolution?.id) return toast("error", "Chưa có nghị quyết để cập nhật.");
    try {
      setSavingEdit(true);
      const payload = {
        codeNumber: form.codeNumber.trim(),
        title: form.title.trim(),
        signer: form.signer.trim(),
      };
      if (form.issuanceDate.trim()) {
        const parts = form.issuanceDate.trim().split(/[\/\-.]/);
        if (parts.length === 3) {
          const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          if (!Number.isNaN(d.getTime())) payload.issuanceDate = d.toISOString();
        }
      }
      const { data } = await api.patch(`/resolutions/${resolution.id}`, payload);
      toast("success", "Đã cập nhật thông tin Nghị quyết thành công.");
      onCreated?.({ ...resolution, ...data.data }, null, extracted);
    } catch (err) {
      toast("error", err.response?.data?.message || "Cập nhật thất bại.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader
          icon={CloudUpload}
          title="Chọn file Nghị quyết HĐND cấp xã"
          sub="PDF văn bản hoặc ảnh scan Nghị quyết HĐND cấp xã — kéo thả hoặc chọn file"
          action={
            <Button
              type="button"
              tone="secondary"
              className="text-xs py-1 px-2.5 h-auto"
              onClick={loadSampleNQ32}
              title="Nạp nhanh file scan mẫu NQ 32 xã Châu Thành"
            >
              <Sparkles className="size-3.5 mr-1 text-amber-500" />
              Nạp mẫu NQ 32 xã Châu Thành
            </Button>
          }
        />
        <div className="space-y-3 px-5 py-4">
          <motion.div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            animate={dragging ? { scale: 1.01 } : { scale: 1 }}
            className={`grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center outline-none transition-all duration-200 focus-visible:ring-4 focus-visible:ring-emerald-500/30 ${
              dragging
                ? "border-emerald-500 bg-emerald-500/5"
                : "border-slate-200 hover:border-emerald-400 hover:bg-emerald-500/[0.03] dark:border-slate-700 dark:hover:border-emerald-600"
            }`}
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
              <CloudUpload className="size-6" />
            </span>
            <p className="text-sm font-bold tracking-tight">
              {file ? file.name : "Kéo thả file Nghị quyết HĐND xã vào đây hoặc bấm để chọn"}
            </p>
            <p className="text-xs font-medium text-slate-600">
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB — bấm để đổi file khác`
                : "PDF, PNG, JPG (VD: Nghị quyết số 32/NQ-HĐND xã Châu Thành...)"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT.join(",")}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </motion.div>

          {file && !previewUrl.endsWith(".pdf") && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
              <FileText className="size-4 shrink-0 text-slate-600" />
              <p className="min-w-0 flex-1 truncate text-xs font-semibold">{file.name}</p>
              <button
                onClick={() => {
                  setFile(null);
                  setPreviewUrl("");
                }}
                aria-label="Xóa file"
                className="rounded-lg p-1.5 text-slate-600 transition-all duration-200 hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-90"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          )}

          {previewUrl && (
            <iframe
              title="Xem trước Nghị quyết HĐND cấp xã"
              src={previewUrl}
              className="h-96 w-full rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          )}

          <Button onClick={submit} disabled={loading || !file} className="w-full">
            {loading ? "Đang upload & OCR trích xuất chỉ tiêu cấp xã…" : "Upload & OCR Nghị quyết cấp xã"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={ScanText}
          title="Kết quả OCR auto-fill (Cấp xã)"
          sub="Kiểm tra lại số hiệu, trích yếu, người ký — chuyên viên có thể sửa trực tiếp"
          action={
            <div className="flex items-center gap-2">
              {resolution && <Badge tone="emerald">Đã tạo nháp HĐND xã</Badge>}
              {resolution && (
                <Button
                  type="button"
                  tone="secondary"
                  className="text-xs py-1 px-2.5 h-auto"
                  onClick={saveEditedFields}
                  disabled={savingEdit}
                >
                  <FileCheck2 className="size-3.5 mr-1 text-emerald-600" />
                  {savingEdit ? "Đang lưu..." : "Lưu chỉnh sửa"}
                </Button>
              )}
            </div>
          }
        />
        <div className="space-y-3 px-5 py-4">
          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-2/3" />
              <p className="text-xs font-semibold text-slate-600">Đang trích xuất số hiệu, ngày ban hành, trích yếu, phụ lục chỉ tiêu cấp xã…</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Số hiệu Nghị quyết HĐND">
                  <TextInput
                    value={form.codeNumber}
                    onChange={(e) => setForm({ ...form, codeNumber: e.target.value })}
                    placeholder="32/NQ-HĐND"
                  />
                </Field>
                <Field label="Người ký (Chủ tịch / PCT HĐND xã)">
                  <TextInput
                    value={form.signer}
                    onChange={(e) => setForm({ ...form, signer: e.target.value })}
                    placeholder="Thạch Thị Sa Thy"
                  />
                </Field>
              </div>
              <Field label="Trích yếu nội dung Nghị quyết">
                <TextArea
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Về việc bổ sung dự toán ngân sách xã năm 2026..."
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ngày HĐND xã thông qua">
                  <TextInput
                    value={form.issuanceDate}
                    onChange={(e) => setForm({ ...form, issuanceDate: e.target.value })}
                    placeholder="15/10/2026"
                  />
                </Field>
                <Field label="Mã lưu trữ Firestore">
                  <TextInput mono value={resolution?.id ?? ""} readOnly placeholder="Hệ thống tự cấp sau khi upload" />
                </Field>
              </div>
              {resolution ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 rounded-xl bg-emerald-600/[0.07] p-3 text-emerald-800 dark:text-emerald-200"
                >
                  <FileCheck2 className="mt-0.5 size-4 shrink-0" />
                  <div className="text-xs font-medium leading-relaxed">
                    Đã lưu bản nháp Nghị quyết HĐND xã <b className="font-mono">{resolution.id}</b>.{" "}
                    {extracted.length > 0 ? (
                      <>
                        Hệ thống đã tự bóc tách <b>{extracted.length} chỉ tiêu phân khai cấp xã</b> từ văn bản/phụ lục.{" "}
                        <button
                          onClick={() => onGo("tree")}
                          className="font-bold underline underline-offset-2 transition-colors hover:text-emerald-600 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                        >
                          Mở Cây chỉ tiêu
                        </button>{" "}
                        hoặc{" "}
                        <button
                          onClick={() => onGo("approve")}
                          className="font-bold underline underline-offset-2 transition-colors hover:text-emerald-600 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                        >
                          Sang Phê duyệt & Giao việc
                        </button>{" "}
                        cho các bộ phận công chức xã.
                      </>
                    ) : (
                      <>
                        Chưa tự nhận diện được danh sách chỉ tiêu chi tiết — sang bước{" "}
                        <button
                          onClick={() => onGo("tree")}
                          className="font-bold underline underline-offset-2 transition-colors hover:text-emerald-600 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                        >
                          Cây chỉ tiêu
                        </button>{" "}
                        để áp dụng mẫu chuẩn cấp xã hoặc thêm tay.
                      </>
                    )}
                  </div>
                </motion.div>
              ) : (
                <p className="text-xs font-medium leading-relaxed text-slate-600">
                  Chưa có kết quả. Bạn có thể bấm <b>Nạp mẫu NQ 32 xã Châu Thành</b> ở góc trên hoặc kéo thả file nghị quyết cấp xã vào khung bên trái.
                </p>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
