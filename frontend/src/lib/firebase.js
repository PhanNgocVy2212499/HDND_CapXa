import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { setToken } from "./api";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId);

let auth = null;
if (firebaseConfigured) {
  auth = getAuth(initializeApp(config));
}

export { auth, onAuthStateChanged };

export const ROLE_LABELS = {
  chuyen_vien: "Chuyên viên",
  thuong_truc: "Thường trực",
  co_quan_thuc_hien: "Đơn vị thực hiện",
  ban_hdnd: "Ban HĐND",
};

export function roleFromToken(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part)).role ?? null;
  } catch {
    return null;
  }
}

export async function loginEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  setToken(await cred.user.getIdToken());
  return cred.user;
}

// Ép cấp token mới (dùng khi API báo 401 do token cũ hết hạn sau ~1h)
export async function refreshToken() {
  const user = auth?.currentUser;
  if (!user) return null;
  const t = await user.getIdToken(true);
  setToken(t);
  return t;
}

export async function logout() {
  setToken("");
  if (auth) await signOut(auth);
}

export const AUTH_ERRORS = {
  "auth/invalid-credential": "Email hoặc mật khẩu chưa đúng.",
  "auth/user-not-found": "Email hoặc mật khẩu chưa đúng.",
  "auth/wrong-password": "Email hoặc mật khẩu chưa đúng.",
  "auth/invalid-email": "Email chưa đúng định dạng.",
  "auth/user-disabled": "Tài khoản đã bị vô hiệu hóa.",
  "auth/too-many-requests": "Đăng nhập sai quá nhiều — thử lại sau ít phút.",
  "auth/network-request-failed": "Lỗi mạng — kiểm tra kết nối internet.",
};
