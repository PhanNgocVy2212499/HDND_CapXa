# CSDL DÙNG CHUNG HĐND SỐ CẤP XÃ — Thiết kế & Quy chế khai thác

> Trọng tâm của hệ thống HĐND số cấp xã là **Cơ sở dữ liệu (CSDL) dùng chung**,
> tích hợp toàn bộ thông tin phát sinh từ hoạt động ban hành Nghị quyết, tổ chức Giám sát,
> xử lý Kiến nghị cử tri và quản lý Kỳ họp.
> Mô hình dữ liệu tuân thủ nguyên tắc **"sản sinh dữ liệu một lần, chia sẻ sử dụng nhiều lần"**,
> liên kết chặt chẽ từng nghị quyết, chỉ tiêu, nhiệm vụ với cơ quan chịu trách nhiệm,
> thời hạn hoàn thành, tiến độ thực hiện và tài liệu minh chứng.

---

## 1. Sơ đồ liên kết (khóa dùng chung `resolutionId`)

```
resolutions/{id}  (gốc: PDF NQ + OCR)
  │  codeNumber, title, fileUrl, status, ocrRawText
  │  createdByUserId, createdAt, updatedAt
  ▼
indicators/{id}   (cây chỉ tiêu, parentId đệ quy)
  │  resolutionId ──────────────┐
  │  resolutionCodeNumber (denormalize)
  │  resolutionFileUrl (văn bản nguồn NQ)
  │  assignedDepartments[{departmentId, role: primary|cooperate}]
  │  deadline, status, alertLevel, currentValue, progressPercentage
  ▼
progressReports/{id}  (báo cáo tiến độ — BẮT BUỘC kèm evidence)
  │  resolutionId, resolutionCodeNumber, indicatorId, indicatorTitle
  │  actualValue, progressPercentage, period, remarks
  │  evidenceFileUrl + evidenceStoragePath (100% bắt buộc)
  │  reportedAt, status: submitted|approved|rejected
  ▼
reviews/{id}  (thẩm tra 2 chiều)
  │  resolutionId, indicatorId, progressReportId
  │  reviewerRole, comment, status: passed|need_clarification, reviewedAt
  ▼
auditLogs/{id}  (append-only — sinh tự động ở mọi API ghi)
   collection, docId, resolutionId, action,
   actor{uid,email,role,departmentId}, before, after,
   sourceFileUrl, message, createdAt
```

Mọi API ghi đều `writeAudit()` trong `backend/src/services/auditService.js`:
`upload-ocr → create_resolution`, `tree → upsert_tree`,
`approve → approve_indicator`, `reports → submit_report`, `reviews → submit_review`.

---

## 2. Nguyên tắc "sản sinh một lần, chia sẻ nhiều lần"

| Quy tắc | Cài đặt trong code |
|---------|--------------------|
| NQ nhập 1 lần (upload + OCR) | `resolutionController.js` tạo `resolutions/{id}` kèm `fileUrl`, `ocrRawText` |
| Chỉ tiêu không nhập lại tên NQ | `indicatorController.js:saveNodeRecursive` tự copy `resolutionCodeNumber`, `resolutionFileUrl` từ NQ gốc |
| Báo cáo không nhập lại tên NQ/chỉ tiêu | `submitReport` tự copy `resolutionCodeNumber`, `indicatorTitle` từ indicator |
| Thẩm tra không nhập lại NQ | `submitReview` tự copy `resolutionId` từ báo cáo |
| Dashboard không join | Đọc thẳng field denormalize (`currentValue`, `progressPercentage`) |

---

## 3. Tự động đóng dấu thời gian (Timestamp)

- Mọi document đều có `createdAt` + `updatedAt` (server-side `admin.firestore.Timestamp.now()`).
- Riêng: `reportedAt` (báo cáo), `reviewedAt` (thẩm tra).
- Cron `deadlineMonitor.js` cập nhật `updatedAt` mỗi lần tính `alertLevel`.
- Không tin timestamp client gửi lên — backend tự đóng dấu.

## 4. Lưu vết lịch sử (Audit Log)

- Collection `auditLogs`, **append-only**: `firestore.rules` cấm `update/delete`, chỉ cho `read` (nội bộ đăng nhập) — ghi do backend Admin SDK thực hiện.
- Mỗi dòng log: ai (`uid/email/role/departmentId`), làm gì (`action`), trên document nào (`collection/docId`), thuộc NQ nào (`resolutionId`), trước/sau (`before/after` đã cắt `ocrRawText` dài), văn bản nguồn (`sourceFileUrl`), lúc nào (`createdAt`).
- `writeAudit()` **không bao giờ làm sập request chính** (try/catch nội bộ, lỗi chỉ `console.warn`).
- Tra cứu: `GET /api/audit-logs?resolutionId=...&collection=...&docId=...&limit=50` (mọi role đăng nhập).

Ví dụ:

```
GET /api/audit-logs?resolutionId=<idNQ>
→ [create_resolution (chuyên viên, kèm PDF NQ),
    upsert_tree (3 chỉ tiêu),
    approve_indicator (thường trực),
    submit_report (UBND kèm evidence),
    submit_review (Ban: passed)]
```

## 5. Bắt buộc văn bản nguồn (100%)

| Dữ liệu | Văn bản nguồn | Chế tài |
|---------|---------------|---------|
| Nghị quyết | File PDF/ảnh upload (`field: file`, multer 20MB) | Thiếu → `400 Vui lòng chọn file...` |
| Báo cáo tiến độ | File minh chứng (`field: evidence`) | Thiếu → `400 Bắt buộc đính kèm file minh chứng...` + `firestore.rules` bắt `evidenceFileUrl.size() > 0` |
| Thẩm tra | Kế thừa `evidenceFileUrl` của báo cáo vào audit | Không có evidence thì review vẫn ghi nhưng audit đánh dấu nguồn rỗng để truy vết |

Không có văn bản nguồn → dữ liệu **không có giá trị pháp lý**, không được công nhận `approved`.

## 6. Triển khai / vận hành

1. Deploy `firestore.rules` mới (thêm khối `auditLogs` + điều kiện `evidenceFileUrl`).
2. Restart backend để nhận `auditService`, `auditController`, route `GET /api/audit-logs`.
3. Tạo composite indexes khi Firestore báo (code đã có fallback sort tay nếu thiếu index):
   - `progressReports: resolutionId + reportedAt DESC`
   - `reviews: progressReportId + reviewedAt DESC`
   - `auditLogs: resolutionId + createdAt DESC`
4. Kiểm thử: upload NQ → dựng cây → duyệt → báo cáo **không kèm file phải bị 400** → báo cáo kèm file → thẩm tra → `GET /api/audit-logs?resolutionId=<id>` phải ra đủ 5 dòng theo đúng thứ tự thời gian.

## 7. File code liên quan

- `backend/src/services/auditService.js` — `now/stampCreate/stampUpdate/writeAudit`
- `backend/src/controllers/auditController.js` — `GET /api/audit-logs`
- `backend/src/controllers/resolutionController.js` — audit `create_resolution`
- `backend/src/controllers/indicatorController.js` — denormalize NQ + audit `upsert_tree/approve_indicator`
- `backend/src/controllers/reportReviewController.js` — evidence bắt buộc + audit `submit_report/submit_review`
- `backend/src/types/firestoreSchemas.ts` — `AuditLog`, field `resolutionCodeNumber/indicatorTitle/evidence*` bắt buộc
- `backend/firestore.rules` — `auditLogs` append-only + bắt `evidenceFileUrl`
- `frontend/src/components/ReportForm.jsx` — chặn client khi thiếu file minh chứng
