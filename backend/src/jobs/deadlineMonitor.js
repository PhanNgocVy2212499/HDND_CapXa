/**
 * jobs/deadlineMonitor.js
 * Cron mỗi đêm 01:00: quét indicators chưa hoàn thành, tính alertLevel:
 *  - red: quá hạn
 *  - yellow: còn <= 7 ngày
 *  - green: còn > 7 ngày
 */
const cron = require('node-cron');
const { admin, db } = require('../config/firebaseAdmin');

const YELLOW_DAYS = 7;

function startDeadlineMonitor() {
  cron.schedule('0 1 * * *', async () => {
    console.log('[cron] Quét deadline indicators...');
    try {
      const snap = await db
        .collection('indicators')
        .where('status', 'in', ['assigned', 'in_progress'])
        .get();
      const now = new Date();
      const batch = db.batch();
      let redCount = 0;
      snap.forEach((doc) => {
        const d = doc.data();
        const deadline = d.deadline?.toDate?.();
        if (!deadline) return;
        const diffDays = Math.ceil((deadline - now) / 86400000);
        const level = diffDays < 0 ? 'red' : diffDays <= YELLOW_DAYS ? 'yellow' : 'green';
        if (level === 'red') redCount++;
        batch.update(doc.ref, {
          alertLevel: level,
          ...(level === 'red' ? { status: 'overdue' } : {}),
          updatedAt: admin.firestore.Timestamp.now(),
        });
      });
      await batch.commit();
      console.log(`[cron] Xong: ${snap.size} chỉ tiêu, ${redCount} quá hạn (red).`);
      // TODO: gửi FCM/Email cho đơn vị chủ trì có alertLevel red/yellow
    } catch (e) {
      console.error('[cron] lỗi:', e.message);
    }
  });
}

module.exports = { startDeadlineMonitor };
