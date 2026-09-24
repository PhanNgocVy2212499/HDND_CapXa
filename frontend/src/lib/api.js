import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const API_ROOT = API_BASE.replace(/\/api$/, "");

export const authFileHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

export async function checkHealth() {
  const res = await axios.get(`${API_ROOT}/health`, { timeout: 8000 });
  return res.data;
}

export const getToken = () => localStorage.getItem('hdnd_token') || '';
export const setToken = (t) => localStorage.setItem('hdnd_token', t || '');

export const api = axios.create({ baseURL: API_BASE, timeout: 60000 });

// Tự gắn Authorization cho mọi request JSON
api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Token Firebase hết hạn sau ~1h → gặp 401 thì refresh 1 lần rồi thử lại,
// khỏi bắt người dùng đăng xuất/đăng nhập tay (import động để tránh vòng lặp firebase<->api)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error?.config;
    if (error?.response?.status === 401 && original && !original._tokenRetried) {
      original._tokenRetried = true;
      try {
        const { auth } = await import("./firebase");
        const fresh = await auth?.currentUser?.getIdToken(true);
        if (fresh) {
          setToken(fresh);
          original.headers = { ...(original.headers || {}), Authorization: `Bearer ${fresh}` };
          return api(original);
        }
      } catch {
        /* refresh thất bại — trả lỗi gốc để UI báo đăng nhập lại */
      }
    }
    return Promise.reject(error);
  }
);

// Đọc message lỗi khi responseType: 'blob' (backend trả JSON nhưng axios bọc thành Blob)
export async function blobErrorMessage(error, fallback = "Tải file thất bại.") {
  const status = error?.response?.status;
  let serverMsg = "";
  let serverDetail = "";
  let serverProject = "";
  try {
    const data = error?.response?.data;
    const text =
      typeof data?.text === "function" ? await data.text() : typeof data === "string" ? data : "";
    if (text) {
      try {
        const j = JSON.parse(text);
        serverMsg = j.message || "";
        serverDetail = j.detail || j.code || "";
        serverProject = j.projectId || "";
      } catch {
        serverMsg = String(text).slice(0, 200);
      }
    } else if (data && typeof data === "object" && !(data instanceof Blob)) {
      serverMsg = data.message || "";
      serverDetail = data.detail || data.code || "";
      serverProject = data.projectId || "";
    }
  } catch {
    /* ignore */
  }
  if (status === 403) return `${serverMsg || "Bị từ chối"} (HTTP 403) — bucket chưa public hoặc thiếu quyền Storage.`;
  if (status === 404) return `${serverMsg || "Không tìm thấy"} (HTTP 404) — backend đã restart sau khi cập nhật route chưa?`;
  if (status === 401) {
    const feProject = import.meta.env.VITE_FIREBASE_PROJECT_ID || "(frontend chưa cấu hình)";
    const beProject = serverProject || "(không rõ)";
    if (serverProject && feProject && serverProject !== feProject) {
      return `Sai Firebase project (HTTP 401): backend "${beProject}" khác frontend "${feProject}". Sửa 2 file .env cho giống nhau — đăng nhập lại không hết lỗi này.`;
    }
    const detailSuffix = serverDetail ? ` Chi tiết: ${serverDetail}` : "";
    return `${serverMsg || "Hết phiên đăng nhập"} (HTTP 401) — đăng xuất rồi đăng nhập lại là hết.${detailSuffix}`;
  }
  if (serverMsg) return `${serverMsg} (HTTP ${status})`;
  if (status) return `Server trả HTTP ${status}.`;
  if (error?.code === "ERR_NETWORK") return "Không nối được backend — kiểm tra backend có đang chạy + VITE_API_URL.";
  return error?.message || fallback;
}

export default api;
