import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ApproveAssign from "./components/ApproveAssign";
import Dashboard from "./components/Dashboard";
import IndicatorTree from "./components/IndicatorTree";
import Layout from "./components/Layout";
import Login from "./components/Login";
import ReportForm from "./components/ReportForm";
import ReviewForm from "./components/ReviewForm";
import { ToastProvider, useToast } from "./components/Toaster";
import UploadOcr from "./components/UploadOcr";
import { checkHealth, setToken } from "./lib/api";
import api from "./lib/api";
import { ROLE_LABELS, auth, firebaseConfigured, logout, onAuthStateChanged, refreshToken, roleFromToken } from "./lib/firebase";

function Shell() {
  const toast = useToast();
  const [view, setView] = useState("dashboard");
  const [dark, setDark] = useState(() => {
    try {
      // Mặc định nền trắng, chỉ tối khi người dùng đã chọn trước đó
      return localStorage.getItem("hdnd_theme") === "dark";
    } catch {
      return false;
    }
  });
  const [fbUser, setFbUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [health, setHealth] = useState("unknown");

  const [resolution, setResolution] = useState(() => {
    try {
      const raw = localStorage.getItem("hdnd_resolution");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [resolutionPreview, setResolutionPreview] = useState(null);
  const loadJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const [nodes, setNodes] = useState(() => loadJSON("hdnd_nodes", []));
  const [createdIndicators, setCreatedIndicators] = useState(() => loadJSON("hdnd_indicators", []));
  const [approvedIds, setApprovedIds] = useState(() => loadJSON("hdnd_approved", []));
  const [reports, setReports] = useState(() => loadJSON("hdnd_reports", []));
  const [reviews, setReviews] = useState(() => loadJSON("hdnd_reviews", []));
  const welcomed = useRef(false);

  useEffect(() => {
    try {
      if (resolution) localStorage.setItem("hdnd_resolution", JSON.stringify(resolution));
    } catch {
      /* storage unavailable */
    }
  }, [resolution]);

  useEffect(() => {
    try {
      localStorage.setItem("hdnd_indicators", JSON.stringify(createdIndicators ?? []));
    } catch {
      /* storage unavailable */
    }
  }, [createdIndicators]);

  const saveJSON = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value ?? []));
    } catch {
      /* storage unavailable */
    }
  };

  useEffect(() => saveJSON("hdnd_nodes", nodes), [nodes]);
  useEffect(() => saveJSON("hdnd_approved", approvedIds), [approvedIds]);
  useEffect(() => saveJSON("hdnd_reports", reports), [reports]);
  useEffect(() => saveJSON("hdnd_reviews", reviews), [reviews]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("hdnd_theme", dark ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }, [dark]);

  useEffect(() => {
    if (!firebaseConfigured || !auth) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        setToken(token);
        setRole(roleFromToken(token));
        setFbUser({ email: user.email, uid: user.uid });
        if (!welcomed.current) {
          welcomed.current = true;
          toast("success", `Xin chào ${user.email}!`);
        }
      } else {
        welcomed.current = false;
        setToken("");
        setRole(null);
        setFbUser(null);
      }
      setAuthReady(true);
    });
  }, [toast]);

  const onCheckHealth = useCallback(async () => {
    try {
      await checkHealth();
      setHealth("ok");
    } catch {
      setHealth("bad");
    }
  }, []);

  // Token hết hạn sau ~1h → tự refresh mỗi 45 phút khi còn đăng nhập (tránh 401 giữa chừng)
  useEffect(() => {
    if (!fbUser) return;
    const timer = setInterval(() => {
      refreshToken().catch(() => {});
    }, 45 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fbUser]);

  useEffect(() => {
    onCheckHealth();
  }, [onCheckHealth]);

  const handleLogout = useCallback(async () => {
    await logout();
    setResolutionPreview((prev) => {
      try {
        if (prev?.url?.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      } catch {
        /* ignore */
      }
      return null;
    });
    setView("dashboard");
    toast("info", "Đã đăng xuất.");
  }, [toast]);

  // Mở NQ cũ để làm tiếp: đổi NQ đang mở + xóa state phiên cũ để các tab
  // (Cây chỉ tiêu / Phê duyệt / Báo cáo / Thẩm tra) tự tải lại từ server theo NQ mới.
  // Lấy full detail để tab Text OCR + PDF gốc xem được (list chỉ có thông tin gọn).
  const handlePickResolution = useCallback(
    async (r) => {
      if (!r?.id) return;
      if (resolution?.id === r.id) {
        toast("info", "Đang mở nghị quyết này rồi.");
        return;
      }
      let full = r;
      try {
        const { data } = await api.get(`/resolutions/${r.id}`);
        if (data?.data) full = { ...r, ...data.data };
      } catch {
        /* offline — dùng thông tin cơ bản */
      }
      setResolution(full);
      setNodes([]);
      setCreatedIndicators([]);
      setApprovedIds([]);
      setReports([]);
      setReviews([]);
      setResolutionPreview((prev) => {
        try {
          if (prev?.url?.startsWith("blob:")) URL.revokeObjectURL(prev.url);
        } catch {
          /* ignore */
        }
        return null;
      });
      toast("success", `Đã mở ${full.codeNumber || "nghị quyết"} để làm tiếp — các tab sẽ tải lại từ server.`);
    },
    [resolution?.id, toast]
  );

  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!fbUser) return <Login />;

  const done = {
    dashboard: false,
    upload: !!resolution,
    tree: nodes.length > 0,
    approve: approvedIds.length > 0,
    report: reports.length > 0,
    review: reviews.some((r) => r.status === "passed"),
  };

  return (
    <Layout
      view={view}
      onView={setView}
      done={done}
      dark={dark}
      onToggleDark={() => setDark((d) => !d)}
      health={health}
      onCheckHealth={onCheckHealth}
      user={{ ...fbUser, roleLabel: role ? ROLE_LABELS[role] ?? role : "Chưa gán vai trò" }}
      onLogout={handleLogout}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={view + fbUser.uid}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {view === "dashboard" && (
            <Dashboard
              resolution={resolution}
              nodes={nodes.map((n) => ({
                ...n,
                approved: approvedIds.length > 0,
              }))}
              reports={reports}
              reviews={reviews}
              onGo={setView}
              onPickResolution={handlePickResolution}
            />
          )}
          {view === "upload" && (
            <UploadOcr
              resolution={resolution}
              onCreated={(r, preview, extracted) => {
                setResolution(r);
                // Chỉ tiêu đã tự tách từ OCR → nạp sẵn để Phê duyệt/Báo cáo/Tổng quan thấy ngay
                if (extracted?.length) {
                  setNodes(
                    (extracted ?? []).map((n) => ({
                      key: n.id,
                      parent: n.parentId ?? null,
                      title: n.title,
                      target: n.targetValue ?? "",
                      unit: n.unit || "",
                      freq: n.frequency || "quarterly",
                      deadline: n.deadline || "",
                      dept: n.dept || "ubnd-xa",
                      role: n.role || "primary",
                      resolutionId: r.id,
                    }))
                  );
                  setCreatedIndicators(
                    (extracted ?? []).map((n) => ({
                      id: n.id,
                      title: n.title,
                      parentId: n.parentId ?? null,
                      deadline: n.deadline || "",
                      targetValue: n.targetValue,
                      unit: n.unit,
                      resolutionId: r.id,
                      status: "pending_approval",
                    }))
                  );
                }
                if (preview?.url) {
                  setResolutionPreview((prev) => {
                    try {
                      if (prev?.url?.startsWith("blob:") && prev.url !== preview.url)
                        URL.revokeObjectURL(prev.url);
                    } catch {
                      /* ignore */
                    }
                    return preview;
                  });
                }
              }}
              onGo={setView}
            />
          )}
          {view === "tree" && (
            <IndicatorTree
              resolution={resolution}
              filePreview={resolutionPreview}
              onGo={setView}
              onPickResolution={handlePickResolution}
              onSubmitted={(flat, created) => {
                setNodes((flat ?? []).map((n) => ({ ...n, resolutionId: n.resolutionId || resolution?.id || "" })));
                if (created?.length)
                  setCreatedIndicators(
                    (created ?? []).map((n) => ({ ...n, resolutionId: n.resolutionId || resolution?.id || "" }))
                  );
              }}
            />
          )}
          {view === "approve" && (
            <ApproveAssign
              resolution={resolution}
              indicators={createdIndicators}
              onApproved={(id) => setApprovedIds((prev) => [...prev, id])}
              onPickResolution={handlePickResolution}
            />
          )}
          {view === "report" && (
            <ReportForm
              resolution={resolution}
              indicators={createdIndicators}
              onReported={(r) =>
                setReports((prev) => [
                  ...prev,
                  { ...r, resolutionId: r.resolutionId || resolution?.id || "", at: new Date().toISOString() },
                ])
              }
            />
          )}
          {view === "review" && (
            <ReviewForm
              resolution={resolution}
              indicators={createdIndicators}
              reportId={reports[reports.length - 1]?.reportId ?? ""}
              timeline={reviews}
              onReviewed={(r) => setReviews((prev) => [...prev, r])}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
