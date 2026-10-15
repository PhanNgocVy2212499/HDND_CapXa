/**
 * middleware/auth.js
 * Xác thực Firebase ID Token từ header Authorization: Bearer <token> hoặc query ?token=<token>
 * Gắn req.user = { uid, email, role, ...customClaims }
 */
const { auth } = require('../config/firebaseAdmin');

async function verifyFirebaseToken(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, headerToken] = header.split(' ');
    const token = headerToken || req.query.token;
    if (!token) {
      return res.status(401).json({ message: 'Thiếu Firebase ID Token.', projectId: process.env.FIREBASE_PROJECT_ID || '' });
    }
    const decoded = await auth.verifyIdToken(token, true);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role, // custom claim do Backend set via setCustomUserClaims
      departmentId: decoded.departmentId,
      ...decoded,
    };
    return next();
  } catch (err) {
    console.error('[auth] verifyIdToken failed:', err.message);
    // Trả luôn lý do gốc + giờ server để chẩn đoán: hết hạn / sai project / lệch giờ máy chủ
    return res.status(401).json({
      message: 'Token không hợp lệ hoặc đã hết hạn.',
      detail: err.message || '',
      code: err.code || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      serverTime: new Date().toISOString(),
    });
  }
}

module.exports = { verifyFirebaseToken };
