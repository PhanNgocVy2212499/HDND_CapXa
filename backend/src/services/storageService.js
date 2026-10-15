/**
 * services/storageService.js
 * Upload buffer và phục vụ/stream file an toàn về client.
 * 3 chế độ qua biến môi trường STORAGE_MODE:
 *  - 'firebase' (mặc định): Firebase Storage — cần bật Storage trong Console.
 *  - 'local': lưu vào backend/public/uploads, server Express phục vụ trực tiếp.
 *    Không tốn phí, hợp cho chạy demo/thí điểm tại xã (1 máy chủ).
 *  - 'cloudinary': upload lên Cloudinary (PDF lưu dạng raw, ảnh lưu dạng image).
 *    Cần CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
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

/**
 * Đoán storagePath từ fileUrl cho các document cũ thiếu field storagePath.
 * - Dạng public: https://storage.googleapis.com/<bucket>/<object-path>
 * - Dạng Firebase: https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<url-encoded-path>?alt=media
 */
function inferStoragePathFromUrl(fileUrl, bucketName) {
  try {
    if (!fileUrl || typeof fileUrl !== 'string') return '';
    const u = new URL(fileUrl);
    if (u.hostname === 'storage.googleapis.com' && bucketName) {
      const prefix = `/${bucketName}/`;
      if (u.pathname.startsWith(prefix)) return decodeURIComponent(u.pathname.slice(prefix.length));
    }
    const m = u.pathname.match(/\/o\/(.+)$/);
    if (m) return decodeURIComponent(m[1]);
    return '';
  } catch {
    return '';
  }
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
 * - PDF (application/pdf): resource_type 'raw' + format 'pdf', đuôi publicId .pdf để giữ đúng mime/định dạng.
 * - Ảnh (png/jpeg): resource_type 'image' để còn transform/preview như lưu ảnh.
 */
function uploadCloudinary(buffer, originalName, mimetype, folder) {
  const cloudinary = getCloudinary();
  const isPdf = mimetype === 'application/pdf';
  const baseName = String(originalName || 'file')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w\-]+/g, '_')
    .slice(0, 80);
  const publicId = `${Date.now()}_${uuidv4().slice(0, 8)}_${baseName || 'file'}${isPdf ? '.pdf' : ''}`;

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
 * Trích xuất thông tin Cloudinary (resourceType, type, publicId) từ fileUrl hoặc storagePath
 */
function parseCloudinaryInfo(fileUrl, storagePath) {
  if (fileUrl && fileUrl.includes('cloudinary.com')) {
    const match = fileUrl.match(/cloudinary\.com\/[^/]+\/(raw|image|video)\/([^/]+)\/(?:v\d+\/)?(.+)$/);
    if (match) {
      return {
        resourceType: match[1],
        type: match[2],
        publicId: storagePath || match[3],
      };
    }
  }
  if (storagePath) {
    const isPdf = /\.pdf$/i.test(storagePath);
    return {
      resourceType: isPdf ? 'raw' : 'image',
      type: 'upload',
      publicId: storagePath,
    };
  }
  return null;
}

/**
 * Lấy readable stream từ Cloudinary.
 * Đối với raw PDF: tự động sinh private_download_url có chữ ký bảo mật để vượt qua
 * rào cản ACL Block ("deny or ACL failure") trên Cloudinary CDN.
 */
async function getCloudinaryStream(fileUrl, storagePath) {
  const info = parseCloudinaryInfo(fileUrl, storagePath);
  if (!info) throw new Error('Không thể xác định thông tin asset Cloudinary.');

  const cloudinary = getCloudinary();
  const isPdf = info.resourceType === 'raw' || /\.pdf$/i.test(info.publicId);

  if (isPdf) {
    const format = /\.pdf$/i.test(info.publicId) ? '' : 'pdf';
    const signedUrl = cloudinary.utils.private_download_url(info.publicId, format, {
      resource_type: 'raw',
      type: info.type || 'upload',
      expires_at: Math.floor(Date.now() / 1000) + 7200,
    });
    const upstream = await axios.get(signedUrl, { responseType: 'stream', timeout: 35000 });
    return {
      stream: upstream.data,
      contentType: 'application/pdf',
      contentLength: upstream.headers['content-length'],
    };
  } else {
    // Với ảnh hoặc tài nguyên khác
    const targetUrl = fileUrl || cloudinary.url(info.publicId, { resource_type: info.resourceType, secure: true });
    const upstream = await axios.get(targetUrl, { responseType: 'stream', timeout: 35000 });
    return {
      stream: upstream.data,
      contentType: upstream.headers['content-type'] || 'image/png',
      contentLength: upstream.headers['content-length'],
    };
  }
}

/**
 * Phục vụ file (stream) an toàn từ Cloudinary, Firebase hoặc Local về client.
 * Tránh triệt để:
 *  1. Lỗi CORS Preflight Authorization khi trình duyệt theo redirect 302 từ localhost sang Cloudinary.
 *  2. Lỗi Cloudinary 401 "deny or ACL failure" trên link raw PDF công khai.
 *  3. Lỗi 403 Google Cloud Storage khi bucket chưa public.
 */
async function serveStoredFile({ res, fileUrl, storagePath, fallbackName = 'document.pdf' }) {
  const mode = process.env.STORAGE_MODE || 'firebase';
  const name = String(fallbackName || 'document.pdf').replace(/[^\w.\-]+/g, '_');
  const isPdf = /\.pdf$/i.test(name) || (fileUrl && /\.pdf($|\?)/i.test(fileUrl));

  // 1. Chế độ Local
  if (mode === 'local') {
    const abs = storagePath ? path.join(__dirname, '..', '..', 'public', storagePath) : '';
    if (abs && fs.existsSync(abs)) {
      if (isPdf) res.type('application/pdf');
      res.set('Content-Disposition', `inline; filename="${name}"`);
      return res.sendFile(abs);
    }
  }

  // 2. Cloudinary (khi mode=cloudinary hoặc URL chứa cloudinary.com)
  const isCloudinary = (mode === 'cloudinary' && (fileUrl || storagePath)) ||
    (fileUrl && fileUrl.includes('cloudinary.com')) ||
    (storagePath && !storagePath.startsWith('uploads/') && !storagePath.includes('firebasestorage'));

  if (isCloudinary) {
    try {
      const { stream, contentType, contentLength } = await getCloudinaryStream(fileUrl, storagePath);
      res.type(contentType || (isPdf ? 'application/pdf' : 'application/octet-stream'));
      res.set('Content-Disposition', `inline; filename="${name}"`);
      if (contentLength) res.set('Content-Length', contentLength);

      stream.on('error', (err) => {
        console.error('[serveStoredFile] Cloudinary stream error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Lỗi truyền file từ Cloudinary.', detail: err.message });
        }
      });
      return stream.pipe(res);
    } catch (cldErr) {
      console.warn('[serveStoredFile] Lỗi lấy stream Cloudinary, thử fallback tiếp theo:', cldErr.message);
    }
  }

  // 3. Firebase Storage (khi có storagePath và mode !== local)
  if (storagePath) {
    try {
      const file = storage.file(storagePath);
      const [exists] = await file.exists().catch(() => [false]);
      if (exists) {
        if (isPdf) res.type('application/pdf');
        res.set('Content-Disposition', `inline; filename="${name}"`);
        const stream = file.createReadStream();
        stream.on('error', (err) => {
          console.error('[serveStoredFile] Firebase stream error:', err.message);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Lỗi đọc file từ Firebase Storage.', detail: err.message });
          }
        });
        return stream.pipe(res);
      }
    } catch (fbErr) {
      console.warn('[serveStoredFile] Lỗi đọc Firebase Storage:', fbErr.message);
    }
  }

  // 4. URL HTTP(S) chung (kể cả Cloudinary fallback)
  if (fileUrl && /^https?:\/\//i.test(fileUrl)) {
    try {
      const upstream = await axios.get(fileUrl, { responseType: 'stream', timeout: 30000 });
      const cType = upstream.headers['content-type'] || (isPdf ? 'application/pdf' : 'application/octet-stream');
      res.type(cType);
      res.set('Content-Disposition', `inline; filename="${name}"`);
      if (upstream.headers['content-length']) {
        res.set('Content-Length', upstream.headers['content-length']);
      }
      return upstream.data.pipe(res);
    } catch (httpErr) {
      console.warn('[serveStoredFile] Fallback HTTP get failed:', httpErr.message);
    }
  }

  return res.status(404).json({
    message: 'Không tìm thấy file gốc hoặc file không truy cập được.',
    fileUrl: fileUrl || '',
    storagePath: storagePath || '',
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

module.exports = {
  uploadBuffer,
  inferStoragePathFromUrl,
  parseCloudinaryInfo,
  getCloudinaryStream,
  serveStoredFile,
};
