import { motion } from "framer-motion";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  FileSearch,
  FileText,
  KeyRound,
  ListTree,
  Loader2,
  LogIn,
  MessagesSquare,
  Scale,
  Settings2,
  ShieldCheck,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { AUTH_ERRORS, ROLE_LABELS, firebaseConfigured, loginEmail, roleFromToken } from "../lib/firebase";
import { getToken } from "../lib/api";
import { useToast } from "./Toaster";
import { Button, EmptyState, Field, TextInput } from "./ui";

const DEMO_ACCOUNTS = [
  { email: "chuyenvien@xa.gov.vn", role: "Chuyên viên HĐND", desc: "Upload OCR, lập Cây chỉ tiêu", color: "border-blue-300 text-blue-700 bg-blue-50/60 dark:bg-blue-950/40 dark:text-blue-300" },
  { email: "thuongtruc@xa.gov.vn", role: "Thường trực HĐND", desc: "Phê duyệt chỉ tiêu, giao nhiệm vụ", color: "border-red-300 text-red-700 bg-red-50/60 dark:bg-red-950/40 dark:text-red-300" },
  { email: "ubnd@xa.gov.vn", role: "Đơn vị thực hiện", desc: "Báo cáo số liệu & gửi minh chứng", color: "border-emerald-300 text-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/40 dark:text-emerald-300" },
  { email: "banhdnd@xa.gov.vn", role: "Ban HĐND", desc: "Thẩm tra số liệu & giám sát", color: "border-amber-300 text-amber-700 bg-amber-50/60 dark:bg-amber-950/40 dark:text-amber-300" },
];

export default function Login() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("123456");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword("123456");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return toast("error", "Vui lòng nhập đầy đủ email và mật khẩu.");
    try {
      setBusy(true);
      await loginEmail(email, password);
      const role = roleFromToken(getToken());
      toast("success", role ? `Đăng nhập thành công — Vai trò: ${ROLE_LABELS[role] ?? role}.` : "Đăng nhập thành công.");
    } catch (err) {
      toast("error", AUTH_ERRORS[err?.code] ?? "Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản hoặc kết nối mạng.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-2 sm:py-4">
      {/* Khối Banner Tiêu đề Chào mừng phong cách Cổng thông tin */}
      <div className="mb-6 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#005baa] dark:text-blue-400 uppercase tracking-tight font-serif">
              HỆ THỐNG QUẢN LÝ NGHỊ QUYẾT &amp; THEO DÕI CHỈ TIÊU HĐND
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Phục vụ hoạt động chỉ đạo, điều hành của Thường trực HĐND, các Ban HĐND và đơn vị thực hiện
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#005baa] border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <ShieldCheck className="size-4 text-emerald-600" />
            CSDL dùng chung HĐND số
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Cột Trái (7 cols): Giới thiệu các chức năng & quy trình của hệ thống HĐND */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-amber-50/40 p-5 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/60">
            <h3 className="text-sm font-extrabold text-[#9b1313] dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileCheck2 className="size-4.5" />
              Quy trình số hóa toàn diện vòng đời Nghị quyết
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed dark:text-slate-300 mb-4">
              Hệ thống xây dựng theo mô hình CSDL dùng chung duy nhất: từ khi ban hành Nghị quyết, tự động bóc tách chỉ tiêu bằng trí tuệ nhân tạo (OCR), giao quyền chịu trách nhiệm đến báo cáo tiến độ kèm minh chứng và thẩm tra độc lập.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-2.5 rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-950">
                <FileSearch className="size-5 shrink-0 text-[#005baa] mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">1. Upload &amp; OCR Tự động</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Tự động trích xuất số hiệu, trích yếu, ngày ký, nội dung từ PDF quét.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-950">
                <ListTree className="size-5 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">2. Cây chỉ tiêu KT-XH</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Phân rã chỉ tiêu lớn thành chỉ tiêu nhánh có định mức và thời hạn cụ thể.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-950">
                <BadgeCheck className="size-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">3. Phê duyệt &amp; Giao việc</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Thường trực HĐND duyệt chỉ tiêu, ấn định cơ quan chủ trì và phối hợp.</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-950">
                <Scale className="size-5 shrink-0 text-[#9b1313] mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">4. Thẩm tra &amp; Giám sát</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Các Ban HĐND đối chiếu số liệu báo cáo với minh chứng, bảo đảm tính xác thực.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dải thông báo văn bản mới / Thông tin điều hành */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <TrendingUp className="size-4 text-[#005baa]" />
              Tiêu chuẩn kỹ thuật CSDL Hội đồng nhân dân
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                Nguyên tắc: "Sản sinh dữ liệu một lần, chia sẻ và khai thác nhiều lần".
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                Audit Log chi tiết: Tự động lưu vết lịch sử mọi thao tác ghi dữ liệu.
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                Cảnh báo thông minh: Tự động tính toán hạn chót báo cáo (Xanh - Vàng - Đỏ).
              </li>
            </ul>
          </div>
        </div>

        {/* Cột Phải (5 cols): Khung Đăng nhập chuẩn Cổng hành chính công */}
        <div className="lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-[#005baa] dark:bg-blue-950/60 dark:text-blue-400">
                <KeyRound className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white uppercase tracking-tight">
                  ĐĂNG NHẬP TÁC NGHIỆP
                </h3>
                <p className="text-xs text-slate-500">Dành cho Cán bộ, Đại biểu &amp; Đơn vị thực hiện</p>
              </div>
            </div>

            {!firebaseConfigured ? (
              <EmptyState
                icon={Settings2}
                title="Chưa cấu hình Firebase"
                hint="Vui lòng kiểm tra lại cấu hình VITE_FIREBASE_* trong file .env."
              />
            ) : (
              <form onSubmit={submit} className="space-y-3.5">
                <Field label="Địa chỉ thư điện tử (Email công vụ)">
                  <TextInput
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="chuyenvien@xa.gov.vn"
                    required
                  />
                </Field>

                <Field label="Mật khẩu bảo mật">
                  <div className="relative">
                    <TextInput
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>

                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-[#005baa] hover:bg-[#004e92] text-white font-bold py-2.5 rounded-lg shadow-sm transition-all"
                >
                  {busy ? <Loader2 className="size-4 animate-spin mr-2" /> : <LogIn className="size-4 mr-2" />}
                  {busy ? "Đang xác thực hệ thống…" : "ĐĂNG NHẬP HỆ THỐNG"}
                </Button>
              </form>
            )}

            {/* Bảng chọn tài khoản test nhanh 1-chạm */}
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                CHỌN TÀI KHOẢN KIỂM THỬ NHANH (1-CLICK)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => fillDemo(a.email)}
                    className={`flex flex-col text-left p-2 rounded-lg border text-xs font-medium transition-all hover:scale-[1.02] active:scale-[0.98] ${a.color}`}
                  >
                    <span className="font-bold flex items-center justify-between">
                      {a.role}
                      <span className="text-[10px] opacity-75 font-normal">click</span>
                    </span>
                    <span className="text-[10px] font-mono opacity-90 truncate">{a.email}</span>
                  </button>
                ))}
              </div>
            </div>

          </motion.div>
        </div>
      </div>
    </div>
  );
}
