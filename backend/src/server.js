/**
 * server.js — Entry point Express
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const { startDeadlineMonitor } = require('./jobs/deadlineMonitor');
const { initPostgresSchema } = require('./config/postgres');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json({ limit: '5mb' }));

// Version để frontend kiểm tra backend đã lên bản mới chưa (tránh process cũ giữ cổng)
const BACKEND_VERSION = '1.4.0-pdf-proxy-2026-09-12';
const backendInfo = () => ({
  version: BACKEND_VERSION,
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageMode: process.env.STORAGE_MODE || 'firebase',
  serverTime: new Date().toISOString(),
});

// 1. Giao diện web tĩnh: mở http://localhost:PORT/ sẽ thấy UI (file public/index.html)
app.use(express.static(path.join(__dirname, '..', 'public')));

// 2. Thông tin API (JSON) chuyển sang /api để không đè lên giao diện
app.get('/api', (_req, res) => res.json({
  ok: true,
  service: 'hdnd-resolution-manager',
  ...backendInfo(),
  health: '/health',
  endpoints: [
    'POST /api/resolutions/upload-ocr',
    'GET /api/resolutions',
    'POST /api/indicators/tree',
    'GET /api/indicators?resolutionId=...',
    'PUT /api/indicators/:id/approve',
    'POST /api/reports',
    'GET /api/reports?resolutionId=...',
    'POST /api/reviews',
    'GET /api/reviews?progressReportId=...',
    'GET /api/audit-logs?resolutionId=...',
  ],
}));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'hdnd-resolution-manager', ...backendInfo() }));
app.use('/api', apiRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server]', err);
  const isClient = err.status || err.statusCode || (err.message && (err.message.includes('Chỉ chấp nhận') || err.message.includes('dung lượng'))) || err.code === 'LIMIT_FILE_SIZE';
  const status = isClient ? (err.status || err.statusCode || 400) : 500;
  res.status(status).json({ message: err.message || 'Lỗi hệ thống.', detail: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[server] Listening on :${PORT}`);
  console.log(`[server] Open: http://localhost:${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
  startDeadlineMonitor();
  initPostgresSchema();
});
