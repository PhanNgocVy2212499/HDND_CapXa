import { AnimatePresence, motion } from "framer-motion";
import { Inbox, Loader2, X } from "lucide-react";
import { useEffect } from "react";
import { cx } from "../lib/meta";

export function Card({ className, children, ...rest }) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-slate-200/80 bg-white/80 shadow-sm backdrop-blur",
        "dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-black/20",
        className
      )}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHeader({ icon: Icon, title, sub, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            <Icon className="size-4.5" strokeWidth={2.2} />
          </span>
        )}
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">{title}</h2>
          {sub && <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

const buttonTones = {
  primary:
    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 focus-visible:ring-emerald-500/50 active:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:active:bg-emerald-600",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400/40 active:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:active:bg-slate-800",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:ring-red-500/50 active:bg-red-700",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400/40 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:active:bg-slate-700",
};

export function Button({ tone = "primary", className, children, ...rest }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-tight",
        "transition-all duration-200 outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
        buttonTones[tone],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }) {
  return (
    <button
      title={label}
      aria-label={label}
      className={cx(
        "grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-all duration-200 outline-none",
        "hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-4 focus-visible:ring-slate-400/40 active:bg-slate-200 active:scale-95",
        "dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:active:bg-slate-700",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx("block", className)}>
      {label && (
        <span className="mb-1.5 block text-xs font-semibold tracking-tight text-slate-600 dark:text-slate-300">
          {label}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-xs font-medium text-slate-600 dark:text-slate-500">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 placeholder:font-normal placeholder:text-slate-400 transition-all duration-200 outline-none hover:border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 active:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-emerald-400";

export function TextInput({ mono, className, ...rest }) {
  return <input className={cx(inputBase, mono && "font-mono text-[13px]", className)} {...rest} />;
}

export function TextArea({ className, ...rest }) {
  return <textarea className={cx(inputBase, "min-h-20 resize-y leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }) {
  return (
    <select className={cx(inputBase, "cursor-pointer appearance-none pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Spinner({ className }) {
  return <Loader2 className={cx("size-4 animate-spin", className)} />;
}

export function Skeleton({ className }) {
  return (
    <div
      className={cx(
        "animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800",
        className
      )}
    />
  );
}

export function EmptyState({ icon: Icon = Inbox, title, hint, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
      <span className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-500">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-bold tracking-tight text-slate-700 dark:text-slate-200">{title}</p>
      {hint && <p className="max-w-sm text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}

export function Badge({ tone = "slate", className, children }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    emerald: "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
    amber: "bg-amber-500/10 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
    red: "bg-red-600/10 text-red-700 dark:bg-red-400/10 dark:text-red-300",
    sky: "bg-sky-600/10 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-tight",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function AlertDot({ level, pulse }) {
  const colors = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-red-500",
  };
  return (
    <span className="relative grid size-2.5 shrink-0 place-items-center">
      {pulse && level === "red" && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-60" />
      )}
      <span className={cx("relative inline-flex size-2.5 rounded-full", colors[level])} />
    </span>
  );
}

export function ProgressBar({ value, className }) {
  const v = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800", className)}>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
        initial={false}
        animate={{ width: `${v}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
    </div>
  );
}

export function ProgressRing({ value, size = 92 }) {
  const v = Math.min(100, Math.max(0, Number(value) || 0));
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth="9" fill="none" className="stroke-slate-100 dark:stroke-slate-800" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth="9"
          fill="none"
          strokeLinecap="round"
          className="stroke-emerald-500"
          initial={false}
          animate={{ strokeDashoffset: c - (c * v) / 100 }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
          strokeDasharray={c}
        />
      </svg>
      <span className="absolute text-sm font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
        {Math.round(v)}%
      </span>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={cx(
              "w-full rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900",
              wide ? "max-w-2xl" : "max-w-lg"
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">{title}</h3>
              <IconButton label="Đóng" onClick={onClose}>
                <X className="size-4" />
              </IconButton>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
