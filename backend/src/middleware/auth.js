/**
 * middleware/auth.js
 * Xác thực Firebase ID Token từ header Authorization: Bearer <token>
 * Gắn req.user = { uid, email, role, ...customClaims }
 */
const { auth } = require('../config/firebaseAdmin');

async function verifyFirebaseToken(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');
    if (!token) {
      return res.status(401).json({ message: 'Thiếu Firebase ID Token.' });
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
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
}

module.exports = { verifyFirebaseToken };
