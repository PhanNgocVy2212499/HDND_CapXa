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

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET } = process.env;

let db = null;
let auth = null;
let storage = null;

const isPlaceholder = !FIREBASE_PRIVATE_KEY || FIREBASE_PRIVATE_KEY.includes('XXX');

if (!isPlaceholder && FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL) {
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        storageBucket: FIREBASE_STORAGE_BUCKET,
      });
      console.log('[firebaseAdmin] Initialized project:', FIREBASE_PROJECT_ID);
    }
    db = admin.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    auth = admin.auth();
    storage = admin.storage().bucket();
  } catch (err) {
    console.warn('[firebaseAdmin] Cảnh báo lỗi khởi tạo Firebase Admin:', err.message);
  }
} else {
  console.warn('[firebaseAdmin] Cảnh báo: FIREBASE_PRIVATE_KEY chưa được cấu hình hoặc là placeholder ("XXX"). Backend đang chạy ở chế độ chờ cấu hình Firebase Service Account.');
}

// Fallback dummy nếu chưa có credentials để không làm sập server khi khởi động
if (!db) {
  const dummyHandler = {
    get(_target, prop) {
      if (prop === 'settings') return () => {};
      return () => {
        throw new Error('[firebaseAdmin] Firebase Admin chưa được kết nối. Vui lòng cập nhật FIREBASE_PRIVATE_KEY trong backend/.env');
      };
    }
  };
  db = new Proxy({}, dummyHandler);
}

module.exports = { admin, db, auth, storage };
