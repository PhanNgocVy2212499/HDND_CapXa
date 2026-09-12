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

export default api;
