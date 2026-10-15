# HƯỚNG DẪN CHI TIẾT — Luồng Hoạt Động, Cách Chạy, Vai Trò, OCR & Tách Trường Nghị Quyết

> Dự án: Quản lý Nghị quyết HĐND cấp xã (Quy trình 1)
> Stack: Backend Express + Firebase Admin (Auth/Firestore/Storage) + Cloud Vision OCR + Frontend React Vite
> File này giải thích từ A-Z: luồng nghiệp vụ → cách chạy → từng role làm gì → OCR chạy thế nào → tách `codeNumber/title/issuanceDate/signer` bằng regex ra sao.

---

## Mục lục

1. [Tổng quan kiến trúc](#1-tổng-quan-kiến-trúc)
2. [Luồng hoạt động end-to-end (6 bước)](#2-luồng-hoạt-động-end-to-end-6-bước)
3. [Cách chạy chi tiết (Backend + Frontend + Firebase)](#3-cách-chạy-chi-tiết-backend--frontend--firebase)
4. [Vai trò từng role (RBAC)](#4-vai-trò-từng-role-rbac)
5. [Sao để OCR được? (pdf-parse + Vision)](#5-sao-để-ocr-được-pdf-parse--vision)
6. [Làm sao tách các trường sau OCR? (mã NQ, tiêu đề, ngày, người ký)](#6-làm-sao-tách-các-trường-sau-ocr-mã-nq-tiêu-đề-ngày-người-ký)
7. [Schema Firestore](#7-schema-firestore)
8. [Frontend map với Backend thế nào?](#8-frontend-map-với-backend-thế-nào)
9. [Lỗi thường gặp](#9-lỗi-thường-gặp)
10. [Checklist chạy được](#10-checklist-chạy-được)

---

## 1. Tổng quan kiến trúc

```
┌─────────────┐      HTTPS + Bearer Token       ┌──────────────────┐
│  Frontend   │ ─────────────────────────────▶ │  Backend Express │
│ React Vite  │  FormData (file) / JSON         │  :5000 /api      │
│ :3000       │ ◀───────────────────────────── │                  │
└─────────────┘      JSON {data, message}       └────────┬─────────┘
       │                                                │
       │ Firebase Client SDK                            │ Firebase Admin SDK
       │ login email/pass → ID Token                    ▼
       │                                       ┌──────────────────┐
       └──────────────────────────────────────▶│ Firebase         │
          Auth (lấy token)                     │ - Auth (verify)  │
                                               │ - Firestore (DB) │
                                               │ - Storage (file) │
                                               └────────┬─────────┘
                                                        │
                                                        ▼
                                               ┌──────────────────┐
                                               │ Google Cloud     │
                                               │ Vision API       │
                                               │ (OCR ảnh/scan)   │
                                               └──────────────────┘
```

**Thư mục thực tế:**

```
D:\HK5\TTNN
├── backend/src/
│   ├── server.js                    # Entry point, CORS, /health, /api, cron
│   ├── config/firebaseAdmin.js      # Init Admin SDK từ .env
│   ├── middleware/auth.js           # verifyFirebaseToken → req.user
│   ├── middleware/rbac.js           # requireRole(...roles)
│   ├── middleware/upload.js         # multer memoryStorage, 20MB, PDF/PNG/JPG
│   ├── services/storageService.js   # uploadBuffer: firebase|local|cloudinary
│   ├── services/ocrService.js       # extractText + extractFields (CORE OCR)
│   ├── controllers/resolutionController.js  # POST upload-ocr → draft
│   ├── controllers/indicatorController.js   # POST tree, GET list, PUT approve
│   ├── controllers/reportReviewController.js# POST reports, POST reviews
│   ├── jobs/deadlineMonitor.js      # cron 01:00 tính alertLevel
│   ├── routes/index.js              # Bảng router + gắn role từng API
│   └── types/firestoreSchemas.ts    # Schema TS 4 collections
├── frontend/src/
│   ├── lib/api.js                   # axios + gắn Bearer tự động
│   ├── lib/firebase.js              # login, roleFromToken
│   ├── components/UploadOcr.jsx     # Màn hình OCR
│   ├── components/IndicatorTree.jsx # Dựng cây
│   ├── components/ApproveAssign.jsx # Duyệt
│   ├── components/ReportForm.jsx    # Báo cáo
│   ├── components/ReviewForm.jsx    # Thẩm tra
│   └── components/Dashboard.jsx     # Tổng quan
```

---

## 2. Luồng hoạt động end-to-end (6 bước)

### Sơ đồ trạng thái

```
Resolution:  draft ──(POST tree)──▶ pending_ban_review ──(Ban đồng ý)──▶ pending_approval ──(Thường trực duyệt)──▶ approved ──▶ completed
                                          │
                                          └──(Ban yêu cầu sửa)──▶ revision_requested (sửa lại cây)
Indicator:   draft ──▶ pending_ban_review ──▶ pending_approval ──▶ assigned ──▶ in_progress ──▶ completed
                                                                                └──▶ overdue (cron, quá hạn)
Report:      submitted ──(review passed)──▶ approved
                       └──(need_clarification)──▶ rejected (làm lại)
```

### Chi tiết từng bước

| Bước | Ai làm | API | Input | Output / Hiệu ứng DB |
|------|--------|-----|-------|----------------------|
| **0. Login** | Tất cả | Firebase Auth client | `email/pass` | `ID Token (JWT)` chứa `role`, `departmentId`. Frontend tự gắn `Authorization: Bearer <token>` cho mọi request (`frontend/src/lib/api.js:20-23`) |
| **1. Upload + OCR** | `chuyen_vien` | `POST /api/resolutions/upload-ocr` (form-data `file`) | PDF/Ảnh NQ | 1) Upload Storage `resolutions/2026/<uuid>_ten.pdf` → `fileUrl` 2) OCR → `fields` 3) Tạo `resolutions/{id}` với `status='draft'`, `ocrRawText`, `ocrEngine`, `ocrConfidence`. Trả `201 {data: {id, codeNumber, title, signer, issuanceDate, fileUrl}}` |
| **2. Dựng cây chỉ tiêu** | `chuyen_vien` | `POST /api/indicators/tree` JSON `{resolutionId, tree:[...]}` | Cây `title/targetValue/unit/frequency/deadline/assignedDepartments/children[]` | Lưu đệ quy `indicators`. NQ chuyển `pending_ban_review` (gửi Ban HĐND thẩm tra). Xem `indicatorController.js` |
| **3. Ban HĐND thẩm tra cây chỉ tiêu** | `ban_hdnd` (hoặc `thuong_truc`) | `POST /api/resolutions/:id/ban-review` JSON `{status:'approved'\|'rejected', comment}` | Kết luận của Ban HĐND | `approved` $\rightarrow$ NQ chuyển `pending_approval` (sẵn sàng chuyển Thường trực); `rejected` $\rightarrow$ `revision_requested` (trả về Chuyên viên sửa). Ghi audit `ban_review_resolution` |
| **4. Phê duyệt & giao việc** | `thuong_truc` | `PUT /api/indicators/:id/approve` JSON `{deadline, assignedDepartments[]}` | Hạn + đơn vị chủ trì/phối hợp | Chỉ cho duyệt khi Ban HĐND đã đồng ý (`pending_approval`). NQ chuyển `approved`, Indicator $\rightarrow$ `status='assigned'`. Gán `assignedDepartments=[{departmentId, departmentName, role: primary\|cooperate}]` |
| **5. Báo cáo tiến độ** | `co_quan_thuc_hien` | `POST /api/reports` form-data `indicatorId, actualValue, progressPercentage, remarks, evidence(file)` | Số liệu + file minh chứng | Tạo `progressReports/{id}` `status='submitted'`. Upload minh chứng `evidences/<indicatorId>/...`. Denormalize lên indicator: `currentValue, progressPercentage, status='in_progress'` |
| **6. Thẩm tra báo cáo tiến độ** | `ban_hdnd` hoặc `thuong_truc` | `POST /api/reviews` JSON `{progressReportId, status: passed\|need_clarification, comment}` | Kết luận thẩm tra | Tạo `reviews/{id}`. Đồng bộ report: `passed→approved`, `need_clarification→rejected` |
| **7. Cron deadline** | Tự động | (không cần gọi, chạy 01:00 đêm) | Quét `indicators` có `status in [assigned, in_progress]` | Tính `alertLevel`: `red` (quá hạn, `<0 ngày`), `yellow` (`<=7 ngày`), `green` (`>7 ngày`). `red` → `status='overdue'`. Xem `deadlineMonitor.js:14-43` |

### Ví dụ chạy tay đúng thứ tự (Postman)

```text
BASE = http://localhost:5000/api
Header: Authorization: Bearer <idToken đúng role từng bước>

1) POST {{BASE}}/resolutions/upload-ocr
   Body form-data: file = [chọn PDF NQ] → copy data.id = resolutionId

2) POST {{BASE}}/indicators/tree
   {"resolutionId":"<id>","tree":[{"title":"Tỷ lệ hộ nghèo <2%","targetValue":2,"unit":"%",
    "frequency":"quarterly","deadline":"2026-12-31",
    "assignedDepartments":[{"departmentId":"ubnd-xa","role":"primary"}],
    "children":[{"title":"Hỗ trợ 50 hộ","targetValue":50,"unit":"hộ",
                 "frequency":"monthly","deadline":"2026-09-30"}]}]}
   → copy 1 indicatorId (Firestore → indicators)

3) PUT {{BASE}}/indicators/<indicatorId>/approve
   {"deadline":"2026-12-31","assignedDepartments":[
     {"departmentId":"ubnd-xa","departmentName":"UBND xã","role":"primary"}]}

4) POST {{BASE}}/reports (form-data)
   indicatorId=<id>, actualValue=1.5, progressPercentage=70,
   remarks="Đã hỗ trợ 35/50 hộ", evidence=[file] → copy reportId

5) POST {{BASE}}/reviews (JSON)
   {"progressReportId":"<reportId>","status":"passed","comment":"Khớp minh chứng"}
```

---

## 3. Cách chạy chi tiết (Backend + Frontend + Firebase)

### 3.1. Chuẩn bị (làm 1 lần)

| Cần gì | Để làm gì | Lấy ở đâu |
|--------|-----------|-----------|
| Node.js >= 18 | Chạy BE/FE | `node -v`, `npm -v` |
| Firebase Project (VD `hdnd-xa-demo`) | Auth/Firestore/Storage | console.firebase.google.com → Add project |
| Service Account Key | BE xác thực Admin SDK | Project settings → Service accounts → Generate new private key → lấy `project_id`, `client_email`, `private_key` |
| Storage Bucket `xxx.appspot.com` | Lưu PDF + minh chứng | Build → Storage → Get started |
| Cloud Vision API = Enabled | OCR scan/ảnh | console.cloud.google.com → APIs & Services → Enable **Cloud Vision API** |
| 4 user test | Test RBAC | Authentication → Users → Add user |

Tạo 4 user ví dụ:

```text
chuyenvien@xa.gov.vn / 123456
thuongtruc@xa.gov.vn  / 123456
ubnd@xa.gov.vn        / 123456
banhdnd@xa.gov.vn     / 123456
```

Ghi lại **UID** từng user (cột User UID) để gán role.

### 3.2. Setup Firebase Console

**Auth:** Build → Authentication → Get started → bật `Email/Password` → Users → Add user (4 tài khoản trên).

**Firestore:** Build → Firestore → Create database → Production mode → region `asia-southeast1` → tab Rules → paste nội dung `backend/firestore.rules` → Publish. Hoặc CLI:

```powershell
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

**Storage Rules (demo):**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

**Vision:** Cloud Console → đúng project → Enable `Cloud Vision API`. Nếu `PERMISSION_DENIED` → IAM → thêm role `Cloud Vision AI Service Agent` cho `client_email`.

### 3.3. Chạy Backend (:5000)

```powershell
Set-Location -LiteralPath "D:\HK5\TTNN\backend"
npm install
Copy-Item .env.example .env
notepad .env
```

Điền `.env` (xem `backend/.env.example:1-20`):

```env
FIREBASE_PROJECT_ID=hdnd-xa-demo
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc@hdnd-xa-demo.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...XXX...=\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=hdnd-xa-demo.appspot.com
PORT=5000
CLIENT_URL=http://localhost:3000
STORAGE_MODE=firebase
# STORAGE_MODE=local        # demo offline, lưu backend/public/uploads
# STORAGE_MODE=cloudinary   # cần thêm 3 biến CLOUDINARY_*
```

> `FIREBASE_PRIVATE_KEY` giữ nguyên `\n` trong chuỗi + dấu `"..."`. Code convert ở `config/firebaseAdmin.js:29`: `.replace(/\\n/g, '\n')`.

Chạy:

```powershell
Set-Location -LiteralPath "D:\HK5\TTNN\backend"
npm run dev    # dev, nodemon tự reload
# npm start    # production
```

Thành công khi thấy:

```text
[firebaseAdmin] Initialized project: hdnd-xa-demo
[server] Listening on :5000
```

Kiểm tra:

```powershell
Invoke-RestMethod http://localhost:5000/health
# ok: True
```

### 3.4. Gán role (BẮT BUỘC, nếu không sẽ 403)

Backend dùng `verifyFirebaseToken + requireRole(...)` (`routes/index.js:15-38`). Chưa gán `role` → `403`.

```powershell
Set-Location -LiteralPath "D:\HK5\TTNN\backend"
node setRole.js   # sửa UID thật trong file trước khi chạy
```

Nội dung `setRole.js` gán:

```js
chuyen_vien       departmentId=hdnd
thuong_truc       departmentId=thuong-truc
co_quan_thuc_hien departmentId=ubnd-xa
ban_hdnd          departmentId=ban-kinh-te
```

> Sau khi gán → **đăng xuất + đăng nhập lại** để ID Token mới chứa claim.

Lấy ID Token thủ công (không cần FE) để test Postman:

```powershell
$apiKey = "<WEB_API_KEY: Project settings -> General -> Web API Key>"
$body = @{ email="chuyenvien@xa.gov.vn"; password="123456"; returnSecureToken=$true } | ConvertTo-Json
$res = Invoke-RestMethod "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" -Method Post -Body $body -ContentType "application/json"
$res.idToken
```

### 3.5. Chạy Frontend (:3000)

```powershell
# Terminal 1
Set-Location "D:\HK5\TTNN\backend"; npm run dev
# Terminal 2
Set-Location "D:\HK5\TTNN\frontend"; npm install; npm run dev
# Mở http://localhost:3000
```

`frontend/.env` cần:

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_APIKEY=...
VITE_FIREBASE_AUTHDOMAIN=...
VITE_FIREBASE_PROJECTID=...
# ... 6 dòng VITE_FIREBASE_* lấy ở Project settings → General → Your apps → Web app → firebaseConfig
```

Luồng UI: `Upload & OCR` (kéo thả → preview trái → bấm Upload & OCR → form phải tự điền `codeNumber/title/signer/issuanceDate` → sửa tay) → `Cây chỉ tiêu` (`resolutionId` tự chuyển qua) → `Phê duyệt` → `Báo cáo` → `Thẩm tra` → `Tổng quan`.

---

## 4. Vai trò từng role (RBAC)

### 4.1. Tổng quan 4 roles

| Role | Con người thật | Được gọi API nào | Bị chặn API nào | departmentId mẫu |
|------|----------------|------------------|-----------------|------------------|
| `chuyen_vien` | Chuyên viên HĐND xã (văn phòng) | `POST /resolutions/upload-ocr`, `POST /indicators/tree`, `GET /indicators` | approve, reports, reviews → `403` | `hdnd` |
| `thuong_truc` | Thường trực HĐND (Chủ tịch/PCT) | `POST /indicators/tree`, `PUT /indicators/:id/approve`, `POST /reviews`, `GET /indicators` | upload-ocr, reports → `403` | `thuong-truc` |
| `co_quan_thuc_hien` | UBND xã / công chức chuyên môn | `POST /reports`, `GET /indicators` | upload, tree, approve, reviews → `403` | `ubnd-xa` |
| `ban_hdnd` | Ban Kinh tế-Xã hội / Ban Pháp chế | `POST /reviews`, `GET /indicators` | upload, tree, approve, reports → `403` | `ban-kinh-te` |

### 4.2. Cơ chế kỹ thuật (3 lớp)

**Lớp 1 — Middleware Auth (`middleware/auth.js:8-28`):**

```js
// Header: Authorization: Bearer <ID Token>
const decoded = await auth.verifyIdToken(token, true);
req.user = { uid, email, role, departmentId, ...decoded };
```

`role` chính là Custom Claim do `setRole.js` gán. Không có token / token hết hạn → `401`.

**Lớp 2 — Middleware RBAC (`middleware/rbac.js:6-19`):**

```js
requireRole('chuyen_vien') // chỉ 1 role
requireRole('ban_hdnd','thuong_truc') // 1 trong 2 role
// Không có req.user.role → 403 "chưa được gán vai trò"
// Sai role → 403 "Vai trò 'x' không có quyền..." + required: [...]
```

**Lớp 3 — Bảng router (`routes/index.js:12-38`):**

```js
POST /resolutions/upload-ocr → requireRole('chuyen_vien')
POST /indicators/tree        → requireRole('chuyen_vien','thuong_truc')
GET  /indicators             → chỉ cần login (verifyFirebaseToken)
PUT  /indicators/:id/approve → requireRole('thuong_truc')
POST /reports                → requireRole('co_quan_thuc_hien')
POST /reviews                → requireRole('ban_hdnd','thuong_truc')
```

**Lớp 4 (phòng thủ thêm) — Firestore Rules (`firestore.rules:7-27`):**

```
resolutions:     read=signedIn, write=chuyen_vien|thuong_truc
indicators:      read=signedIn, write=chuyen_vien|thuong_truc
progressReports: create=co_quan_thuc_hien, update=co_quan_thuc_hien|ban_hdnd|thuong_truc
reviews:         create=ban_hdnd|thuong_truc
delete: false (tất cả — chống xóa nhầm)
```

> API đã chặn ở backend nên rules chủ yếu chống user ghi trực tiếp từ client SDK.

### 4.3. Ví dụ lỗi phân quyền

```json
// Chưa gán role:
{ "message": "Tài khoản chưa được gán vai trò (role)." } // 403
// Sai role: ban_hdnd gọi upload-ocr:
{ "message": "Vai trò 'ban_hdnd' không có quyền thực hiện chức năng này.",
  "required": ["chuyen_vien"] } // 403
// Quên token:
{ "message": "Thiếu Firebase ID Token." } // 401
```

Fix: chạy `node setRole.js` → logout/login lại → copy token mới.

### 4.4. Role map với màn hình Frontend

| Màn hình (`App.jsx`) | Role chính | Ghi chú |
|----------------------|------------|---------|
| Upload & OCR | `chuyen_vien` | Token chuyên viên, nếu sai role sẽ báo `403` ở toast |
| Cây chỉ tiêu | `chuyen_vien` | `thuong_truc` cũng dựng được |
| Phê duyệt & giao việc | `thuong_truc` | Chọn đơn vị `ubnd-xa` primary + phối hợp |
| Báo cáo tiến độ | `co_quan_thuc_hien` | Kèm file minh chứng |
| Thẩm tra | `ban_hdnd` / `thuong_truc` | `passed` hoặc `need_clarification` |
| Tổng quan | Tất cả | Đọc `alertLevel` đỏ/vàng/xanh |

---

## 5. Sao để OCR được? (pdf-parse + Vision)

### 5.1. Điều kiện cần (nếu thiếu sẽ lỗi)

1. `.env` Firebase đúng (đặc biệt `FIREBASE_PRIVATE_KEY` giữ `\n`).
2. Vision API đã Enable. Test nhanh: upload 1 PDF text-based trước (chỉ cần `pdf-parse`, không cần Vision). Nếu PDF scan/ảnh mới cần Vision.
3. File đúng MIME: `application/pdf`, `image/png`, `image/jpeg`, ≤ 20MB (`middleware/upload.js:8-17`). Sai định dạng → `400 Chỉ chấp nhận file PDF, PNG, JPG`.
4. Gọi đúng role `chuyen_vien` + đúng field `file` (form-data). Sai field → `400 Vui lòng chọn file...`.
5. Nếu chạy local không muốn tốn Vision: để PDF text-based (export từ Word), `pdf-parse` xử lý offline miễn phí.

### 5.2. Chiến lược 2 tầng trong `services/ocrService.js:17-45`

```js
async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    try {
      const data = await pdfParse(buffer);          // Tầng 1: đọc text nhúng
      if (data.text.trim().length > 50)
        return { text, confidence: 0.95, engine: 'pdf-parse' };
    } catch (e) { /* rớt xuống Vision */ }
    // PDF scan (không có text) → Vision
    const [r] = await visionClient.documentTextDetection({ image:{content:buffer} });
    return { text: r.fullTextAnnotation.text, confidence: 0.85, engine: 'vision' };
  }
  // Ảnh → Vision luôn
  const [r] = await visionClient.documentTextDetection({ image:{content:buffer} });
  return { text, confidence: 0.85, engine: 'vision' };
}
```

| Loại file | Engine | Độ tin cậy | Tốn phí? | Khi nào dùng |
|-----------|--------|------------|----------|--------------|
| PDF xuất từ Word (có text) | `pdf-parse` | `0.95` | Miễn phí, nhanh, offline | Văn bản điện tử, ký số |
| PDF scan / photo / ảnh chụp | `vision` (`documentTextDetection`) | `0.85` | Tốn quota Vision | Bản giấy scan, ảnh chụp |
| File mờ, <10 ký tự OCR | `none` + throw | `0` | — | BE vẫn tạo draft để nhập tay, không sập request |

> `documentTextDetection` (không phải `textDetection`) vì tối ưu văn bản dày đặc nhiều trang tiếng Việt.

### 5.3. Toàn bộ pipeline `upload-ocr` (`controllers/resolutionController.js:15-86`)

```
1. multer (memoryStorage) → req.file {buffer, originalname, mimetype}
         ↓ validate MIME + 20MB
2. uploadBuffer(buffer, name, mime, "resolutions/2026")
   → STORAGE_MODE=firebase: storage.file(path).save() + makePublic()
   → STORAGE_MODE=local: ghi backend/public/uploads/...
   → STORAGE_MODE=cloudinary: upload_stream (PDF=raw, ảnh=image)
   → {fileUrl, storagePath}
         ↓
3. ocrResolutionFile(buffer, mimetype)
   → {fields, ocrRawText (cắt 20000 ký tự), confidence, engine}
   → try/catch: OCR lỗi vẫn tạo draft (engine='none')
         ↓
4. Override tay: req.body.codeNumber/title/signer (nếu FE gửi kèm)
         ↓
5. db.collection('resolutions').doc().set({
     codeNumber (hoặc DRAFT-XXXXXX nếu OCR trắng),
     title, issuanceDate (Timestamp), signer,
     fileUrl, storagePath, status:'draft',
     ocrRawText, ocrConfidence, ocrEngine,
     createdByUserId, createdAt, updatedAt })
         ↓
6. Trả 201 {message, data:{..., issuanceDate: ISO, createdAt: ISO}}
```

Log terminal để debug:

```text
[ocr] extracted: { engine:'pdf-parse', codeNumber:'05/2026/NQ-HĐND', titleLen: 68, signer:'Nguyễn Văn A' }
[upload-ocr] OCR failed, vẫn tạo draft: OCR không trích xuất được...
```

### 5.4. Test OCR không cần Vision (nhanh nhất)

1. Tạo 1 file Word → Save as PDF với nội dung:

```text
CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
HỘI ĐỒNG NHÂN DÂN XÃ ...
Số: 05/2026/NQ-HĐND
... ngày 15 tháng 8 năm 2026
NGHỊ QUYẾT
Về việc phê duyệt chương trình giảm nghèo năm 2026
...
TM. HỘI ĐỒNG NHÂN DÂN
CHỦ TỊCH
Nguyễn Văn A
```

2. `POST /resolutions/upload-ocr` với role `chuyen_vien` → phải ra `engine=pdf-parse`, `codeNumber=05/2026/NQ-HĐND`.
3. Thử tiếp với ảnh chụp màn hình PDF đó (PNG) → phải ra `engine=vision` (cần Vision Enable).

---

## 6. Làm sao tách các trường sau OCR? (mã NQ, tiêu đề, ngày, người ký)

Hàm tổng: `ocrResolutionFile()` → `extractFields(rawText)` → `{codeNumber, title, issuanceDate, signer}` (`ocrService.js:155-173`). Dưới đây mổ xẻ từng trường.

### 6.1. Bước chuẩn hóa dòng (`normLines`, dòng 57-63)

```js
function normLines(rawText) {
  return rawText.replace(/\r/g,'').split('\n')
    .map(l => l.replace(/[ \t\u00a0]+/g,' ').trim()) // gộp space, tab, non-breaking space
    .filter(l => l.length > 0);                        // bỏ dòng trống
}
```

Mục đích: OCR Vision hay trả về khoảng trắng thừa, dòng trống → chuẩn hóa trước khi regex.

### 6.2. Trường 1 — Số hiệu `codeNumber` (dòng 159-162)

```js
const codeMatch =
  text.match(/Số\s*:?\s*(\d+\s*\/\s*\d{4}\s*\/\s*NQ-HĐND)/i) || // ưu tiên full: 05/2026/NQ-HĐND
  text.match(/(\d+\s*\/\s*NQ-HĐND)/i);                           // fallback: 05/NQ-HĐND
const codeNumber = codeMatch ? codeMatch[1].replace(/\s+/g,'') : '';
```

Giải thích regex:

| Mảnh | Ý nghĩa | Ví dụ khớp |
|------|---------|------------|
| `Số\s*:?\s*` | Chữ "Số" + có/không dấu `:` | `Số:`, `Số :`, `Số` |
| `(\d+\s*\/\s*\d{4}\s*\/\s*NQ-HĐND)` | Nhóm bắt: số + `/` + năm 4 số + `/` + `NQ-HĐND`, cho phép space quanh `/` (OCR hay chèn space) | `05/2026/NQ-HĐND`, `05 / 2026 / NQ-HĐND` |
| Flag `i` | Không phân biệt hoa/thường | `nq-hđnd` vẫn khớp |
| `.replace(/\s+/g,'')` | Xóa space thừa trong kết quả | `05 / 2026 / NQ-HĐND` → `05/2026/NQ-HĐND` |

Ví dụ thực tế:

```text
OCR: "Số: 69/NQ-HĐND"                    → "69/NQ-HĐND" (fallback nhánh 2)
OCR: "Số: 05 / 2026 / NQ-HĐND"           → "05/2026/NQ-HĐND"
OCR: "Sô: 05/2026/NQ-HĐND" (OCR sai ô→o) → "" (trống → BE gán DRAFT-XXXXXX, chuyên viên sửa tay)
```

> Muốn chịu lỗi OCR tốt hơn: thêm pattern `/S[ốoô]\s*:?/i` hoặc dùng `NQ-H[ĐD]ND` để bắt `NQ-HDND` mất dấu.

### 6.3. Trường 2 — Ngày ban hành `issuanceDate` (dòng 48-54)

```js
function parseVietnameseDate(text) {
  const m = text.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i);
  if (m) return new Date(m[3], m[2]-1, m[1]);   // "ngày 15 tháng 8 năm 2026"
  const m2 = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); // "15/08/2026"
  if (m2) return new Date(m2[3], m2[2]-1, m2[1]);
  return new Date(); // fallback hôm nay
}
```

Lưu ý: `new Date(năm, tháng-1, ngày)` vì tháng JS 0-based. Fallback hôm nay để không crash, FE hiển thị và chuyên viên sửa.

Ví dụ:

```text
"... ngày 15 tháng 8 năm 2026 ..." → Date(2026,7,15) → Firestore Timestamp → FE "15/08/2026"
"Ngày ban hành: 15/08/2026"         → Date(2026,7,15)
"Không tìm thấy ngày"               → new Date() (hôm nay)
```

### 6.4. Trường 3 — Trích yếu `title` (dòng 110-153, phức tạp nhất)

Logic 3 tầng fallback:

**Tầng A — Có mốc "Về việc / V/v":**

```js
idx = lines.findIndex(l => /^(V\/v|v\/v|về việc)\b/i.test(l));
if (idx===-1) idx = lines.findIndex(l => /(V\/v|về việc)\s*:/i.test(l));
first = lines[idx].replace(/^(V\/v|v\/v|về việc)\s*:?\s*/i,'').trim();
body = collect(idx+1, first); // gom tối đa 6 dòng, dừng khi gặp STOP
```

**Tầng B — Không có "Về việc", lấy sau dòng "NGHỊ QUYẾT":**

```js
hIdx = lines.findIndex(l => /^nghị quyết\b/i.test(l));
sameLine = lines[hIdx].replace(/^nghị quyết\s*:?\s*/i,'');
// "NGHỊ QUYẾT Về việc giảm nghèo" cùng 1 dòng → tách phần sau "Về việc"
m = sameLine.match(/(?:về việc|v\/v)\s*:?\s*(.+)/i);
body = collect(hIdx+1, m ? m[1] : sameLine);
```

**Tầng C — Fallback dòng IN HOA dài đầu tiên:**

```js
upper = lines.find(l => l.length>20 && l===l.toUpperCase() && !/(CỘNG HÒA|ĐỘC LẬP|HẠNH PHÚC)/.test(l));
```

Hàm `collect()` gom tối đa 6 dòng và dừng khi gặp từ chặn:

```js
STOP = /^(căn cứ|quyết nghị|điều\s*\d|chương\s+[ivx\d]|mục\s*\d|nơi nhận|tm\.|kt\.|(phó\s+)?chủ tịch|...)/i
```

Chuẩn hóa cuối:

```js
if (!/^nghị quyết/i.test(body)) body = `Nghị quyết về việc ${body[0].toLowerCase()+body.slice(1)}`;
return body.slice(0,500);
```

Ví dụ end-to-end:

```text
Dòng OCR:
  "NGHỊ QUYẾT"
  "Về việc phê duyệt"
  "chương trình giảm nghèo"
  "năm 2026"
  "Căn cứ Luật Tổ chức chính quyền địa phương..."
→ body = "phê duyệt chương trình giảm nghèo năm 2026"
→ title = "Nghị quyết về việc phê duyệt chương trình giảm nghèo năm 2026"
```

Nếu OCR trả về:

```text
  "NGHỊ QUYẾT Về việc ban hành Quy chế hoạt động của HĐND xã"
→ title = "Nghị quyết về việc ban hành Quy chế hoạt động của HĐND xã"
```

### 6.5. Trường 4 — Người ký `signer` (dòng 87-107, khó nhất vì OCR tên riêng hay sai)

**Cách 1 — Khối ký cổ điển (regex 1 phát):**

```js
rawText.match(/TM\.\s*HỘI ĐỒNG NHÂN DÂN[\s\S]{0,150}?(KT\.\s*)?(PHÓ\s+)?CHỦ TỊCH[^\n]*\n+([^\n]+)/i)
// Nhóm 3 = tên dòng sau "CHỦ TỊCH"
if (looksLikeName(m[3])) return titleCaseName(m[3]);
```

Khớp văn bản:

```text
TM. HỘI ĐỒNG NHÂN DÂN
CHỦ TỊCH
Nguyễn Văn A
→ signer = "Nguyễn Văn A"
```

**Cách 2 — Neo dòng CHỦ TỊCH cuối cùng:**

```js
anchor = index dòng cuối chứa /(PHÓ\s+)?CHỦ TỊCH/i
sameLine = lines[anchor].replace(/.*(PHÓ\s+)?CHỦ TỊCH/i,'').trim();
if (looksLikeName(sameLine)) return ...;           // "CHỦ TỊCH Nguyễn Văn A" cùng dòng
for (i=anchor+1; i<anchor+6; i++)                  // tên 1-5 dòng sau
  if (looksLikeName(lines[i])) return ...;
```

**Bộ lọc tên `looksLikeName()` (dòng 68-76):**

```js
clean = line.split(/[-–:]/).pop().trim();   // bỏ prefix "Người ký: Nguyễn Văn A" → "Nguyễn Văn A"
words = clean.split(/\s+/);
if (words.length<2 || >5) return false;      // tên 2-5 từ
if (/[0-9@#%\/\\()«»";]/.test(clean)) return false; // loại dòng có số/ký tự lạ
if (HEADER_KEYWORDS.test(clean)) return false;      // loại "Nơi nhận", "Căn cứ", "Chủ tịch"...
// Mỗi từ viết hoa đầu HOẶC cả dòng IN HOA (scan hay in hoa)
words.every(w => /^[A-ZÀ-ỸĐ][a-zà-ỹđ.]*\.?$/.test(w) || /^[A-ZÀ-ỸĐ.]{2,}$/.test(w))
```

**Chuẩn hóa `titleCaseName()`:** `"NGUYỄN VĂN A"` → `"Nguyễn Văn A"`.

Ví dụ:

```text
"NGUYỄN VĂN A" (scan in hoa) → "Nguyễn Văn A" ✓
"Chủ tịch"                   → loại (HEADER_KEYWORDS) → ""
"Nơi nhận: ..."              → loại → ""
"Nguyễn Văn A1"              → loại (có số) → ""
```

### 6.6. Cách debug tách trường (copy-paste là chạy)

Tạo file `backend/debug-ocr.js`:

```js
const { extractFields } = require('./src/services/ocrService');
const text = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
HỘI ĐỒNG NHÂN DÂN XÃ ...
Số: 05/2026/NQ-HĐND
... ngày 15 tháng 8 năm 2026
NGHỊ QUYẾT
Về việc phê duyệt chương trình giảm nghèo năm 2026
Căn cứ Luật...
TM. HỘI ĐỒNG NHÂN DÂN
CHỦ TỊCH
Nguyễn Văn A`;
console.log(extractFields(text));
// → { codeNumber:'05/2026/NQ-HĐND', title:'Nghị quyết về việc phê duyệt...',
//     issuanceDate: Date(2026,7,15), signer:'Nguyễn Văn A' }
```

Chạy: `node debug-ocr.js`. Dán `ocrRawText` thật từ Firestore vào `text` để xem regex nào trượt.

Mẹo với 2 PDF mẫu trong repo:

```text
69-NQ-TT.HĐND - ban hành Quy chế hoạt động của HĐND xã  CT.pdf
nq-14.1-chuong-trinh-hoat-dong-toan-khoa-nhiem-ky-2026-2031.signed.pdf
```

Upload từng file bằng role `chuyen_vien` → mở Firestore `resolutions/{id}` → copy `ocrRawText` → paste vào script trên → so `codeNumber/title/signer` với mắt thường → chỉnh regex nếu cần.

### 6.7. Khi OCR sai thì sao? (thiết kế đã lường trước)

1. BE **không bao giờ sập** vì OCR: `try/catch` ở `resolutionController.js:33-41` → vẫn tạo draft `engine='none'`.
2. `codeNumber` trống → gán `DRAFT-XXXXXX`; `title` trống → `"Nghị quyết (đang chờ hoàn thiện trích yếu)"`; `issuanceDate` trống → hôm nay.
3. FE cho sửa tay: `UploadOcr.jsx:35-37` gửi kèm `codeNumber/title/signer` trong cùng FormData → BE override ở `resolutionController.js:45-47`.
4. Giữ `ocrRawText` (cắt 20k ký tự) trong document để đối soát sau này.

Muốn nâng cấp: thêm dictionary sửa lỗi OCR (`Sô→Số`, `NQ-HDND→NQ-HĐND`), hoặc gọi LLM tóm tắt trích yếu từ `ocrRawText`.

---

## 7. Schema Firestore

Định nghĩa TS ở `backend/src/types/firestoreSchemas.ts`. Tóm tắt:

**`resolutions/{id}` — Nghị quyết:**

```ts
{ id, codeNumber:"05/2026/NQ-HĐND", title, issuanceDate:Timestamp,
  signer, fileUrl, storagePath:"resolutions/2026/<uuid>.pdf",
  status:'draft'|'pending_approval'|'approved'|'completed',
  ocrRawText, ocrConfidence:0.95, ocrEngine:'pdf-parse'|'vision'|'none',
  createdByUserId, createdAt, updatedAt }
```

**`indicators/{id}` — Chỉ tiêu cây:**

```ts
{ id, resolutionId, parentId:null|string, title, targetValue, currentValue?,
  unit:"%"|"hộ"|"km"|..., frequency:'monthly'|'quarterly'|'annual',
  deadline:Timestamp, status:'draft'|...'assigned'|'in_progress'|'overdue',
  alertLevel:'green'|'yellow'|'red', progressPercentage:0..100,
  assignedDepartments:[{departmentId:"ubnd-xa", departmentName?:"UBND xã",
                        role:'primary'|'cooperate'}], createdAt, updatedAt }
```

**`progressReports/{id}` — Báo cáo:**

```ts
{ id, indicatorId, resolutionId, reportedByUserId, departmentId,
  period?:"2026-08"|"2026-Q3", actualValue, progressPercentage:0..100,
  remarks?, evidenceFileUrl?, evidenceStoragePath?, status:'submitted'|'approved'|'rejected',
  reportedAt }
```

**`reviews/{id}` — Thẩm tra:**

```ts
{ id, progressReportId, indicatorId, reviewedByUserId,
  reviewerRole:'ban_hdnd'|'thuong_truc', comment,
  status:'passed'|'need_clarification', reviewedAt }
```

Index gợi ý: `indicators(resolutionId+parentId)`, `indicators(resolutionId+deadline)`, `progressReports(indicatorId+reportedAt DESC)`, `reviews(progressReportId+reviewedAt DESC)`.

---

## 8. Frontend map với Backend thế nào?

| File FE | Gọi API nào | Cách gắn token |
|---------|-------------|----------------|
| `lib/api.js:16-23` | Tất cả qua `api` axios instance | Interceptor tự gắn `Bearer ${localStorage.hdnd_token}` |
| `components/UploadOcr.jsx:38-41` | `POST /resolutions/upload-ocr` (FormData `file` + override) | `authFileHeaders()` |
| `components/IndicatorTree.jsx` | `POST /indicators/tree` | qua `api.post` |
| `components/ApproveAssign.jsx` | `PUT /indicators/:id/approve` | qua `api.put` |
| `components/ReportForm.jsx` | `POST /reports` (FormData `evidence`) | FormData + token |
| `components/ReviewForm.jsx` | `POST /reviews` | JSON |
| `components/Dashboard.jsx` | `GET /indicators?resolutionId=` + state local | Hiển thị `alertLevel` |
| `lib/firebase.js` | Login email/pass → `getIdToken()` → `setToken()` | `App.jsx:55-73` |

---

## 9. Lỗi thường gặp

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `Thiếu biến môi trường FIREBASE_...` | Chưa tạo `.env` | `Copy-Item .env.example .env` + điền đủ 4 biến |
| `Failed to parse private key` | Copy key sai / mất `\n` | Giữ `"-----BEGIN...-----...-----END...-----\n"`, không xuống dòng thật |
| `401 Token không hợp lệ` | Quên header / token hết hạn | Gắn `Authorization: Bearer <idToken>`, login lại |
| `403 chưa được gán vai trò` | Chưa chạy `setRole.js` | Chạy script + đăng nhập lại để token mới có claim |
| `403 Vai trò 'x' không có quyền` | Dùng sai role cho API | Đổi token đúng role ở bảng mục 4 |
| `PERMISSION_DENIED Vision` | Chưa Enable Vision / thiếu IAM | Enable Vision + thêm role Vision cho service account |
| `OCR không trích xuất được` | File mờ/scan lệch, text <10 ký tự | Upload PDF rõ nét; BE vẫn tạo draft để nhập tay |
| `Chỉ chấp nhận file PDF, PNG, JPG` | Sai MIME | Chỉ gửi PDF/PNG/JPG, field phải tên `file` (reports là `evidence`) |
| `Failed to load pdf-parse` | pdf-parse trên Windows | `npm install pdf-parse@1.1.1`, thử file khác |
| CORS | Sai `CLIENT_URL` | `.env`: `CLIENT_URL=http://localhost:3000` + restart |
| Port 5000 bận | App khác chiếm | Đổi `PORT=5001` |
| Cron không chạy | Server tắt / sai cron | Server phải chạy liên tục; test bằng `*/1 * * * *` (mỗi phút) rồi restart |

---

## 10. Checklist chạy được

- [ ] `node -v >= 18`, `npm install` BE + FE không lỗi
- [ ] Firebase có Auth (4 user) + Firestore + Storage + Vision Enabled
- [ ] `.env` BE đủ 4 biến Firebase, `npm run dev` thấy `Listening on :5000`
- [ ] `GET /health` trả `ok:true`
- [ ] `node setRole.js` + login lại (token mới có role)
- [ ] `POST /resolutions/upload-ocr` (chuyen_vien) → `201`, Storage có file, Firestore có `draft`
- [ ] Kiểm tra `ocrEngine` (`pdf-parse` cho PDF text, `vision` cho scan) + 4 trường `codeNumber/title/issuanceDate/signer`
- [ ] `POST /indicators/tree` → NQ thành `pending_approval`
- [ ] `PUT /indicators/:id/approve` (thuong_truc) → `assigned`
- [ ] `POST /reports` (co_quan_thuc_hien) → `submitted` + `evidenceFileUrl` nếu kèm file
- [ ] `POST /reviews` (ban_hdnd) → `approved/rejected`
- [ ] Cron cập nhật `alertLevel` (test bằng cron mỗi phút)
- [ ] FE `http://localhost:3000` login 4 tài khoản, đi hết 6 màn hình

---

*File này được tổng hợp từ source thực tế: `ocrService.js`, `resolutionController.js`, `indicatorController.js`, `reportReviewController.js`, `auth.js`, `rbac.js`, `routes/index.js`, `storageService.js`, `deadlineMonitor.js`, `firestore.rules`, `firestoreSchemas.ts`, `HUONG-DAN-CHAY.md`. Khi sửa regex OCR, nhớ test lại bằng script `debug-ocr.js` ở mục 6.6 trước khi deploy.*
