# BÁO CÁO MỤC TIÊU VÀ TIẾN ĐỘ — HỆ THỐNG HĐND SỐ CẤP XÃ

> Quản lý & Theo dõi thực hiện Nghị quyết HĐND cấp xã
> Tổng hợp từ: `README.md`, `HUONG-DAN-CHAY.md`, `HUONG-DAN-CHI-TIET-LUONG-ROLE-OCR.md`, `CSDL-DUNG-CHUNG-HDND.md`
> Ngày lập: 01/10/2026

---

## 1. Mục tiêu dự án

### 1.1. Vấn đề cần giải quyết

- Nghị quyết nằm trong file PDF rời rạc, chỉ tiêu chép tay qua Excel.
- Báo cáo gửi qua Zalo/giấy, không theo dõi được tiến độ, quá hạn không cảnh báo.
- Không truy vết được ai làm gì, thiếu tính pháp lý và minh bạch.

### 1.2. Mục tiêu tổng quát

Số hóa toàn bộ vòng đời **Nghị quyết HĐND cấp xã** trên **một Cơ sở dữ liệu (CSDL) dùng chung duy nhất**:
`ban hành → bóc tách chỉ tiêu → phê duyệt & giao việc → báo cáo tiến độ → thẩm tra → cảnh báo deadline`.

### 1.3. Mục tiêu cụ thể

1. **Upload + OCR tự động:** tải PDF nghị quyết, tự trích `số hiệu / trích yếu / ngày ban hành / người ký` (PDF chữ dùng `pdf-parse`, bản scan/ảnh dùng Google Cloud Vision), sinh bản nháp `draft` kèm văn bản nguồn.
2. **Cây chỉ tiêu phân cấp:** bóc 1 nghị quyết thành nhiều nhóm mục tiêu → chỉ tiêu con, mỗi chỉ tiêu có `con số kế hoạch, đơn vị, chu kỳ báo cáo, deadline, đơn vị chủ trì/phối hợp`.
3. **Phê duyệt & giao việc:** Thường trực HĐND chốt deadline, ấn định đơn vị chịu trách nhiệm.
4. **Báo cáo bắt buộc kèm minh chứng:** đơn vị thực hiện gửi số liệu + file minh chứng (thiếu file bị từ chối `400`).
5. **Thẩm tra 2 chiều:** các Ban HĐND đối chiếu số liệu với minh chứng, kết luận `passed` hoặc `need_clarification`.
6. **CSDL dùng chung + Audit Log:** mọi dữ liệu liên kết qua `resolutionId`, denormalize để đọc 1 lần không cần join; mọi thao tác ghi sinh 1 dòng `auditLogs` append-only (ai, làm gì, trước/sau, văn bản nguồn, timestamp).
7. **Cảnh báo deadline tự động:** cron 01:00 đêm gắn cờ `green / yellow (≤7 ngày) / red (quá hạn)`.
8. **Nguyên tắc CSDL:** _"sản sinh dữ liệu một lần, chia sẻ sử dụng nhiều lần"_, tự động đóng dấu thời gian, lưu vết lịch sử, bắt buộc đính kèm văn bản nguồn với 100% dữ liệu cập nhật — bảo đảm công khai, minh bạch, pháp lý.

---

## 2. Các công việc chính

### 2.1. Luồng nghiệp vụ 6 giai đoạn (end-to-end)

| Bước | Công việc                      | Vai trò thực hiện                 | API tương ứng                                                        | Kết quả DB                                                                                      |
| ---- | ------------------------------ | --------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 0    | Đăng nhập, lấy ID Token        | Tất cả                            | Firebase Auth client                                                 | Token chứa `role`, `departmentId`                                                               |
| 1    | Upload + OCR nghị quyết        | `chuyen_vien` (Chuyên viên HĐND)  | `POST /api/resolutions/upload-ocr` (form-data `file`)                | `resolutions/{id}` trạng thái `draft` + audit `create_resolution`                               |
| 2    | Dựng cây chỉ tiêu phân cấp     | `chuyen_vien` (+ `thuong_truc`)   | `POST /api/indicators/tree`                                          | NQ chuyển `pending_ban_review` + audit `upsert_tree`                                            |
| 3    | Ban HĐND thẩm tra cây chỉ tiêu | `ban_hdnd` (Các Ban HĐND)         | `POST /api/resolutions/:id/ban-review`                               | NQ chuyển `pending_approval` (đồng ý) hoặc `revision_requested` + audit `ban_review_resolution` |
| 4    | Phê duyệt & giao việc          | `thuong_truc` (Thường trực HĐND)  | `PUT /api/indicators/:id/approve`                                    | NQ chuyển `approved`, chỉ tiêu thành `assigned` + audit `approve_indicator`                     |
| 5    | Báo cáo tiến độ kèm minh chứng | `co_quan_thuc_hien` (UBND/đơn vị) | `POST /api/reports` (form-data `evidence`)                           | `progressReports/{id}` `submitted`, indicator thành `in_progress` + audit `submit_report`       |
| 6    | Thẩm tra báo cáo tiến độ       | `ban_hdnd` / `thuong_truc`        | `POST /api/reviews`                                                  | `reviews/{id}`, báo cáo thành `approved`/`rejected` + audit `submit_review`                     |
| 7    | Tổng quan, giám sát & cảnh báo | Mọi vai trò + Cron tự động        | `GET /indicators`, `/reports`, `/reviews`, `/audit-logs`, cron 01:00 | `alertLevel green/yellow/red`, `red` → `overdue`                                                |

### 2.2. Phân quyền RBAC 4 cấp bậc (enforced 3-4 lớp)

| #   | Tài khoản test         | Vai trò             | Đơn vị        | Được làm gì                               |
| --- | ---------------------- | ------------------- | ------------- | ----------------------------------------- |
| 1   | `chuyenvien@xa.gov.vn` | `chuyen_vien`       | `hdnd`        | Upload + OCR, dựng cây chỉ tiêu           |
| 2   | `thuongtruc@xa.gov.vn` | `thuong_truc`       | `thuong-truc` | Dựng cây, phê duyệt & giao việc, thẩm tra |
| 3   | `ubnd@xa.gov.vn`       | `co_quan_thuc_hien` | `ubnd-xa`     | Báo cáo tiến độ kèm minh chứng            |
| 4   | `banhdnd@xa.gov.vn`    | `ban_hdnd`          | `ban-kinh-te` | Thẩm tra báo cáo                          |

Cơ chế kỹ thuật:

- Lớp 1: `middleware/auth.js` — `verifyIdToken` → `req.user` (sai/thiếu token → `401`).
- Lớp 2: `middleware/rbac.js` — `requireRole(...)` (sai role → `403`).
- Lớp 3: `routes/index.js` — gắn role từng API.
- Lớp 4: `firestore.rules` — cấm xóa toàn hệ thống, bắt `evidenceFileUrl`, `auditLogs` append-only.

### 2.3. CSDL dùng chung (5 collections)

```
resolutions/{id} → indicators/{id} → progressReports/{id} → reviews/{id} → auditLogs/{id}
Khóa liên kết dùng chung: resolutionId
Denormalize: resolutionCodeNumber, resolutionFileUrl, indicatorTitle, evidenceFileUrl
```

- `resolutions`: PDF NQ + OCR (`ocrRawText`, `ocrEngine`, `ocrConfidence`).
- `indicators`: cây chỉ tiêu (`parentId` đệ quy, `deadline`, `status`, `alertLevel`, `assignedDepartments`).
- `progressReports`: báo cáo (BẮT BUỘC `evidenceFileUrl`).
- `reviews`: thẩm tra (`passed` / `need_clarification`).
- `auditLogs`: append-only, sinh tự động ở 5/5 API ghi, không làm sập request chính.

### 2.4. Công nghệ sử dụng

- **Backend (cổng 5000):** Node.js >=18, Express ^4.19.2, firebase-admin ^12.3.0, @google-cloud/vision ^4.0.0, pdf-parse ^1.1.1, multer, node-cron, dotenv, cors, uuid, cloudinary (tùy chọn).
- **Frontend (cổng 3000):** React 19 + Vite 8 + Tailwind 4, firebase client SDK, axios, framer-motion, lucide-react, dayjs. Gồm 6 màn hình: Tổng quan → Upload & OCR → Cây chỉ tiêu → Phê duyệt → Báo cáo → Thẩm tra.
- **Hạ tầng:** Firebase Authentication (Custom Claims `{role, departmentId}`), Cloud Firestore, Firebase Storage (`resolutions/2026/...`, `evidences/<indicatorId>/...`, 3 chế độ `firebase/local/cloudinary`), Google Cloud Vision API (`documentTextDetection`).
- **OCR tách trường (`services/ocrService.js`):** chuẩn hóa dòng `normLines` → regex `codeNumber` (Số: 05/2026/NQ-HĐND) → `parseVietnameseDate` (ngày ... tháng ... năm ...) → `title` 3 tầng fallback (Về việc / sau NGHỊ QUYẾT / dòng IN HOA) → `signer` (khối TM. HĐND + CHỦ TỊCH + `looksLikeName` 2-5 từ). Lỗi OCR vẫn tạo `draft` (`engine='none'`), cho sửa tay, giữ `ocrRawText` 20000 ký tự để đối soát.

---

## 3. Công việc đã thực hiện (đạt được)

1. **Hoàn thành vòng đời nghị quyết khép kín trên 1 CSDL dùng chung:** upload OCR → cây chỉ tiêu phân cấp → phê duyệt/giao việc → báo cáo bắt buộc minh chứng → thẩm tra 2 chiều → dashboard + cảnh báo deadline; dữ liệu liên thông `resolutions → indicators → progressReports → reviews → auditLogs` qua `resolutionId`, không còn Excel/Zalo rời rạc.
2. **OCR văn bản hành chính tiếng Việt chạy được 2 chế độ:** `pdf-parse` cho PDF chữ (nhanh, miễn phí, confidence 0.95) và Cloud Vision `documentTextDetection` cho bản scan/ảnh (confidence 0.85), regex tách `số hiệu / trích yếu / ngày / người ký` có fallback + cho sửa tay, giữ `ocrRawText` để đối soát.
3. **Phân quyền RBAC 4 cấp bậc enforced 3 lớp:** Custom Claims (`auth` + `setRole.js`) → middleware `verifyFirebaseToken + requireRole` từng route → `firestore.rules` (cấm xóa, bắt `evidenceFileUrl`, `auditLogs` append-only).
4. **Tính pháp lý & minh bạch của CSDL:** timestamp server-side mọi bản ghi, audit log tự động 5/5 API ghi (kèm actor/before-after/văn bản nguồn, không làm sập request chính), báo cáo thiếu minh chứng bị từ chối ở cả 3 tầng (FE, API `400`, rules) — đúng yêu cầu _"sản sinh một lần, dùng nhiều lần; công khai, minh bạch, pháp lý"_.
5. **Khả năng dùng chéo máy/tab/role:** dropdown chọn NQ/báo cáo tải từ server, tự tải lại sau F5, blob preview xem ngay không phụ thuộc Storage public, `localStorage` giữ phiên; cron deadline + API tra cứu (`/resolutions`, `/indicators`, `/reports`, `/reviews`, `/audit-logs`) phục vụ giám sát liên tục.
6. **Kiểm chứng được:** `GET /health` OK (`ok:true`), build FE pass, boot-test đủ 10 endpoint + 401 khi thiếu token, checklist chạy được từng giai đoạn theo đúng 4 tài khoản test:
   - [x] `node -v >=18`, `npm install` BE + FE không lỗi
   - [x] Firebase có Auth (4 user) + Firestore + Storage + Vision Enabled
   - [x] `.env` BE đủ 4 biến Firebase, `Listening on :5000`
   - [x] `node setRole.js` + login lại (token mới có role)
   - [x] `POST upload-ocr` → `201`, Storage có file, Firestore có `draft`
   - [x] `POST tree` → `pending_approval` → `PUT approve` → `assigned`
   - [x] `POST reports` → `submitted` + `evidenceFileUrl` → `POST reviews` → `approved/rejected`
   - [x] Cron cập nhật `alertLevel` + FE 6 màn hình login 4 tài khoản

---

## 4. Công việc thực hiện tiếp theo

### 4.1. Mở rộng CSDL dùng chung (theo `CSDL-DUNG-CHUNG-HDND.md` + `README.md`)

1. Mở rộng schema dùng chung sang **Giám sát, Kiến nghị cử tri, Kỳ họp** (giữ nguyên tắc `resolutionId` + denormalize + audit + văn bản nguồn bắt buộc).
2. Deploy `firestore.rules` mới + tạo composite indexes còn thiếu:
   - `progressReports: resolutionId + reportedAt DESC`
   - `reviews: progressReportId + reviewedAt DESC`
   - `auditLogs: resolutionId + createdAt DESC`
3. Kiểm thử chuẩn pháp lý: báo cáo **không kèm file phải bị 400** → kèm file → thẩm tra → `GET /api/audit-logs?resolutionId=<id>` đủ 5 dòng đúng thứ tự thời gian.

### 4.2. Nâng cấp OCR & tự động hóa

4. Thêm dictionary sửa lỗi OCR (`Sô→Số`, `NQ-HDND→NQ-HĐND`, `S[ốoô]`), chịu lỗi mất dấu `NQ-H[ĐD]ND`.
5. Gợi ý chỉ tiêu tự động bằng LLM từ `ocrRawText` (thay vì nhập tay toàn bộ cây).
6. Test lại regex bằng script `debug-ocr.js` với 2 PDF mẫu trong repo trước khi deploy.
   c

### 4.3. Pháp lý số & thông báo

7. Tích hợp **ký số + eKYC** cho người ký / thẩm tra.
8. Thông báo **FCM/Email** khi `alertLevel` chuyển `red` (quá hạn) / `yellow` (≤7 ngày).

### 4.4. Hoàn thiện sản phẩm & vận hành

9. Phân trang + tìm kiếm toàn văn NQ (hiện dashboard đọc thẳng denormalize, chưa có search).
10. Chuẩn hóa Storage Rules production (hiện demo `allow read: if true`), siết CORS `CLIENT_URL`, xử lý port bận, cron test `*/1 * * * *` trước khi để `0 1 * * *`.
11. Viết test tự động boot-test 10 endpoint + kiểm thử 4 role, build FE pass trên môi trường sạch.

---

## 5. Phụ lục: nguồn đối chiếu

- Mục tiêu & kiến trúc: `README.md` mục 1, `CSDL-DUNG-CHUNG-HDND.md` mục 1-2.
- Công việc chính & phân role: `HUONG-DAN-CHI-TIET-LUONG-ROLE-OCR.md` mục 2, 4; `HUONG-DAN-CHAY.md` mục 4-5.
- OCR & tách trường: `HUONG-DAN-CHI-TIET-LUONG-ROLE-OCR.md` mục 5-6 (`ocrService.js`, `resolutionController.js`).
- Đã thực hiện: `README.md` mục 5.
- Tiếp theo: `README.md` Hướng phát triển + `CSDL-DUNG-CHUNG-HDND.md` mục 6.
