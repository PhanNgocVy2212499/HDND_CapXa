# HỆ THỐNG QUẢN LÝ VÀ THEO DÕI THỰC HIỆN NGHỊ QUYẾT HỘI ĐỒNG NHÂN DÂN CẤP XÃ

## 1. TỔNG QUAN DỰ ÁN

### 1.1. Giới thiệu
Hệ thống Quản lý và Theo dõi thực hiện Nghị quyết Hội đồng Nhân dân (HĐND) cấp xã là giải pháp chuyển đổi số trong quản lý văn kiện và điều hành hành chính công tại cấp cơ sở. Dự án tập trung giải quyết Quy trình 1: Quản lý, phân khai, giám sát và thẩm tra tiến độ thực hiện các Nghị quyết do HĐND cấp xã ban hành.

Hệ thống hỗ trợ số hóa văn bản giấy/PDF scan, tự động trích xuất thông tin định danh và bóc tách cây chỉ tiêu kinh tế - xã hội bằng công nghệ nhận dạng ký tự quang học (OCR kết hợp quy tắc Regex chuyên sâu cho văn bản hành chính nhà nước), phân công trách nhiệm cho các đơn vị chủ trì, cập nhật báo cáo tiến độ kèm minh chứng số và tổ chức thẩm tra trực tuyến giữa các Ban HĐND và UBND cấp xã.

### 1.2. Kiến trúc công nghệ
- Backend: Node.js (Express framework), Firebase Admin SDK, RESTful API.
- Cơ sở dữ liệu: Firebase Firestore (CSDL NoSQL thời gian thực), PostgreSQL (tích hợp đồng bộ dữ liệu dự phòng).
- Lưu trữ tệp tin: Cloudinary / Firebase Storage (quản lý file scan Nghị quyết và tài liệu minh chứng).
- Xử lý ảnh & Trí tuệ nhân tạo (OCR): PyMuPDF (Fitz) trích xuất lớp văn bản vector, Tesseract OCR tiếng Việt (độ phân giải 220 DPI) xử lý văn bản scan ảnh, bộ từ điển hành chính chuẩn hóa lỗi ký tự quang học và thuật toán phân tích cây chỉ tiêu đa tầng.
- Frontend: React 18, Vite, Tailwind CSS, Framer Motion, Axios.
- Xác thực & Phân quyền: Firebase Authentication kết hợp cơ chế phân quyền dựa trên vai trò (Role-Based Access Control - RBAC).

---

## 2. PHÂN QUYỀN NGƯỜI DÙNG (RBAC)

Hệ thống phân định quyền hạn và trách nhiệm theo 4 nhóm vai trò nghiệp vụ:

1. Thường trực HĐND cấp xã (Chủ tịch / Phó Chủ tịch HĐND):
   - Ký ban hành Nghị quyết sau khi được HĐND cấp xã thông qua.
   - Phê duyệt việc phân khai cây chỉ tiêu, nhiệm vụ và ấn định thời hạn hoàn thành (deadline) cho từng cơ quan, đơn vị.
   - Theo dõi Dashboard tiến độ tổng thể toàn xã, phê duyệt điều chỉnh chỉ tiêu và xác nhận hoàn thành Nghị quyết.

2. Bộ phận giúp việc / Chuyên viên HĐND cấp xã:
   - Tiếp nhận, quét số hóa văn bản giấy hoặc tải tệp PDF gốc lên hệ thống.
   - Kiểm tra, hiệu chỉnh các thuộc tính định danh (số hiệu, trích yếu, người ký, ngày ban hành) do công cụ OCR tự động điền.
   - Sử dụng công cụ tự động bóc tách cây chỉ tiêu kinh tế - xã hội và danh mục dự án đầu tư để trình Thường trực HĐND phê duyệt.
   - Phân bổ chỉ tiêu về các Ban HĐND và đơn vị thực hiện theo thẩm quyền.

3. Cơ quan / Đơn vị thực hiện (UBND cấp xã, Công chức chuyên môn Địa chính, Tài chính, Tư pháp...):
   - Tiếp nhận chỉ tiêu, nhiệm vụ được phân công.
   - Cập nhật số liệu thực hiện định kỳ (tháng/quý/năm), tỷ lệ phần trăm hoàn thành.
   - Bắt buộc đính kèm văn bản, hồ sơ minh chứng (tệp PDF, hình ảnh, biên bản nghiệm thu) cho mỗi lần báo cáo.

4. Các Ban của HĐND cấp xã (Ban Pháp chế, Ban Kinh tế - Xã hội):
   - Thẩm tra trực tuyến tính chính xác, tính hợp lệ của số liệu báo cáo và hồ sơ minh chứng do UBND hoặc công chức chuyên môn gửi lên.
   - Đưa ra kết luận thẩm tra: Đồng ý thông qua hoặc Yêu cầu giải trình / điều chỉnh số liệu.

---

## 3. SƠ ĐỒ HOẠT ĐỘNG VÀ LUỒNG XỬ LÝ (WORKFLOW)

### 3.1. Sơ đồ quy trình tổng thể

```
[Chuyên viên HĐND]
       |
       v
1. Tải lên tệp scan Nghị quyết ---> Tự động OCR trích xuất metadata (số hiệu, trích yếu, ngày, người ký)
       |
       v
2. Tạo bản soạn thảo (draft) ---> Trình Thường trực HĐND
       |
       v
[Thường trực HĐND]
       |
       v
3. Xem xét văn bản gốc & Ký ban hành (issued)
       |
       v
[Chuyên viên HĐND]
       |
       v
4. Bóc tách tự động cây chỉ tiêu (extract indicators) ---> Hiệu chỉnh cây chỉ tiêu
       |
       v
5. Phân bổ chỉ tiêu về các Ban / Đơn vị chủ trì (pending_distribution -> distributed)
       |
       v
[Thường trực HĐND]
       |
       v
6. Phê duyệt giao việc & Ấn định deadline cho từng chỉ tiêu (assigned)
       |
       v
[Đơn vị thực hiện (UBND / Công chức chuyên môn)]
       |
       v
7. Cập nhật số liệu, tỷ lệ % đạt được + Đính kèm minh chứng bắt buộc (in_progress / submitted)
       |
       v
[Các Ban HĐND cấp xã]
       |
       v
8. Thẩm tra trực tuyến báo cáo & tài liệu minh chứng (approved / rejected)
       |
       v
[Hệ thống Dashboard]
       |
       v
9. Cảnh báo tiến độ tự động (Xanh / Vàng / Đỏ) ---> Thường trực xác nhận hoàn thành (completed)
```

### 3.2. Vòng đời trạng thái (State Lifecycle)

- Văn bản Nghị quyết (Resolution):
  `draft` -> `pending_issue` -> `issued` -> `pending_distribution` -> `distributed` -> `pending_completion` -> `completed`.
  *(Hỗ trợ tương thích ngược với luồng phê duyệt cũ: `pending_ban_review` -> `pending_approval` -> `approved`).*

- Chỉ tiêu / Nhiệm vụ (Indicator):
  `draft` -> `pending_approval` -> `assigned` -> `in_progress` -> `completed` (hoặc `overdue` khi vượt quá hạn chót).

- Báo cáo tiến độ (Progress Report):
  `submitted` -> `approved` (thẩm tra đạt) hoặc `rejected` (yêu cầu bổ sung thông tin/minh chứng).

---

## 4. CÁC TÍNH NĂNG VÀ CÔNG CỤ CHÍNH

### 4.1. Quét số hóa và Trích xuất văn bản (OCR) chuyên sâu
- Hỗ trợ đa dạng định dạng văn bản đầu vào: Tệp PDF scan, PDF có lớp văn bản điện tử, hình ảnh chụp văn bản (PNG, JPG, JPEG).
- Tích hợp PyMuPDF trích xuất lớp văn bản số hóa tức thời. Đối với tệp scan ảnh thuần túy, hệ thống tự động kích hoạt Tesseract OCR tiếng Việt với độ phân giải tối ưu 220 DPI.
- Bộ lọc chuẩn hóa từ vựng hành chính (`cleanAdministrativeWords`): Khắc phục triệt để các lỗi vỡ font quang học đặc thù của tiếng Việt có dấu (ví dụ: "biên chế", "viên chức", "Hội đồng nhân dân", "đơn vị sự nghiệp", "kinh phí", "trạm y tế").
- Tự động điền (Auto-fill): Nhận diện và điền sẵn số hiệu văn bản, trích yếu nội dung, ngày ban hành và họ tên người ký.

### 4.2. Bóc tách tự động và Phân khai cây chỉ tiêu
- Nhận diện phân cấp văn bản pháp quy: Điều, Khoản, Điểm, xây dựng cây phân cấp phụ thuộc (Parent - Child).
- Thuật toán trích xuất con số kế hoạch (`parseTarget`): Tự động phát hiện giá trị mục tiêu kèm đơn vị đo lường tương ứng (đồng, triệu đồng, tỷ đồng, biên chế, người, %, công trình, trường học, ha...), tự động loại trừ các con số năm (như "năm 2026").
- Dự đoán cơ quan chủ trì (`inferDepartment`): Phân tích ngữ cảnh nội dung chỉ tiêu để gợi ý đơn vị thực hiện phù hợp (Kinh tế - Địa chính - Xây dựng, Văn hóa - Xã hội, Tài chính - Kế toán, Tư pháp - Hộ tịch).
- Giao diện quản lý cây chỉ tiêu: Cho phép thêm, sửa, xóa, tái phân nhóm và xuất danh mục ra định dạng văn bản để phối hợp công tác.

### 4.3. Ký ban hành và Phê duyệt phân bổ nhiệm vụ
- Trình xem văn bản trực tiếp: Thường trực HĐND đối chiếu toàn văn bản scan gốc trước khi thực hiện phê duyệt.
- Giao trách nhiệm thực hiện kèm thời hạn hoàn thành (deadline) cụ thể cho từng chỉ tiêu, phân tách rõ đơn vị chủ trì và đơn vị phối hợp.
- Nhật ký hệ thống (Audit Log): Ghi nhận chi tiết thông tin người thực hiện, thời gian và thay đổi trạng thái theo từng bước.

### 4.4. Cập nhật tiến độ và Quản lý minh chứng số
- Đơn vị được giao việc nhập số liệu thực tế định kỳ và cập nhật tỷ lệ hoàn thành (0% - 100%).
- Yêu cầu bắt buộc tải lên tệp minh chứng số (quyết định giao vốn, hóa đơn thanh toán, biên bản nghiệm thu, báo cáo tổng kết, hình ảnh thực địa...).
- Lưu trữ tập trung và cấp quyền truy cập an toàn cho cán bộ kiểm tra.

### 4.5. Thẩm tra trực tuyến của các Ban HĐND
- Phân hệ làm việc riêng biệt cho Ban Pháp chế và Ban Kinh tế - Xã hội.
- Cho phép đối chiếu số liệu báo cáo của đơn vị với tài liệu minh chứng đính kèm.
- Ghi nhận ý kiến đánh giá thẩm tra: Phê duyệt thông qua hoặc yêu cầu giải trình, cập nhật lại số liệu.

### 4.6. Bảng điều hành tổng hợp (Dashboard) và Cảnh báo tự động
- Thống kê trực quan toàn bộ Nghị quyết, chỉ tiêu, báo cáo và kết quả thẩm tra.
- Biểu đồ tiến độ thực hiện theo từng lĩnh vực chuyên môn và đơn vị phụ trách.
- Thuật toán đánh giá hạn chót tự động:
  + Màu xanh: Tiến độ bình thường, thời gian còn lại trên 7 ngày.
  + Màu vàng: Sắp đến hạn chót, thời gian còn lại từ 1 đến 7 ngày.
  + Màu đỏ: Quá thời hạn quy định mà chưa hoàn thành mục tiêu.

---

## 5. YÊU CẦU HỆ THỐNG

- Hệ điều hành: Windows 10/11, Ubuntu 20.04 trở lên, macOS.
- Node.js: Phiên bản 18.x trở lên (khuyến nghị phiên bản 20.x hoặc 22.x LTS).
- Python: Phiên bản 3.9 trở lên (sử dụng thư viện PyMuPDF).
- Tesseract OCR: Phiên bản 5.x trở lên, kèm gói dữ liệu ngôn ngữ tiếng Việt (`vie.traineddata`).
- Tài khoản dịch vụ Firebase: Dự án Firebase đã kích hoạt Authentication và Cloud Firestore.
- Dịch vụ lưu trữ Cloudinary (tùy chọn): Quản lý tệp tin văn bản và hồ sơ minh chứng.

---

## 6. HƯỚNG DẪN CÀI ĐẶT

### 6.1. Sao chép mã nguồn (Clone repository)
```bash
git clone https://github.com/PhanNgocVy2212499/HDND_CapXa.git
cd HDND_CapXa
```

### 6.2. Cài đặt môi trường Python & Tesseract OCR
1. Cài đặt thư viện xử lý tài liệu Python:
```bash
pip install pymupdf
```

2. Cài đặt Tesseract OCR:
- Trên hệ điều hành Windows: Cài đặt Tesseract vào thư mục mặc định `C:\Program Files\Tesseract-OCR`.
- Gói dữ liệu tiếng Việt `vie.traineddata` đã được tích hợp sẵn trong thư mục `backend/tessdata/`. Hệ thống tự động thiết lập biến môi trường `TESSDATA_PREFIX` khi khởi chạy.

### 6.3. Cài đặt và cấu hình Backend
1. Chuyển vào thư mục backend và cài đặt thư viện phụ thuộc:
```bash
cd backend
npm install
```

2. Tạo và cấu hình tệp biến môi trường `backend/.env`:
```env
PORT=5000
CLIENT_URL=http://localhost:3000

# Cấu hình Firebase Admin SDK
FIREBASE_PROJECT_ID=ten-project-firebase
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@ten-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=ten-project.firebasestorage.app

# Chế độ lưu trữ tệp: 'cloudinary' hoặc 'local' hoặc 'firebase'
STORAGE_MODE=cloudinary
CLOUDINARY_CLOUD_NAME=ten_cloud
CLOUDINARY_API_KEY=key_cloud
CLOUDINARY_API_SECRET=secret_cloud
```

### 6.4. Cài đặt và cấu hình Frontend
1. Chuyển vào thư mục frontend và cài đặt thư viện phụ thuộc:
```bash
cd ../frontend
npm install
```

2. Tạo và cấu hình tệp biến môi trường `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=ten-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ten-project
VITE_FIREBASE_STORAGE_BUCKET=ten-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
```

---

## 7. HƯỚNG DẪN VẬN HÀNH VÀ SỬ DỤNG

### 7.1. Khởi động ứng dụng
1. Khởi động dịch vụ Backend (cổng 5000):
```bash
cd backend
npm run dev
```

2. Khởi động dịch vụ Frontend (cổng 3000):
```bash
cd frontend
npm run dev
```
Truy cập hệ thống qua trình duyệt web tại địa chỉ: `http://localhost:3000`

### 7.2. Danh sách tài khoản thử nghiệm
Hệ thống cung cấp sẵn các tài khoản kiểm thử đại diện cho 4 vai trò nghiệp vụ (mật khẩu mặc định: `123456`):
- Chuyên viên HĐND: `chuyenvien@xa.gov.vn`
- Thường trực HĐND: `thuongtruc@xa.gov.vn`
- Đơn vị thực hiện (UBND cấp xã): `ubnd@xa.gov.vn`
- Các Ban của HĐND: `banhdnd@xa.gov.vn`

### 7.3. Kịch bản vận hành mẫu (Walkthrough)

1. Soạn thảo và số hóa Nghị quyết:
   - Đăng nhập với tài khoản Chuyên viên: `chuyenvien@xa.gov.vn`.
   - Truy cập mục "Soạn thảo NQ".
   - Tải lên tệp PDF scan Nghị quyết hoặc chọn văn bản mẫu có sẵn.
   - Kiểm tra các trường thông tin do OCR tự động nhận dạng, nhấn "Tạo bản soạn thảo nghị quyết" và chọn "Trình Thường trực ký ban hành".

2. Ký ban hành Nghị quyết:
   - Đăng nhập với tài khoản Thường trực HĐND: `thuongtruc@xa.gov.vn`.
   - Truy cập mục "Ký ban hành / Xác nhận".
   - Kiểm tra nội dung toàn văn tệp PDF gốc, nhấn "Ký ban hành nghị quyết", sau đó nhấn "Chuyển sang Bóc tách chỉ tiêu".

3. Bóc tách và Phân bổ chỉ tiêu:
   - Tại mục "Bóc tách & Phân chỉ tiêu", chọn văn bản vừa được ban hành.
   - Nhấn "Bóc tách tự động" để hệ thống phân tích Điều/Khoản thành danh mục chỉ tiêu chi tiết.
   - Hiệu chỉnh thông tin nếu cần, nhấn "Lưu bóc tách chỉ tiêu" và nhấn "Phân chỉ tiêu về các ban".

4. Phê duyệt giao việc và ấn định thời hạn:
   - Thường trực HĐND truy cập lại mục "Ký ban hành / Phê duyệt", xác nhận đơn vị chịu trách nhiệm và ấn định hạn chót hoàn thành cho từng chỉ tiêu.

5. Báo cáo số liệu thực hiện:
   - Đăng nhập với tài khoản Đơn vị thực hiện: `ubnd@xa.gov.vn`.
   - Truy cập mục "Báo cáo", chọn chỉ tiêu cần cập nhật tiến độ, nhập giá trị đạt được, tỷ lệ hoàn thành và đính kèm tệp tài liệu minh chứng. Nhấn "Gửi báo cáo".

6. Thẩm tra báo cáo:
   - Đăng nhập với tài khoản Các Ban HĐND: `banhdnd@xa.gov.vn`.
   - Truy cập mục "Thẩm tra", kiểm tra báo cáo và đối chiếu tài liệu minh chứng gốc để xác nhận kết quả thẩm tra.

7. Theo dõi và Giám sát trên Dashboard:
   - Truy cập mục "Tổng quan" để theo dõi biểu đồ tiến độ thực hiện, thống kê tỷ lệ hoàn thành và các cảnh báo hạn chót theo thời gian thực.

---

## 8. CẤU TRÚC CƠ SỞ DỮ LIỆU (DATABASE SCHEMA)

Hệ thống quản lý dữ liệu trên Firebase Firestore với 4 bộ sưu tập (collections) chính:

1. `resolutions` (Quản lý Nghị quyết):
   - `id`: Mã định danh văn bản.
   - `codeNumber`: Số hiệu văn bản (ví dụ: 32/NQ-HĐND).
   - `title`: Trích yếu nội dung Nghị quyết.
   - `signer`: Người ký ban hành.
   - `issuanceDate`: Ngày ban hành (Timestamp).
   - `fileUrl`, `storagePath`: Đường dẫn lưu trữ tệp scan gốc.
   - `status`: draft | pending_issue | issued | pending_distribution | distributed | pending_completion | completed.
   - `ocrRawText`: Toàn văn nội dung văn bản bóc tách sau khi làm sạch.

2. `indicators` (Quản lý Chỉ tiêu và Nhiệm vụ):
   - `id`: Mã định danh chỉ tiêu.
   - `resolutionId`: Mã liên kết với Nghị quyết ban hành.
   - `parentId`: Mã chỉ tiêu cấp cha (giá trị null nếu là chỉ tiêu gốc).
   - `title`: Nội dung chi tiết của chỉ tiêu hoặc nhiệm vụ.
   - `targetValue`: Giá trị số tiêu chí cần đạt.
   - `unit`: Đơn vị tính (đồng, %, biên chế, công trình, người...).
   - `deadline`: Hạn chót hoàn thành.
   - `assignedDepartments`: Danh sách các đơn vị chủ trì và phối hợp thực hiện.
   - `status`: draft | pending_approval | assigned | in_progress | completed | overdue.

3. `progressReports` (Quản lý Báo cáo tiến độ):
   - `id`: Mã định danh báo cáo.
   - `indicatorId`: Mã liên kết với chỉ tiêu được giao.
   - `actualValue`: Giá trị thực tế đã thực hiện được.
   - `progressPercentage`: Tỷ lệ phần trăm hoàn thành (từ 0% đến 100%).
   - `evidenceUrl`: Đường dẫn tệp tài liệu minh chứng bắt buộc.
   - `status`: submitted | approved | rejected.

4. `reviews` (Quản lý Kết quả thẩm tra):
   - `id`: Mã định danh đợt thẩm tra.
   - `progressReportId`: Mã liên kết với báo cáo tiến độ.
   - `reviewerUid`, `reviewerEmail`: Thông tin người thực hiện thẩm tra thuộc Ban HĐND.
   - `status`: passed | need_clarification.
   - `comment`: Ý kiến thẩm tra và đánh giá chi tiết.
