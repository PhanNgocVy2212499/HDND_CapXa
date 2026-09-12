# HƯỚNG DẪN CHẠY DỰ ÁN — Quy trình 1: Quản lý Nghị quyết HĐND cấp xã

> Backend: Node.js (Express) + Firebase Admin SDK | DB: Firestore | Storage: Firebase Storage | OCR: pdf-parse + Google Cloud Vision

## 0. Cấu trúc thư mục

```
D:\HK5\TTNN
├── backend/               # Toàn bộ Backend (Express + Firebase Admin)
│   ├── src/               # server.js, config, controllers, routes, services, jobs, middleware, types
│   ├── public/            # Trang web tĩnh dự phòng ở http://localhost:5000
│   ├── package.json       # Dependencies backend (npm install trong này)
│   ├── .env               # Khóa Firebase THẬT (không commit git)
│   ├── .env.example       # Mẫu biến môi trường
│   ├── firestore.rules    # Rules phân quyền Firestore
│   └── setRole.js         # Script gán vai trò nhanh: node setRole.js
├── frontend/              # Giao diện React (Vite + Tailwind, cổng 3000)
├── frontend-example/      # File mẫu cũ, tham khảo
└── HUONG-DAN-CHAY.md      # File này
```

> Quy ước: lệnh backend chạy trong `D:\HK5\TTNN\backend`, lệnh frontend chạy trong `D:\HK5\TTNN\frontend`.

---

## 1. Những thứ cần chuẩn bị

| # | Thứ cần có | Để làm gì | Lấy ở đâu |
|---|-----------|-----------|-----------|
| 1 | **Node.js >= 18** + npm | Chạy backend | https://nodejs.org — kiểm tra: `node -v`, `npm -v` |
| 2 | **Tài khoản Google** + 1 **Firebase Project** | Chứa Auth / Firestore / Storage | https://console.firebase.google.com → Add project (VD: `hdnd-xa-demo`) |
| 3 | **Service Account Key** (Admin SDK) | Backend xác thực với Firebase | Firebase Console → Project settings → Service accounts → Generate new private key |
| 4 | **Firebase Storage Bucket** | Lưu PDF Nghị quyết + file minh chứng | Firebase Console → Storage → Get started (nhớ tên bucket `xxx.appspot.com`) |
| 5 | **Cloud Vision API** (bật) | OCR file scan/ảnh | Google Cloud Console → chọn đúng project → APIs & Services → Enable **Cloud Vision API** |
| 6 | **Tool test API**: Postman / Thunder Client / curl | Lấy ID Token + gọi API | https://www.postman.com/downloads |
| 7 | (Tùy chọn) **Tài khoản test** các vai trò | Test phân quyền RBAC | Tạo trong Firebase Console → Authentication → Users |

### Vai trò (Custom Claims `role`) dùng trong dự án

| Role | Quyền |
|------|-------|
| `chuyen_vien` | `POST /api/resolutions/upload-ocr`, `POST /api/indicators/tree` |
| `thuong_truc` | `PUT /api/indicators/:id/approve`, `POST /api/reviews`, dựng cây |
| `co_quan_thuc_hien` | `POST /api/reports` |
| `ban_hdnd` | `POST /api/reviews` |

---

## 2. Setup Firebase Console (làm 1 lần, ~10 phút)

### 2.1. Authentication
1. Firebase Console → **Build → Authentication → Get started**.
2. Tab **Sign-in method** → bật **Email/Password**.
3. Tab **Users → Add user**: tạo 4 tài khoản test, ví dụ:
   - `chuyenvien@xa.gov.vn / 123456`
   - `thuongtruc@xa.gov.vn / 123456`
   - `ubnd@xa.gov.vn / 123456`
   - `banhdnd@xa.gov.vn / 123456`
4. Ghi lại **UID** của từng user (cột User UID) — dùng ở bước 4.

### 2.2. Firestore Database
1. **Build → Firestore Database → Create database** → chế độ **Production mode** → chọn region gần nhất (`asia-southeast1`).
2. Deploy rules phân quyền của dự án:
   ```powershell
   # Cách nhanh (copy nội dung file firestore.rules trong source lên Console):
   # Firestore → tab Rules → paste nội dung file firestore.rules → Publish
   ```
   Hoặc dùng Firebase CLI:
   ```powershell
   npm install -g firebase-tools
   firebase login
   firebase init firestore   # chọn project vừa tạo, KHÔNG ghi đè file firestore.rules có sẵn
   firebase deploy --only firestore:rules
   ```

### 2.3. Storage
1. **Build → Storage → Get started** → OK.
2. Tab **Rules** (dev có thể mở thoáng, production siết lại):
   ```
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read: if true;                       // demo nội bộ
         allow write: if request.auth != null;       // chỉ user đăng nhập mới upload
       }
     }
   }
   ```
3. Ghi lại tên bucket, dạng `hdnd-xa-demo.appspot.com`.

### 2.4. Service Account + Vision API
1. **Project settings (bánh răng) → Service accounts → Generate new private key** → tải file `serviceAccountKey.json` (CẤT KỸ, không commit git).
2. Mở file JSON, lấy 3 trường: `project_id`, `client_email`, `private_key`.
3. Google Cloud Console (https://console.cloud.google.com) → đúng project → **APIs & Services → Enable APIs** → tìm **Cloud Vision API → Enable**.
   > Service account mặc định đã có quyền Vision sau khi Enable. Nếu báo `PERMISSION_DENIED`, vào IAM → thêm role **Cloud Vision AI Service Agent** cho `client_email` ở trên.

---

## 3. Cài đặt & chạy Backend

### 3.1. Cài dependencies
```powershell
Set-Location -LiteralPath "D:\HK5\TTNN\backend"
npm install
```

### 3.2. Tạo file `.env`
```powershell
Copy-Item .env.example .env
notepad .env
```
Điền theo mẫu (quan trọng nhất là 4 dòng Firebase):
```env
FIREBASE_PROJECT_ID=hdnd-xa-demo
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc@hdnd-xa-demo.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...XXX...=\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=hdnd-xa-demo.appspot.com
PORT=5000
CLIENT_URL=http://localhost:3000
```
> Lưu ý `FIREBASE_PRIVATE_KEY` phải giữ nguyên `\n` trong chuỗi, giữ dấu `"..."` bao quanh.

### 3.3. Chạy server (trong thư mục backend)
```powershell
Set-Location -LiteralPath "D:\HK5\TTNN\backend"
npm run dev     # dev (nodemon, tự reload)
# hoặc
npm start       # production
```
Thấy log là thành công:
```
[firebaseAdmin] Initialized project: hdnd-xa-demo
[server] Listening on :5000
```
Kiểm tra sức khỏe:
```powershell
Invoke-RestMethod http://localhost:5000/health
# => ok: True, service: hdnd-resolution-manager
```

---

## 4. Gán vai trò (Custom Claims) — BẮT BUỘC trước khi gọi API

API dùng middleware `verifyFirebaseToken + requireRole(...)`, nên user chưa gán `role` sẽ bị `403`.
Chạy 1 lần cho 4 UID đã ghi ở bước 2.1 (thay UID thật vào):

```powershell
Set-Location -LiteralPath "D:\HK5\TTNN\backend"
node -e "
require('dotenv').config();
const { auth } = require('./src/config/firebaseAdmin');
(async () => {
  await auth.setCustomUserClaims('UID_CHUYEN_VIEN', { role: 'chuyen_vien', departmentId: 'hdnd' });
  await auth.setCustomUserClaims('UID_THUONG_TRUC', { role: 'thuong_truc', departmentId: 'thuong-truc' });
  await auth.setCustomUserClaims('UID_UBND', { role: 'co_quan_thuc_hien', departmentId: 'ubnd-xa' });
  await auth.setCustomUserClaims('UID_BAN', { role: 'ban_hdnd', departmentId: 'ban-kinh-te' });
  console.log('OK - da gan role');
  process.exit(0);
})();
"
```
> Sau khi gán role, **đăng xuất + đăng nhập lại** trên client để ID Token mới chứa claim.

### Lấy ID Token để test (không có Frontend vẫn test được)
Cách nhanh nhất — dùng Firebase Client SDK 1 lệnh (thay `apiKey` + email/pass):
```powershell
# PowerShell: gọi trực tiếp REST API của Firebase Auth
$apiKey = "<WEB_API_KEY: Project settings -> General -> Web API Key>"
$body = @{ email="chuyenvien@xa.gov.vn"; password="123456"; returnSecureToken=$true } | ConvertTo-Json
$res = Invoke-RestMethod "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey" -Method Post -Body $body -ContentType "application/json"
$res.idToken   # <-- copy token này gắn vào header Authorization: Bearer <token>
```

---

## 5. Test từng API (đúng thứ tự nghiệp vụ)

Đặt biến dùng chung trong Postman:
- `BASE = http://localhost:5000/api`
- Header mọi request: `Authorization: Bearer <idToken của role tương ứng>`

### 5.1. Upload + OCR (role `chuyen_vien`)
```
POST {{BASE}}/resolutions/upload-ocr
Body: form-data | key=file (Type=File) → chọn 1 PDF Nghị quyết
```
- Thành công `201` → trả `data: { id, codeNumber, title, signer, issuanceDate, fileUrl, ... }`.
- Ghi lại `resolutionId = data.id` để dùng cho bước 5.2.
- Kiểm tra: Firebase Console → Storage thấy file `resolutions/2026/...pdf`; Firestore → collection `resolutions` có document `status=draft`.

### 5.2. Dựng Cây chỉ tiêu (role `chuyen_vien`)
```
POST {{BASE}}/indicators/tree
Content-Type: application/json
{
  "resolutionId": "<dán resolutionId ở trên>",
  "tree": [
    {
      "title": "Tỷ lệ hộ nghèo giảm còn dưới 2%",
      "targetValue": 2, "unit": "%",
      "frequency": "quarterly",
      "deadline": "2026-12-31",
      "assignedDepartments": [{ "departmentId": "ubnd-xa", "role": "primary" }],
      "children": [
        { "title": "Hỗ trợ sinh kế 50 hộ", "targetValue": 50, "unit": "hộ",
          "frequency": "monthly", "deadline": "2026-09-30" }
      ]
    }
  ]
}
```
- Xong thì Nghị quyết chuyển sang `pending_approval`. Ghi lại 1 `indicatorId` (vào Firestore → `indicators` copy ID).

### 5.3. Phê duyệt & giao việc (role `thuong_truc`)
```
PUT {{BASE}}/indicators/<indicatorId>/approve
Content-Type: application/json
{
  "deadline": "2026-12-31",
  "assignedDepartments": [
    { "departmentId": "ubnd-xa", "departmentName": "UBND xã", "role": "primary" },
    { "departmentId": "tai-chinh", "departmentName": "Công chức Tài chính", "role": "cooperate" }
  ]
}
```

### 5.4. Báo cáo tiến độ (role `co_quan_thuc_hien`)
```
POST {{BASE}}/reports
Body: form-data
  indicatorId: <indicatorId>
  actualValue: 1.5
  progressPercentage: 70
  remarks: Đã hỗ trợ 35/50 hộ
  evidence: (Type=File, tùy chọn) file minh chứng
```

### 5.5. Thẩm tra (role `ban_hdnd` hoặc `thuong_truc`)
```
POST {{BASE}}/reviews
Content-Type: application/json
{
  "progressReportId": "<reportId ở bước 5.4>",
  "status": "passed",              // hoặc "need_clarification"
  "comment": "Số liệu khớp minh chứng. Đồng ý."
}
```

### 5.6. Cron cảnh báo deadline
- Tự chạy lúc **01:00 mỗi đêm** khi server đang chạy (`deadlineMonitor.js`).
- Muốn test ngay: đổi tạm trong code `cron.schedule('0 1 * * *', ...)` thành `cron.schedule('*/1 * * * *', ...)` (mỗi phút) → restart → xem field `alertLevel` (`green/yellow/red`) trong collection `indicators`.

---

## 6. Chạy Frontend React (Tailwind + Dark mode)

Giao diện React hoàn chỉnh nằm ở `frontend/` (Vite + Tailwind CSS + lucide-react + framer-motion),
gồm 6 màn hình: Tổng quan (dashboard + cảnh báo đỏ/vàng) → Upload & OCR → Cây chỉ tiêu →
Phê duyệt → Báo cáo → Thẩm tra (khung chat).

```powershell
# Terminal 1 — backend (cổng 5000)
Set-Location "D:\HK5\TTNN\backend"
npm run dev

# Terminal 2 — frontend (cổng 3000)
Set-Location "D:\HK5\TTNN\frontend"
npm install        # chỉ cần lần đầu
npm run dev        # mở http://localhost:3000
```
- File `frontend/.env` đã trỏ sẵn `VITE_API_URL=http://localhost:5000/api`.
- Đăng nhập bằng **email + mật khẩu** (4 tài khoản tạo ở bước 2.1) — không cần dán token thủ công nữa.
  Trước đó điền 6 dòng `VITE_FIREBASE_*` trong `frontend/.env`: lấy ở Firebase Console →
  Project settings → General → Your apps → Web app (nút `</>`) → khối `firebaseConfig`.
  Xong restart `npm run dev` ở frontend.
- `.env` backend giữ `CLIENT_URL=http://localhost:3000` để khỏi lỗi CORS.
- Token dán 1 lần ở nút token trên header (nhớ đúng vai trò từng bước).
- Nút mặt trời/mặt trăng góc phải header để bật/tắt Dark mode.

Luồng màn hình Upload & OCR: kéo thả file (preview bên trái) → bấm **Upload & OCR** →
form bên phải tự điền `codeNumber/title/signer/issuanceDate` → sửa tay nếu OCR sai →
sang tab Cây chỉ tiêu (resolutionId tự chuyển qua).

---

## 7. Lỗi thường gặp & cách fix

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `Thiếu biến môi trường FIREBASE_...` | Chưa tạo `.env` | `Copy-Item .env.example .env` rồi điền đủ 4 biến |
| `Failed to parse private key` | Copy key sai / mất `\n` | Giữ nguyên `"-----BEGIN...-----...-----END...-----\n"`, không xuống dòng thật trong file |
| `401 Token không hợp lệ` | Quên header / token hết hạn | Gắn `Authorization: Bearer <idToken>`, login lại để lấy token mới |
| `403 ... chưa được gán vai trò` | Chưa chạy bước 4 | Chạy script `setCustomUserClaims`, rồi đăng nhập lại |
| `PERMISSION_DENIED Vision API` | Chưa Enable Vision / thiếu IAM | Enable Cloud Vision API + thêm role Vision cho service account |
| `OCR không trích xuất được` | File mờ / scan lệch | Upload PDF rõ nét; vẫn tạo draft để nhập tay |
| `Failed to load pdf-parse` / lỗi font | pdf-parse trên Windows | `npm install pdf-parse@1.1.1`, thử file PDF khác |
| CORS khi gọi từ React | Sai `CLIENT_URL` | `.env`: `CLIENT_URL=http://localhost:3000` (hoặc port Vite `5173`) rồi restart |
| Port 5000 đã dùng | App khác chiếm port | Đổi `PORT=5001` trong `.env` |

---

## 8. Checklist "chạy được" (tích từng dòng)

- [ ] `node -v >= 18`, `npm install` không lỗi
- [ ] Firebase có Auth (4 user) + Firestore + Storage + Vision API đã Enable
- [ ] `.env` điền đủ, `npm run dev` thấy `Listening on :5000`
- [ ] `GET /health` trả `ok: true`
- [ ] Đã gán Custom Claims 4 role + login lại
- [ ] `POST /resolutions/upload-ocr` → `201`, thấy file trên Storage + doc `draft` trên Firestore
- [ ] `POST /indicators/tree` → NQ chuyển `pending_approval`
- [ ] `PUT /indicators/:id/approve` → `assigned`
- [ ] `POST /reports` → `submitted` + có `evidenceFileUrl` (nếu kèm file)
- [ ] `POST /reviews` → báo cáo chuyển `approved/rejected`
- [ ] Cron cập nhật `alertLevel` trên `indicators`

Chúc chạy một phát ăn ngay. Nếu kẹt, đọc log terminal của `npm run dev` trước — 90% lỗi nằm ở `.env` và Custom Claims.
