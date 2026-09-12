import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, LogIn, Settings2 } from "lucide-react";
import { useState } from "react";
import { AUTH_ERRORS, ROLE_LABELS, firebaseConfigured, loginEmail, roleFromToken } from "../lib/firebase";
import { getToken } from "../lib/api";
import { useToast } from "./Toaster";
import { Button, EmptyState, Field, TextInput } from "./ui";

const DEMO_ACCOUNTS = [
  { email: "chuyenvien@xa.gov.vn", role: "Chuyên viên" },
  { email: "thuongtruc@xa.gov.vn", role: "Thường trực" },
  { email: "ubnd@xa.gov.vn", role: "Đơn vị thực hiện" },
  { email: "banhdnd@xa.gov.vn", role: "Ban HĐND" },
];

export default function Login() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!firebaseConfigured) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md">
          <EmptyState
            icon={Settings2}
            title="Chưa cấu hình Firebase"
            hint="Mở Firebase Console → Project settings → General → Your apps (Web) → copy khối firebaseConfig vào file frontend/.env (VITE_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID…). Xong chạy lại npm run dev."
          />
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return toast("error", "Nhập đầy đủ email và mật khẩu.");
    try {
      setBusy(true);
      await loginEmail(email, password);
      const role = roleFromToken(getToken());
      toast("success", role ? `Đăng nhập thành công — vai trò: ${ROLE_LABELS[role] ?? role}.` : "Đăng nhập thành công.");
    } catch (err) {
      toast("error", AUTH_ERRORS[err?.code] ?? "Đăng nhập thất bại. Thử lại sau.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10 transition-colors duration-200 dark:bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/80 p-7 shadow-md backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
      >
        <div className="mb-6 flex items-center gap-3">
          <img
            src="/quoc-huy.png"
            alt="Quốc huy Việt Nam"
            className="size-11 shrink-0 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div>
            <h1 className="text-sm font-extrabold tracking-tight text-[#a31f1f] dark:text-white">
              HỘI ĐỒNG NHÂN DÂN CẤP XÃ
            </h1>
            <p className="text-xs font-semibold text-slate-600">Kết nối, cung cấp thông tin và dịch vụ công mọi lúc, mọi nơi</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Field label="Email">
            <TextInput
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="chuyenvien@xa.gov.vn"
            />
          </Field>
          <Field label="Mật khẩu">
            <div className="relative">
              <TextInput
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>
        </form>

        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="mb-2 text-xs font-bold tracking-tight text-slate-600">
            TÀI KHOẢN TEST (bấm để điền nhanh)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => setEmail(a.email)}
                title={a.role}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs font-semibold text-slate-500 transition-all duration-200 outline-none hover:border-emerald-400 hover:bg-emerald-500/5 hover:text-emerald-700 focus-visible:ring-4 focus-visible:ring-emerald-500/30 active:scale-95 dark:border-slate-700 dark:text-slate-400 dark:hover:text-emerald-300"
              >
                {a.email}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
