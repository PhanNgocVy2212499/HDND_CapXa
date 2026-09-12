/**
 * firebaseAdmin.js
 * Khởi tạo Firebase Admin SDK dùng chung cho toàn bộ Backend.
 * Export: admin, db (Firestore), auth (Authentication), storage (Storage bucket)
 *
 * Yêu cầu ENV (.env):
 *  - FIREBASE_PROJECT_ID
 *  - FIREBASE_CLIENT_EMAIL
 *  - FIREBASE_PRIVATE_KEY (giữ nguyên ký tự \n)
 *  - FIREBASE_STORAGE_BUCKET
 */
require('dotenv').config();
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error(
      '[firebaseAdmin] Thiếu biến môi trường FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY. Xem .env.example'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      // Trên .env private key thường lưu dạng "...\\n..." -> cần convert về xuống dòng thật
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    storageBucket: FIREBASE_STORAGE_BUCKET,
  });

  console.log('[firebaseAdmin] Initialized project:', FIREBASE_PROJECT_ID);
}

const db = admin.firestore();
// Khuyến nghị: timestamps dạng object để dễ mapping sang ISO ở Frontend
db.settings({ ignoreUndefinedProperties: true });

const auth = admin.auth();
const storage = admin.storage().bucket();

module.exports = { admin, db, auth, storage };
