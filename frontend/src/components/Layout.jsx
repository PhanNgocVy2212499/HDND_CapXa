import {
  BadgeCheck,
  BarChart3,
  FileUp,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  MessagesSquare,
  Moon,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { cx } from "../lib/meta";
import { Badge, IconButton } from "./ui";

/* Nghiệp vụ nội bộ HĐND */
export const NAV = [
  { id: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { id: "upload", label: "Upload & OCR", icon: FileUp, role: "Chuyên viên" },
  { id: "tree", label: "Cây chỉ tiêu", icon: ListTree, role: "Chuyên viên" },
  { id: "approve", label: "Phê duyệt", icon: BadgeCheck, role: "Thường trực" },
  { id: "report", label: "Báo cáo", icon: BarChart3, role: "Đơn vị" },
  { id: "review", label: "Thẩm tra", icon: MessagesSquare, role: "Các Ban" },
];

/* variant="bar": chữ trắng trên nền xanh lá, dí vào / đang chọn thì đỏ.
   variant="menu": dùng trong drawer mobile nền trắng. */
function WorkflowNav({ view, onView, done, variant = "bar" }) {
  const onBar = variant === "bar";
  return (
    <nav className={cx("flex gap-1", onBar ? "overflow-x-auto" : "flex-col")}>
      {NAV.map((n) => {
        const active = view === n.id;
        return (
          <button
            key={n.id}
            onClick={() => onView(n.id)}
            className={cx(
              "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold tracking-tight transition-all duration-200 outline-none",
              onBar
                ? "focus-visible:ring-4 focus-visible:ring-white/40 active:scale-[0.98]"
                : "focus-visible:ring-4 focus-visible:ring-[#a31f1f]/30 active:scale-[0.98]",
              active
                ? "bg-[#a31f1f] text-white shadow-sm"
                : onBar
                  ? "text-white hover:bg-[#a31f1f] hover:text-white"
                  : "text-slate-600 hover:bg-red-50 hover:text-[#a31f1f] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            )}
          >
            <n.icon className="size-4 shrink-0" strokeWidth={2.2} />
            <span className="flex-1 text-left">{n.label}</span>
            {done?.[n.id] && !active && (
              <span
                className={cx(
                  "size-1.5 rounded-full",
                  onBar ? "bg-amber-300" : "bg-[#a31f1f]"
                )}
                aria-label="Hoàn thành"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default function Layout({
  children,
  view,
  onView,
  done,
  dark,
  onToggleDark,
  health,
  onCheckHealth,
  user,
  onLogout,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-200">
      {/* ===== Header — Hội đồng nhân dân cấp xã + Quốc huy ===== */}
      <div className="bg-white dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <img
            src="/quoc-huy.png"
            alt="Quốc huy Việt Nam"
            className="h-14 w-14 shrink-0 object-contain sm:h-[68px] sm:w-[68px]"
            onError={(e) => {
              e.currentTarget.src = "/quoc-huy.svg";
            }}
          />
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-extrabold tracking-tight text-[#a31f1f] sm:text-[22px] dark:text-red-400">
              HỘI ĐỒNG NHÂN DÂN CẤP XÃ
            </h1>
            <p className="mt-0.5 truncate text-xs font-medium text-[#a31f1f]/80 sm:text-sm dark:text-red-300/80">
              Kết nối, cung cấp thông tin và dịch vụ công mọi lúc, mọi nơi
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="mr-1 hidden items-center gap-2.5 rounded border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 sm:flex dark:border-slate-700 dark:bg-slate-900">
                  <span className="grid size-7 place-items-center rounded bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
                    <UserRound className="size-4" />
                  </span>
                  <span className="leading-tight">
                    <span className="block max-w-44 truncate text-xs font-bold tracking-tight">
                      {user.email}
                    </span>
                    <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      {user.roleLabel}
                    </span>
                  </span>
                  <IconButton label="Đăng xuất" onClick={onLogout} className="hover:!bg-red-500/10 hover:!text-red-500">
                    <LogOut className="size-4" />
                  </IconButton>
                </div>
                <span className="sm:hidden">
                  <IconButton label="Đăng xuất" onClick={onLogout}>
                    <LogOut className="size-4.5" />
                  </IconButton>
                </span>
                <IconButton label={dark ? "Chế độ sáng" : "Chế độ tối"} onClick={onToggleDark}>
                  {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
                </IconButton>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onView("dashboard")}
                  className="hidden rounded-[4px] border border-[#c2612e] bg-white px-6 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-orange-50 sm:block"
                >
                  Đăng ký
                </button>
                <button
                  onClick={() => onView("dashboard")}
                  className="hidden rounded-[4px] border border-[#c2612e] bg-white px-6 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-orange-50 sm:block"
                >
                  Đăng nhập
                </button>
                <IconButton label={dark ? "Chế độ sáng" : "Chế độ tối"} onClick={onToggleDark}>
                  {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
                </IconButton>
              </>
            )}
            <IconButton label="Mở menu" className="lg:hidden" onClick={() => setMenuOpen(true)}>
              <Menu className="size-5" />
            </IconButton>
          </div>
        </div>
      </div>

      {/* ===== Thanh nghiệp vụ: nền xanh lá, dí vào / đang chọn thì đỏ ===== */}
      <div className="border-b border-emerald-800 bg-emerald-700 dark:border-emerald-900 dark:bg-emerald-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <span className="mr-1 hidden text-xs font-extrabold tracking-widest text-emerald-50/80 uppercase md:inline">
            Nghiệp vụ Hội đồng nhân dân
          </span>
          <div className="hidden flex-1 md:block">
            <WorkflowNav view={view} onView={onView} done={done} />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-2.5 sm:px-6 md:hidden">
          <WorkflowNav view={view} onView={onView} done={done} />
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white p-4 dark:bg-slate-900"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/quoc-huy.png" alt="Quốc huy" className="h-9 w-9 object-contain" />
                  <p className="text-xs font-extrabold tracking-tight text-[#a31f1f]">HỘI ĐỒNG NHÂN DÂN CẤP XÃ</p>
                </div>
                <IconButton label="Đóng menu" onClick={() => setMenuOpen(false)}>
                  <X className="size-4.5" />
                </IconButton>
              </div>
              <p className="mb-2 text-xs font-extrabold tracking-widest text-slate-400 uppercase">
                Nghiệp vụ
              </p>
              <WorkflowNav
                view={view}
                variant="menu"
                onView={(v) => {
                  onView(v);
                  setMenuOpen(false);
                }}
                done={done}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nội dung trắng kiểu DVC */}
      <main className="mx-auto w-full max-w-7xl border-t border-slate-100 bg-white px-4 py-6 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
        {children}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pt-4 pb-8 text-center sm:px-6">
        {done && Object.values(done).some(Boolean) ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {NAV.filter((n) => n.id !== "dashboard" && done[n.id]).map((n) => (
              <Badge key={n.id} tone="emerald">
                {n.label}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs font-medium text-slate-500 dark:text-slate-500">
            Hội đồng nhân dân cấp xã · Cổng dịch vụ công cấp xã · Backend <span className="font-mono">/api/*</span> · Health{" "}
            <span className="font-mono">/health</span>
          </p>
        )}
      </footer>
    </div>
  );
}
