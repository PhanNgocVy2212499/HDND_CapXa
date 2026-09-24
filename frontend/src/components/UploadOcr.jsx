import { motion } from "framer-motion";
import { CloudUpload, FileCheck2, FileText, ScanText, Trash2 } from "lucide-react";
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
  };

  const submit = async () => {
    if (!file) return toast("error", "Hãy chọn file nghị quyết trước.");
    if (!getToken()) return toast("error", "Chưa có token — mở nút token ở header để dán token chuyên viên.");
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append("file", file);
      if (form.codeNumber.trim()) fd.append("codeNumber", form.codeNumber.trim());
      if (form.title.trim()) fd.append("title", form.title.trim());
      if (form.signer.trim()) fd.append("signer", form.signer.trim());
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
          ? `OCR xong — đã tự tách ${list.length} chỉ tiêu, khỏi nhập tay.`
          : "OCR xong — kiểm tra lại rồi sang bước Cây chỉ tiêu."
      );
      // Giữ blob preview để màn Cây chỉ tiêu hiện ngay bên trái, khỏi phụ thuộc fileUrl server
      onCreated?.(r, previewUrl ? { url: previewUrl, type: file?.type || "", name: file?.name || "" } : null, list);
    } catch (e) {
      toast("error", e.response?.data?.message || "Upload/OCR thất bại. Kiểm tra backend và token.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader icon={CloudUpload} title="Chọn file nghị quyết" sub="PDF văn bản hoặc ảnh scan — kéo thả hoặc bấm để chọn" />
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
              {file ? file.name : "Kéo thả file vào đây hoặc bấm để chọn"}
            </p>
            <p className="text-xs font-medium text-slate-600">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB — bấm để đổi file khác` : "PDF, PNG, JPG · tối đa 20MB"}
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
              title="Xem trước nghị quyết"
              src={previewUrl}
              className="h-96 w-full rounded-xl border border-slate-200/80 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            />
          )}

          <Button onClick={submit} disabled={loading || !file} className="w-full">
            {loading ? "Đang upload & OCR…" : "Upload & OCR"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={ScanText}
          title="Kết quả OCR auto-fill"
          sub="Luôn kiểm tra lại — OCR có thể sai với bản scan mờ"
          action={resolution && <Badge tone="emerald">Đã tạo nháp</Badge>}
        />
        <div className="space-y-3 px-5 py-4">
          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-2/3" />
              <p className="text-xs font-semibold text-slate-600">Đang trích xuất số hiệu, ngày ban hành, trích yếu…</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Số hiệu">
                  <TextInput value={form.codeNumber} onChange={(e) => setForm({ ...form, codeNumber: e.target.value })} placeholder="05/2026/NQ-HĐND" />
                </Field>
                <Field label="Người ký">
                  <TextInput value={form.signer} onChange={(e) => setForm({ ...form, signer: e.target.value })} placeholder="Chủ tịch HĐND xã…" />
                </Field>
              </div>
              <Field label="Trích yếu">
                <TextArea value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Về việc…" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ngày ban hành">
                  <TextInput value={form.issuanceDate} onChange={(e) => setForm({ ...form, issuanceDate: e.target.value })} placeholder="15/08/2026" />
                </Field>
                <Field label="Document ID">
                  <TextInput mono value={resolution?.id ?? ""} readOnly placeholder="Có sau khi upload" />
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
                    Đã lưu bản nháp <b className="font-mono">{resolution.id}</b>.{" "}
                    {extracted.length > 0 ? (
                      <>
                        Đã tự tách <b>{extracted.length} chỉ tiêu</b> từ văn bản — khỏi nhập tay ở bước{" "}
                        Cây chỉ tiêu.{" "}
                        <button onClick={() => onGo("approve")} className="font-bold underline underline-offset-2 transition-colors hover:text-emerald-600 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
                          Sang Phê duyệt
                        </button>{" "}
                        để chốt deadline và giao việc.
                      </>
                    ) : (
                      <>
                        Văn bản quá ngắn/mờ nên chưa tự tách được — sang bước{" "}
                        <button onClick={() => onGo("tree")} className="font-bold underline underline-offset-2 transition-colors hover:text-emerald-600 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
                          Cây chỉ tiêu
                        </button>{" "}
                        để nhập tay.
                      </>
                    )}
                  </div>
                </motion.div>
              ) : (
                <p className="text-xs font-medium leading-relaxed text-slate-600">
                  Chưa có kết quả. Upload file ở khung bên trái — form này sẽ tự điền.
                </p>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
