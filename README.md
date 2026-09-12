# HỆ THỐNG HĐND SỐ CẤP XÃ — Quản lý & Theo dõi thực hiện Nghị quyết

## 1. Mô tả dự án

Hệ thống số hóa toàn bộ vòng đời **Nghị quyết HĐND cấp xã**: từ **ban hành → bóc tách chỉ tiêu → phê duyệt & giao việc → báo cáo tiến độ → thẩm tra → cảnh báo deadline**, trên một **Cơ sở dữ liệu dùng chung** duy nhất.

**Vấn đề giải quyết:** trước đây nghị quyết nằm trong file PDF rời rạc, chỉ tiêu chép tay qua Excel, báo cáo gửi Zalo/giấy, không ai biết việc tới đâu, quá hạn không cảnh báo, không truy vết được ai làm gì.

**Cách hệ thống giải quyết:**

- **Upload + OCR tự động:** chuyên viên tải PDF nghị quyết, hệ thống tự trích `số hiệu / trích yếu / ngày ban hành / người ký` (PDF chữ dùng `pdf-parse`, bản scan/ảnh dùng Google Cloud Vision), sinh bản nháp `draft` kèm văn bản nguồn.
- **Cây chỉ tiêu phân cấp:** bóc 1 nghị quyết thành nhiều nhóm mục tiêu → chỉ tiêu con, mỗi chỉ tiêu có `con số kế hoạch, đơn vị, chu kỳ báo cáo, deadline, đơn vị chủ trì/phối hợp`.
- **Phê duyệt & giao việc:** Thường trực HĐND chốt deadline, ấn định đơn vị chịu trách nhiệm.
- **Báo cáo bắt buộc kèm minh chứng:** đơn vị thực hiện gửi số liệu + file minh chứng (thiếu file bị từ chối `400` — bảo đảm pháp lý).
- **Thẩm tra 2 chiều:** các Ban HĐND đối chiếu số liệu với minh chứng, kết luận `passed` (công nhận) hoặc `need_clarification` (trả về làm lại).
- **CSDL dùng chung + Audit Log:** mọi nghị quyết/chỉ tiêu/báo cáo/thẩm tra liên kết qua `resolutionId`, denormalize `resolutionCodeNumber/indicatorTitle` để đọc 1 lần không cần join; mọi thao tác ghi sinh 1 dòng `auditLogs` append-only (ai, làm gì, trước/sau, văn bản nguồn, timestamp) — xem chi tiết ở `CSDL-DUNG-CHUNG-HDND.md`.
- **Cảnh báo deadline tự động:** cron 01:00 đêm gắn cờ `green / yellow (≤7 ngày) / red (quá hạn)`.

**Trọng tâm CSDL dùng chung:** tích hợp toàn bộ thông tin phát sinh từ ban hành Nghị quyết, Giám sát, Kiến nghị và Kỳ họp theo nguyên tắc _"sản sinh dữ liệu một lần, chia sẻ sử dụng nhiều lần"_, tự động đóng dấu thời gian, lưu vết lịch sử thay đổi và bắt buộc đính kèm văn bản nguồn với 100% dữ liệu cập nhật — bảo đảm công khai, minh bạch, pháp lý.

### Cấu trúc thư mục

```
D:\HK5\TTNN
├── backend/                  # Express + Firebase Admin (cổng 5000)
│   ├── src/
│   │   ├── server.js         # Entry point, CORS, /health, /api, cron
│   │   ├── config/firebaseAdmin.js
│   │   ├── middleware/auth.js | rbac.js | upload.js
│   │   ├── services/ocrService.js | storageService.js | auditService.js
│   │   ├── controllers/resolutionController.js | indicatorController.js
│   │   │               | reportReviewController.js | auditController.js
│   │   ├── jobs/deadlineMonitor.js
│   │   ├── routes/index.js
│   │   └── types/firestoreSchemas.ts
│   ├── firestore.rules
│   ├── setRole.js            # Gán vai trò nhanh
│   ├── .env / .env.example
│   └── package.json
├── frontend/                 # React + Vite + Tailwind (cổng 3000)
│   └── src/
│       ├── lib/api.js | firebase.js | meta.js
│       └── components/UploadOcr | IndicatorTree | ApproveAssign
│                     | ReportForm | ReviewForm | Dashboard | Layout | Login
├── HUONG-DAN-CHAY.md
├── HUONG-DAN-CHI-TIET-LUONG-ROLE-OCR.md
├── CSDL-DUNG-CHUNG-HDND.md
└── README.md                 # File này
```

## 2. Công nghệ sử dụng

### Backend (`backend/package.json`)

| Công nghệ            | Phiên bản    | Dùng để làm gì                                               |
| -------------------- | ------------ | ------------------------------------------------------------ |
| Node.js              | >= 18        | Môi trường chạy                                              |
| Express              | ^4.19.2      | REST API (`/api/*`), CORS, JSON                              |
| firebase-admin       | ^12.3.0      | Auth (verify ID Token), Firestore (DB), Storage (lưu file)   |
| @google-cloud/vision | ^4.0.0       | OCR bản scan/ảnh (`documentTextDetection`)                   |
| pdf-parse            | ^1.1.1       | OCR PDF chữ (nhanh, miễn phí, offline)                       |
| multer               | ^1.4.5-lts.1 | Nhận file upload (RAM, giới hạn 20MB, lọc PDF/PNG/JPG)       |
| node-cron            | ^3.0.3       | Cron 01:00 quét deadline → `alertLevel`                      |
| dotenv               | ^16.4.5      | Đọc `.env`                                                   |
| cors                 | ^2.8.5       | Cho phép frontend `:3000` gọi backend `:5000`                |
| uuid                 | ^9.0.1       | Tên file duy nhất trên Storage                               |
| dayjs, axios         | —            | Xử lý ngày tháng, gọi HTTP                                   |
| cloudinary           | ^2.11.0      | Tùy chọn lưu file qua Cloudinary (`STORAGE_MODE=cloudinary`) |
| nodemon, typescript  | dev          | Reload khi code + types Firestore                            |

### Frontend (`frontend/package.json`)

| Công nghệ                          | Phiên bản | Dùng để làm gì                            |
| ---------------------------------- | --------- | ----------------------------------------- |
| React + React DOM                  | ^19.2.8   | UI 6 màn hình luồng nghiệp vụ             |
| Vite (+ plugin-react)              | ^8.2.2    | Dev server `:3000`, build production      |
| Tailwind CSS (+ @tailwindcss/vite) | ^4.3.3    | Styling + dark mode                       |
| firebase (client SDK)              | ^12.18.0  | Đăng nhập email/pass, lấy ID Token        |
| axios                              | ^1.20.0   | Gọi API (tự gắn `Bearer` qua interceptor) |
| framer-motion                      | ^13.2.0   | Animation chuyển màn, list                |
| lucide-react                       | ^1.42.0   | Icon                                      |
| dayjs                              | ^1.11.23  | Định dạng ngày                            |

### Nền tảng dữ liệu & hạ tầng

- **Firebase Authentication** — đăng nhập email/pass, phân quyền bằng Custom Claims `{ role, departmentId }`.
- **Cloud Firestore** — 5 collections: `resolutions`, `indicators`, `progressReports`, `reviews`, `auditLogs` (xem `backend/src/types/firestoreSchemas.ts`).
- **Firebase Storage** — lưu PDF nghị quyết (`resolutions/2026/...`) + minh chứng (`evidences/<indicatorId>/...`); 2 chế độ phụ `local` / `cloudinary` qua `STORAGE_MODE`.
- **Google Cloud Vision API** — OCR ảnh/scan (cần Enable API + quyền cho service account).

## 3. Cài đặt & chạy

### 3.1. Yêu cầu trước

- Node.js >= 18 (`node -v`, `npm -v`).
- 1 Firebase Project (VD `hdnd-xa-demo`) đã bật **Authentication (Email/Password)**, **Firestore**, **Storage**, **Cloud Vision API**.
- Service Account Key: Project settings → Service accounts → Generate new private key → giữ `project_id`, `client_email`, `private_key`.

### 3.2. Setup Firebase Console (làm 1 lần)

1. **Auth:** bật `Email/Password`, tạo 4 user test (mục 4).
2. **Firestore:** Create database (Production, `asia-southeast1`) → tab Rules → paste toàn bộ `backend/firestore.rules` → Publish (đã gồm `auditLogs` + bắt `evidenceFileUrl`).
3. **Storage:** Get started, ghi lại tên bucket `xxx.appspot.com`.
4. **Vision:** Google Cloud Console → đúng project → Enable **Cloud Vision API** (lỗi `PERMISSION_DENIED` thì vào IAM thêm role `Cloud Vision AI Service Agent` cho `client_email`).

### 3.3. Chạy Backend (cổng 5000)

```powershell
Set-Location "D:\HK5\TTNN\backend"
npm install
Copy-Item .env.example .env
notepad .env   # điền 4 biến Firebase + PORT/CLIENT_URL/STORAGE_MODE
npm run dev    # dev (nodemon) | npm start (production)
Invoke-RestMethod http://localhost:5000/health  # => ok: True
```

Mẫu `.env`:

```env
FIREBASE_PROJECT_ID=hdnd-xa-demo
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@hdnd-xa-demo.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=hdnd-xa-demo.appspot.com
PORT=5000
CLIENT_URL=http://localhost:3000
STORAGE_MODE=firebase
```

### 3.4. Gán vai trò — BẮT BUỘC (nếu không mọi API báo 403)

Sửa UID thật trong `backend/setRole.js` (lấy ở Authentication → Users → User UID) rồi:

```powershell
Set-Location "D:\HK5\TTNN\backend"
node setRole.js
```

Sau đó **đăng xuất + đăng nhập lại** để token mới chứa claim `role`.

### 3.5. Chạy Frontend (cổng 3000)

```powershell
Set-Location "D:\HK5\TTNN\frontend"
npm install
notepad .env   # VITE_API_URL + 6 dòng VITE_FIREBASE_* (Project settings → Your apps → Web app)
npm run dev    # mở http://localhost:3000
```

```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3.6. Lấy ID Token để test API không cần UI

```powershell
$apiKey = "<Web API Key>"
$body = @{ email="chuyenvien@xa.gov.vn"; password="123456"; returnSecureToken=$true } | ConvertTo-Json
(Invoke-RestMethod "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" -Method Post -Body $body -ContentType "application/json").idToken
# Gắn header mọi request: Authorization: Bearer <idToken>
```

## 4. Tài khoản kiểm thử & quy trình theo từng cấp bậc

Tạo 4 tài khoản trong Firebase Authentication (mật khẩu `123456`), gán quyền bằng `node setRole.js`:

| #   | Tài khoản              | Vai trò (`role`)                  | Đơn vị (`departmentId`) | Được làm gì                                   |
| --- | ---------------------- | --------------------------------- | ----------------------- | --------------------------------------------- |
| 1   | `chuyenvien@xa.gov.vn` | `chuyen_vien` (Chuyên viên HĐND)  | `hdnd`                  | Upload + OCR, dựng cây chỉ tiêu               |
| 2   | `thuongtruc@xa.gov.vn` | `thuong_truc` (Thường trực HĐND)  | `thuong-truc`           | Dựng cây, **phê duyệt & giao việc**, thẩm tra |
| 3   | `ubnd@xa.gov.vn`       | `co_quan_thuc_hien` (UBND/đơn vị) | `ubnd-xa`               | **Báo cáo tiến độ** kèm minh chứng            |
| 4   | `banhdnd@xa.gov.vn`    | `ban_hdnd` (Ban HĐND)             | `ban-kinh-te`           | **Thẩm tra** báo cáo                          |

> Sai role gọi API sẽ bị `403`; quên token/hết hạn bị `401`. Đổi vai trò thì đăng xuất → đăng nhập lại (không mở 2 tab 2 tài khoản song song vì Firebase dùng chung localStorage sẽ đá nhau).

### Giai đoạn 1 — Upload & OCR (Chuyên viên)

- Đăng nhập TK 1 → màn **Upload & OCR** → kéo thả PDF → **Upload & OCR** → form tự điền `codeNumber/title/signer/issuanceDate` → sửa tay nếu sai.
- API: `POST /api/resolutions/upload-ocr` (form-data `file`) → `201 { id (resolutionId), codeNumber, fileUrl, ... }`, tạo `resolutions/{id}` trạng thái `draft` + 1 dòng `auditLogs(create_resolution)` kèm văn bản nguồn.
- Kiểm tra: Storage có `resolutions/2026/*.pdf`, Firestore có doc `draft`.

### Giai đoạn 2 — Dựng cây chỉ tiêu (Chuyên viên)

- Sang màn **Cây chỉ tiêu** (PDF gốc nằm bên trái để vừa nhìn vừa nhập, chỉ tiêu con tự thụt 1 nấc + nhãn `Cấp 2/3`) → **+ Thêm chỉ tiêu** → nhập tên/con số/đơn vị/chu kỳ/deadline/phòng ban → **Lưu & trình duyệt**.
- API: `POST /api/indicators/tree` `{ resolutionId, tree: [...] }` → NQ chuyển `pending_approval` + audit `upsert_tree`.
- Ghi lại 1 `indicatorId` (Firestore → `indicators`).

### Giai đoạn 3 — Phê duyệt & giao việc (Thường trực)

- Đăng nhập TK 2 → màn **Phê duyệt** → dropdown **Nghị quyết cần duyệt** (lấy từ server nên khác máy/tab vẫn thấy) → **Tải danh sách** → chốt deadline + đơn vị chủ trì/phối hợp → **Duyệt / Duyệt tất cả**.
- API: `PUT /api/indicators/:id/approve` → chỉ tiêu thành `assigned` + audit `approve_indicator` (lưu before/after).
- Kiểm tra: `GET /api/indicators?resolutionId=...`.

### Giai đoạn 4 — Báo cáo tiến độ (Đơn vị thực hiện)

- Đăng nhập TK 3 → màn **Báo cáo** → chọn chỉ tiêu → nhập số liệu thực tế, % hoàn thành, kỳ (`2026-Q3`), ghi chú → **bắt buộc đính kèm file minh chứng** → **Gửi báo cáo** (thiếu file bị `400`).
- API: `POST /api/reports` (form-data `indicatorId, actualValue, progressPercentage, remarks, evidence`) → tạo `progressReports/{id}` `submitted`, indicator thành `in_progress` + audit `submit_report`.
- Kiểm tra: `GET /api/reports?resolutionId=...`.

### Giai đoạn 5 — Thẩm tra (Ban HĐND / Thường trực)

- Đăng nhập TK 4 → màn **Thẩm tra** → dropdown chọn báo cáo (hiện trạng thái `Chờ thẩm tra/Đã duyệt/Cần làm lại`, số liệu, file minh chứng) → kết luận `passed` hoặc `need_clarification` + nhận xét bắt buộc → **Gửi thẩm tra**.
- API: `POST /api/reviews` → tạo `reviews/{id}`, báo cáo thành `approved`/`rejected` + audit `submit_review`; xem lại ở `GET /api/reviews?progressReportId=...`.
- Lặp `Báo cáo → Thẩm tra` theo từng kỳ tới khi 100%.

### Giai đoạn 6 — Tổng quan & giám sát (mọi vai trò)

- Màn **Tổng quan**: pipeline 5 bước, % hoàn thành trung bình, cảnh báo deadline đỏ (quá hạn) / vàng (≤7 ngày) — logic đồng bộ cron backend chạy 01:00 đêm (`jobs/deadlineMonitor.js`, `red` tự chuyển `overdue`).
- Truy vết toàn trình: `GET /api/audit-logs?resolutionId=<idNQ>` trả đủ chuỗi `create_resolution → upsert_tree → approve → report → review` kèm actor + timestamp + văn bản nguồn.

## 5. Báo cáo đồ án — những gì đã đạt được

1. **Hoàn thành vòng đời nghị quyết khép kín trên 1 CSDL dùng chung:** upload OCR → cây chỉ tiêu phân cấp → phê duyệt/giao việc → báo cáo bắt buộc minh chứng → thẩm tra 2 chiều → dashboard + cảnh báo deadline; dữ liệu liên thông `resolutions → indicators → progressReports → reviews → auditLogs` qua `resolutionId`, không còn Excel/Zalo rời rạc.
2. **OCR văn bản hành chính tiếng Việt chạy được 2 chế độ:** `pdf-parse` cho PDF chữ (nhanh, miễn phí) và Cloud Vision `documentTextDetection` cho bản scan/ảnh, regex tách `số hiệu / trích yếu / ngày / người ký` có fallback + cho sửa tay, giữ `ocrRawText` để đối soát.
3. **Phân quyền RBAC 4 cấp bậc enforced 3 lớp:** Custom Claims (`auth` + `setRole.js`) → middleware `verifyFirebaseToken + requireRole` từng route → `firestore.rules` (cấm xóa toàn hệ thống, bắt `evidenceFileUrl`, `auditLogs` append-only).
4. **Tính pháp lý & minh bạch của CSDL:** timestamp server-side mọi bản ghi, audit log tự động 5/5 API ghi (kèm actor/before-after/văn bản nguồn, không làm sập request chính), báo cáo thiếu minh chứng bị từ chối ở cả 3 tầng (FE, API `400`, rules) — đúng yêu cầu _"sản sinh một lần, dùng nhiều lần; công khai, minh bạch, pháp lý"_.
5. **Khả năng dùng chéo máy/tab/role:** dropdown chọn NQ/báo cáo tải từ server, tự tải lại sau F5, blob preview xem ngay không phụ thuộc Storage public, `localStorage` giữ phiên làm việc; cron deadline + API tra cứu (`/resolutions`, `/indicators`, `/reports`, `/reviews`, `/audit-logs`) phục vụ giám sát liên tục.
6. **Kiểm chứng được:** `GET /health` OK, build FE pass, boot-test đủ 10 endpoint + 401 khi thiếu token, checklist chạy được từng giai đoạn theo đúng 4 tài khoản test ở mục 4.

**Hướng phát triển:** mở rộng CSDL dùng chung sang Giám sát, Kiến nghị cử tri, Kỳ họp; gợi ý chỉ tiêu tự động bằng LLM từ `ocrRawText`; ký số + eKYC; thông báo FCM/Email khi `red/yellow`; phân trang + tìm kiếm toàn văn NQ.
