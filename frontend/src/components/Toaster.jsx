import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cx } from "../lib/meta";

const ToastCtx = createContext(() => {});

export const useToast = () => useContext(ToastCtx);

const icons = {
  success: <CheckCircle2 className="size-4.5 shrink-0 text-emerald-500" />,
  error: <AlertCircle className="size-4.5 shrink-0 text-red-500" />,
  info: <Info className="size-4.5 shrink-0 text-sky-500" />,
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), 3800);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 48, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 32, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={cx(
                "pointer-events-auto flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 shadow-md backdrop-blur",
                "border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95"
              )}
            >
              {icons[t.type] ?? icons.info}
              <p className="flex-1 text-[13px] font-medium leading-snug text-slate-700 dark:text-slate-200">
                {t.message}
              </p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Đóng thông báo"
                className="rounded-md p-0.5 text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
