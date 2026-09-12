/**
 * server.js — Entry point Express
 */
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const { startDeadlineMonitor } = require('./jobs/deadlineMonitor');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json({ limit: '5mb' }));

// 1. Giao diện web tĩnh: mở http://localhost:PORT/ sẽ thấy UI (file public/index.html)
app.use(express.static(path.join(__dirname, '..', 'public')));

// 2. Thông tin API (JSON) chuyển sang /api để không đè lên giao diện
app.get('/api', (_req, res) => res.json({
  ok: true,
  service: 'hdnd-resolution-manager',
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
app.get('/health', (_req, res) => res.json({ ok: true, service: 'hdnd-resolution-manager' }));
app.use('/api', apiRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server]', err);
  res.status(500).json({ message: 'Lỗi hệ thống.', detail: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[server] Listening on :${PORT}`);
  console.log(`[server] Open: http://localhost:${PORT}`);
  console.log(`[server] Health check: http://localhost:${PORT}/health`);
  startDeadlineMonitor();
});
