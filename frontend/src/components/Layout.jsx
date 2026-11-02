import {
  BadgeCheck,
  BarChart3,
  Calendar,
  FileUp,
  Globe,
  Home,
  ListTree,
  LogOut,
  Mail,
  Menu,
  MessagesSquare,
  Moon,
  ShieldCheck,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cx } from "../lib/meta";
import { Badge, IconButton } from "./ui";

/* Nghiệp vụ HĐND */
export const NAV = [
  { id: "dashboard", label: "Trang chủ", icon: Home },
  { id: "upload", label: "Upload & OCR", icon: FileUp, role: "Chuyên viên" },
  { id: "tree", label: "Cây chỉ tiêu", icon: ListTree, role: "Chuyên viên" },
  { id: "approve", label: "Phê duyệt & Giao việc", icon: BadgeCheck, role: "Thường trực" },
  { id: "report", label: "Báo cáo tiến độ", icon: BarChart3, role: "Đơn vị" },
  { id: "review", label: "Thẩm tra", icon: MessagesSquare, role: "Các Ban" },
];

function WorkflowNav({ view, onView, done, variant = "bar" }) {
  const onBar = variant === "bar";
  return (
    <nav className={cx("flex items-stretch", onBar ? "overflow-x-auto" : "flex-col gap-1")}>
      {NAV.map((n) => {
        const active = view === n.id;
        const isHome = n.id === "dashboard";
        return (
          <button
            key={n.id}
            onClick={() => onView(n.id)}
            className={cx(
              "relative flex items-center justify-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-xs md:text-sm font-bold tracking-tight transition-all duration-150 outline-none uppercase select-none",
              onBar
                ? active
                  ? "bg-white text-[#9e1f24] shadow-xs border-b-[3px] border-[#ea580c] z-10"
                  : "text-white hover:bg-white hover:text-[#9e1f24]"
                : active
                  ? "bg-[#9e1f24] text-white font-bold rounded-md"
                  : "text-slate-700 hover:bg-red-50 hover:text-[#9e1f24] rounded-md dark:text-slate-200 dark:hover:bg-slate-800"
            )}
          >
            {isHome ? (
              <span className="flex items-center gap-1.5">
                <Home className={cx("size-4 shrink-0", active ? "text-[#ea580c]" : "text-white")} strokeWidth={2.5} />
                <span className="hidden sm:inline">Trang chủ</span>
              </span>
            ) : (
              <>
                <n.icon className="size-3.5 shrink-0 opacity-80" strokeWidth={2.2} />
                <span>{n.label}</span>
              </>
            )}
            {/* Đánh dấu trạng thái hoàn thành */}
            {done?.[n.id] && !active && (
              <span className="size-1.5 rounded-full bg-amber-300" aria-label="Đã hoàn thành" />
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
  const [currentDateStr, setCurrentDateStr] = useState("");
  const [fontSizeLevel, setFontSizeLevel] = useState(1);

  useEffect(() => {
    const now = new Date();
    const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const dName = days[now.getDay()];
    const date = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    setCurrentDateStr(`${dName}, ngày ${date}/${month}/${year}`);
  }, []);

  const changeFontSize = (delta) => {
    const next = Math.max(0, Math.min(2, fontSizeLevel + delta));
    setFontSizeLevel(next);
    const sizes = ["100%", "112.5%", "125%"];
    document.documentElement.style.fontSize = sizes[next];
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans">
      
      {/* 1. TOP BAR — Thông tin tiện ích */}
      <div className="border-b border-slate-200 bg-[#f8fafc] text-[12px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-1.5 sm:px-6">
          <div className="flex items-center gap-4">
            <span className="items-center gap-1.5 inline-flex text-slate-700 font-semibold dark:text-slate-300">
              <Calendar className="size-3.5 text-[#a31f1f]" />
              {currentDateStr || "Hôm nay"}
            </span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Tăng giảm cỡ chữ A- A A+ */}
            <div className="flex items-center gap-1 border-r border-slate-300 pr-2.5 dark:border-slate-700">
              <button
                type="button"
                onClick={() => changeFontSize(-1)}
                title="Cỡ chữ nhỏ"
                className={cx("px-1 py-0.5 rounded text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-800", fontSizeLevel === 0 && "text-[#a31f1f] font-bold")}
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => changeFontSize(0)}
                title="Cỡ chữ mặc định"
                className={cx("px-1 py-0.5 rounded text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-800", fontSizeLevel === 1 && "text-[#a31f1f] font-bold")}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => changeFontSize(1)}
                title="Cỡ chữ lớn"
                className={cx("px-1 py-0.5 rounded text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-800", fontSizeLevel === 2 && "text-[#a31f1f] font-bold")}
              >
                A+
              </button>
            </div>

            {/* Chế độ sáng / tối */}
            <IconButton label={dark ? "Chuyển giao diện sáng" : "Chuyển giao diện tối"} onClick={onToggleDark} className="size-7">
              {dark ? <Sun className="size-3.5 text-amber-400" /> : <Moon className="size-3.5 text-slate-600" />}
            </IconButton>

            {/* Trạng thái cán bộ / người dùng */}
            {user ? (
              <div className="flex items-center gap-2 pl-2">
                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[11px] font-bold">
                  <UserRound className="size-3" />
                  <span>{user.roleLabel}</span>
                  <span className="hidden sm:inline font-normal text-slate-500">({user.email})</span>
                </span>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <LogOut className="size-3" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#005baa]">
                <span>Cổng thông tin HĐND cấp xã</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. BANNER CHÍNH — Áp dụng đúng ảnh nền Header Trống đồng người dùng tải lên */}
      <header className="relative w-full border-t-[3px] border-[#005baa] bg-[#fdf8e6] dark:bg-slate-900 border-b border-amber-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Nền ảnh Trống đồng chuẩn xác từ ảnh người dùng tải lên */}
        <div
          className="absolute inset-0 pointer-events-none bg-center bg-no-repeat bg-cover"
          style={{ backgroundImage: "url('/header-bg.jpg')" }}
        />

        {/* Nội dung Header: Quốc huy + Chữ đỏ HĐND CẤP XÃ (giữ nguyên nội dung của dự án) */}
        <div className="relative mx-auto flex max-w-7xl items-center gap-3.5 sm:gap-5 px-4 py-3 sm:py-4 sm:px-6">
          {/* Quốc huy bên trái */}
          <div className="shrink-0">
            <img
              src="/quoc-huy.png"
              alt="Quốc huy Nước CHXHCN Việt Nam"
              className="h-16 w-16 drop-shadow-sm sm:h-20 sm:w-20 md:h-[84px] md:w-[84px] object-contain"
              onError={(e) => {
                e.currentTarget.src = "/quoc-huy.svg";
              }}
            />
          </div>

          {/* Dòng chữ ĐỎ đúng chuẩn như ảnh */}
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm md:text-base font-extrabold tracking-wider text-[#d32f2f] uppercase drop-shadow-[0_1px_2px_rgba(255,255,255,0.85)]">
              TRANG THÔNG TIN ĐIỆN TỬ
            </p>
            <h1 className="text-lg sm:text-2xl md:text-3xl lg:text-[32px] font-black tracking-tight text-[#c51a1a] dark:text-red-400 uppercase leading-tight font-sans drop-shadow-[0_1px_2px_rgba(255,255,255,0.85)]">
              HỘI ĐỒNG NHÂN DÂN CẤP XÃ
            </h1>
            <p className="mt-0.5 text-[11px] sm:text-xs md:text-sm font-semibold text-[#a31f1f]/90 dark:text-red-300/80 drop-shadow-[0_1px_1px_rgba(255,255,255,0.85)]">
              Kết nối, cung cấp thông tin và dịch vụ công mọi lúc, mọi nơi
            </p>
          </div>

          {/* Nút menu mobile */}
          <div className="lg:hidden ml-auto">
            <IconButton label="Mở danh mục menu" onClick={() => setMenuOpen(true)}>
              <Menu className="size-6 text-[#9e1f24]" />
            </IconButton>
          </div>
        </div>
      </header>

      {/* 3. THANH MENU ĐIỀU HƯỚNG CHÍNH — Màu ĐỎ ĐÔ (#9e1f24) chuẩn với nút TRẮNG ĐỎ như ảnh mẫu */}
      <nav className="sticky top-0 z-30 bg-[#9e1f24] text-white shadow-md border-b border-[#801418]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-2 sm:px-6">
          <div className="hidden lg:block flex-1">
            <WorkflowNav view={view} onView={onView} done={done} />
          </div>
          <div className="lg:hidden w-full overflow-x-auto">
            <WorkflowNav view={view} onView={onView} done={done} />
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white p-4 shadow-2xl dark:bg-slate-900"
            >
              <div className="mb-4 flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <img src="/quoc-huy.png" alt="Quốc huy" className="h-8 w-8 object-contain" />
                  <div>
                    <p className="text-[11px] font-black text-[#9e1f24] uppercase">HỘI ĐỒNG NHÂN DÂN CẤP XÃ</p>
                    <p className="text-[9px] text-slate-500">Cổng thông tin điện tử</p>
                  </div>
                </div>
                <IconButton label="Đóng menu" onClick={() => setMenuOpen(false)}>
                  <X className="size-5" />
                </IconButton>
              </div>

              <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                CHUYÊN MỤC TÁC NGHIỆP
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

              <div className="mt-auto border-t pt-3 text-xs text-slate-500 dark:border-slate-800">
                <p className="font-semibold text-slate-700 dark:text-slate-300">HĐND cấp xã — Quản trị Nghị quyết</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. KHU VỰC NỘI DUNG CHÍNH (MAIN CONTENT) — Giữ nguyên 100% nội dung dự án */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 sm:py-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 min-h-[500px]">
          {children}
        </div>
      </main>

      {/* 5. FOOTER — Nền ảnh danh thắng đỏ đô người dùng tải lên */}
      <footer
        className="relative mt-auto border-t-4 border-amber-500 bg-[#9e1f24] text-white text-xs overflow-hidden bg-cover bg-bottom bg-no-repeat shadow-inner"
        style={{ backgroundImage: "url('/footer-bg.jpg')" }}
      >
        {/* Lớp phủ nhẹ giúp các công trình (Ga Đà Lạt, Nhà thờ Con Gà, Búp Atisô) hiện rõ nét mà chữ vẫn dễ đọc */}
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-[#8b1419]/35 to-[#9e1f24]/75 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12">
            
            {/* Cột 1: Đơn vị chủ quản */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/quoc-huy.png" alt="Quốc huy" className="h-10 w-10 object-contain drop-shadow" />
                <div>
                  <h3 className="font-extrabold text-sm text-white uppercase tracking-tight drop-shadow-xs">
                    HỘI ĐỒNG NHÂN DÂN CẤP XÃ
                  </h3>
                  <p className="text-[11px] text-amber-300 font-medium">Trang thông tin điện tử chính thức</p>
                </div>
              </div>

              <div className="space-y-1.5 text-[11.5px] leading-relaxed text-amber-100/90 drop-shadow-2xs">
                <p><strong>Cơ quan chủ quản:</strong> Thường trực Hội đồng nhân dân cấp xã</p>
                <p><strong>Hệ thống:</strong> Quản lý Nghị quyết &amp; Theo dõi tiến độ Cây chỉ tiêu</p>
                <p><strong>Tiêu chí:</strong> Kết nối, cung cấp thông tin và dịch vụ công mọi lúc, mọi nơi</p>
              </div>
            </div>

            {/* Cột 2: Các chuyên trang liên kết */}
            <div>
              <h4 className="font-bold text-sm text-white mb-3 uppercase border-b border-white/20 pb-1.5 flex items-center gap-2 drop-shadow-xs">
                <Globe className="size-4 text-amber-300" />
                CỔNG THÔNG TIN LIÊN KẾT
              </h4>
              <ul className="space-y-2 text-[12px]">
                <li>
                  <a href="https://chinhphu.vn" target="_blank" rel="noreferrer" className="text-amber-100 hover:text-white transition-colors flex items-center gap-1.5">
                    <span className="text-amber-300">▸</span> Cổng Thông tin điện tử Chính phủ
                  </a>
                </li>
                <li>
                  <a href="https://quochoi.vn" target="_blank" rel="noreferrer" className="text-amber-100 hover:text-white transition-colors flex items-center gap-1.5">
                    <span className="text-amber-300">▸</span> Cổng Thông tin điện tử Quốc hội
                  </a>
                </li>
                <li>
                  <a href="https://lamdong.gov.vn" target="_blank" rel="noreferrer" className="text-amber-100 hover:text-white transition-colors flex items-center gap-1.5">
                    <span className="text-amber-300">▸</span> Cổng Thông tin điện tử Tỉnh Lâm Đồng
                  </a>
                </li>
              </ul>
            </div>

            {/* Cột 3: Bản quyền & Quy định */}
            <div>
              <h4 className="font-bold text-sm text-white mb-3 uppercase border-b border-white/20 pb-1.5 flex items-center gap-2 drop-shadow-xs">
                <ShieldCheck className="size-4 text-emerald-300" />
                BẢN QUYỀN HỆ THỐNG
              </h4>
              <p className="text-[11.5px] leading-relaxed text-amber-100/85 mb-3 drop-shadow-2xs">
                Hệ thống giám sát và quản lý thực hiện Nghị quyết HĐND cấp xã theo Cơ sở dữ liệu dùng chung.
              </p>
              <div className="rounded bg-black/35 p-2.5 border border-white/20 text-[11px] text-amber-200 backdrop-blur-xs">
                <p className="text-white font-mono">Bản quyền © 2026 Hội đồng nhân dân cấp xã.</p>
              </div>
            </div>

          </div>
        </div>
      </footer>
    </div>
  );
}
