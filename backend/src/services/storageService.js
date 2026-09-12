/**
 * services/storageService.js
 * Upload buffer và trả về { fileUrl, storagePath }.
 * 3 chế độ qua biến môi trường STORAGE_MODE:
 *  - 'firebase' (mặc định): Firebase Storage — cần bật Storage trong Console.
 *  - 'local': lưu vào backend/public/uploads, server Express phục vụ trực tiếp.
 *    Không tốn phí, hợp cho chạy demo/thí điểm tại xã (1 máy chủ).
 *  - 'cloudinary': upload lên Cloudinary (PDF lưu dạng raw, ảnh lưu dạng image).
 *    Cần CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { storage } = require('../config/firebaseAdmin');

const MODE = process.env.STORAGE_MODE || 'firebase';

function safeFileName(originalName) {
  return `${uuidv4()}_${String(originalName || 'file').replace(/[^\w.\-]+/g, '_')}`;
}

async function uploadLocal(buffer, originalName, folder) {
  const fileName = safeFileName(originalName);
  const dir = path.join(__dirname, "..", "..", "public", "uploads", folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), buffer);
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const storagePath = `uploads/${folder}/${fileName}`;
  return { fileUrl: `${base}/${storagePath}`, storagePath };
}

async function uploadFirebase(buffer, originalName, mimetype, folder) {
  const storagePath = `${folder}/${safeFileName(originalName)}`;
  const file = storage.file(storagePath);

  await file.save(buffer, {
    metadata: { contentType: mimetype },
    resumable: false,
  });
  // Public-read đơn giản cho demo nội bộ xã; production nên dùng signed URL + Rules
  await file.makePublic().catch(() => {});
  const fileUrl = `https://storage.googleapis.com/${storage.name}/${storagePath}`;
  return { fileUrl, storagePath };
}

function getCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error(
      'Thiếu cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).'
    );
  }
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

/**
 * Upload lên Cloudinary.
 * - PDF (application/pdf): resource_type 'raw' + format 'pdf', link secure_url tải/mở trực tiếp.
 * - Ảnh (png/jpeg): resource_type 'image' để còn transform/preview như lưu ảnh.
 */
function uploadCloudinary(buffer, originalName, mimetype, folder) {
  const cloudinary = getCloudinary();
  const isPdf = mimetype === 'application/pdf';
  const baseName = String(originalName || 'file')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 80);
  const publicId = `${Date.now()}_${uuidv4().slice(0, 8)}_${baseName || 'file'}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: String(folder || 'hdnd-xa').replace(/^\/+/, ''),
        public_id: publicId,
        resource_type: isPdf ? 'raw' : 'image',
        ...(isPdf ? { format: 'pdf' } : {}),
      },
      (err, result) => {
        if (err) return reject(err);
        resolve({ fileUrl: result.secure_url, storagePath: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} mimetype
 * @param {string} folder VD 'resolutions/2026' hoặc 'evidences/<indicatorId>'
 */
async function uploadBuffer(buffer, originalName, mimetype, folder = 'resolutions') {
  if (MODE === 'local') return uploadLocal(buffer, originalName, folder);
  if (MODE === 'cloudinary') return uploadCloudinary(buffer, originalName, mimetype, folder);
  return uploadFirebase(buffer, originalName, mimetype, folder);
}

module.exports = { uploadBuffer };
