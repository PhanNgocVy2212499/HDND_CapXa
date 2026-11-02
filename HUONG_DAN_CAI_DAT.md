# HƯỚNG DẪN CÀI ĐẶT & TRIỂN KHAI HỆ THỐNG HĐND CẤP XÃ
> **Hệ thống Quản lý, Giám sát & Bóc tách Chỉ tiêu Nghị quyết HĐND Cấp Xã**  
> *Phiên bản: 1.4.0 — Tích hợp OCR PyMuPDF & Tesseract Tiếng Việt*

---

## 1. Yêu cầu môi trường tiền đề (Prerequisites)

Trước khi tiến hành cài đặt, đảm bảo máy tính/máy chủ đã cài đặt các công cụ sau:

| Công cụ | Phiên bản khuyến nghị | Mục đích sử dụng |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.x` (LTS 20 hoặc 22) | Chạy Backend Express API và Frontend Vite React |
| **Python** | `>= 3.9` | Chạy bộ engine bóc tách PDF vector & OCR (`PyMuPDF`) |
| **Tesseract-OCR** | `>= 5.0` | OCR bản scan ảnh tiếng Việt (kèm `vie.traineddata`) |
| **Git** | Bất kỳ | Quản lý mã nguồn |
| **Trình duyệt** | Chrome, Edge, Firefox | Giao diện người dùng Web |

---

## 2. Cài đặt chi tiết từng bước

### Bước 1: Tải mã nguồn dự án

Mở Terminal / PowerShell và clone dự án về máy:
```bash
git clone https://github.com/PhanNgocVy2212499/HDND_CapXa.git
cd HDND_CapXa
```

---

### Bước 2: Cài đặt thư viện Python & Tesseract OCR

Hệ thống sử dụng **PyMuPDF** để đọc văn bản gốc giữ nguyên dấu tiếng Việt và gọi **Tesseract OCR** để bóc tách các văn bản scan mờ.

1. **Cài đặt thư viện Python:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Cài đặt Tesseract OCR và bộ ngôn ngữ Tiếng Việt:**
   - **Trên Windows:**
     - Tải bộ cài đặt Tesseract Windows từ: [UB-Mannheim/tesseract/wiki](https://github.com/UB-Mannheim/tesseract/wiki).
     - Khi cài đặt, chọn thêm mục **Additional script data -> Vietnamese** hoặc tải file `vie.traineddata` từ [tessdata](https://github.com/tesseract-ocr/tessdata) rồi bỏ vào thư mục `tessdata` (ví dụ: `C:\Program Files\Tesseract-OCR\tessdata\` hoặc `D:\Tesseract\tessdata\`).
     - Thêm thư mục chứa `tesseract.exe` vào biến môi trường `PATH` của hệ thống.
   - **Trên Linux (Ubuntu/Debian):**
     ```bash
     sudo apt update
     sudo apt install -y tesseract-ocr tesseract-ocr-vie poppler-utils
     ```

---

### Bước 3: Cài đặt & Cấu hình Backend (Node.js API)

1. Di chuyển vào thư mục backend và cài đặt dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Tạo file cấu hình môi trường `.env`:
   - Copy file mẫu `.env.example` thành `.env`:
     ```bash
     cp .env.example .env
     ```
   - Mở file `backend/.env` và điền các thông số:
     ```env
     PORT=5000
     CLIENT_URL=http://localhost:3000

     # 1. Firebase Admin (Bắt buộc để lưu trữ CSDL Firestore)
     FIREBASE_PROJECT_ID=hdnd-xa
     FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@hdnd-xa.iam.gserviceaccount.com
     # Lưu ý: Private Key giữ nguyên định dạng "-----BEGIN PRIVATE KEY-----\n..."
     FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
     FIREBASE_STORAGE_BUCKET=hdnd-xa.appspot.com

     # 2. Chế độ lưu trữ File (minh chứng, PDF nghị quyết): cloudinary | local | firebase
     STORAGE_MODE=cloudinary
     CLOUDINARY_CLOUD_NAME=your_cloud_name
     CLOUDINARY_API_KEY=your_api_key
     CLOUDINARY_API_SECRET=your_api_secret

     # 3. Cấu hình gửi Email thông báo tự động (Gmail SMTP):
     SMTP_USER=your_email@gmail.com
     # Lưu ý: Mật khẩu ứng dụng 16 ký tự của Google (App Password), không phải mật khẩu đăng nhập cá nhân
     SMTP_PASS=xxxx xxxx xxxx xxxx

     # 4. PostgreSQL (Tùy chọn sao lưu/đồng bộ CSDL)
     # PG_HOST=localhost
     # PG_PORT=5432
     # PG_DATABASE=hdnd_xa
     # PG_USER=postgres
     # PG_PASSWORD=your_password
     ```

---

### Bước 4: Cài đặt & Cấu hình Frontend (React / Vite)

1. Mở cửa sổ Terminal mới, chuyển vào thư mục frontend và cài đặt dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Tạo file `.env` cho Frontend:
   - Copy từ file `.env.example`:
     ```bash
     cp .env.example .env
     ```
   - Nội dung file `frontend/.env`:
     ```env
     VITE_API_URL=http://localhost:5000/api
     VITE_FIREBASE_API_KEY=AIzaSy...
     VITE_FIREBASE_AUTH_DOMAIN=hdnd-xa.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID=hdnd-xa
     VITE_FIREBASE_STORAGE_BUCKET=hdnd-xa.appspot.com
     VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     VITE_FIREBASE_APP_ID=your_app_id
     ```

---

## 3. Khởi chạy hệ thống

### Khởi động Backend:
Tại thư mục `backend`:
```bash
npm run dev
```
> Server sẽ khởi chạy tại: `http://localhost:5000`  
> Kiểm tra trạng thái: `http://localhost:5000/health`

### Khởi động Frontend:
Tại thư mục `frontend`:
```bash
npm run dev
```
> Mở trình duyệt và truy cập: `http://localhost:3000`

---

## 4. Phân quyền vai trò người dùng (RBAC)

Hệ thống thiết kế theo quy trình khép kín với 4 vai trò chính:

| Vai trò | Mã quyền | Thẩm quyền trong quy trình |
| :--- | :--- | :--- |
| **Chuyên viên HĐND** | `chuyen_vien` | Tải lên PDF Nghị quyết, bóc tách OCR, dựng cây chỉ tiêu, xuất văn bản Word và gửi email trình Ban |
| **Ban HĐND** | `ban_hdnd` | Thẩm tra cây chỉ tiêu (ghi ý kiến Thống nhất / Yêu cầu chỉnh sửa), thẩm tra các báo cáo tiến độ kèm minh chứng |
| **Thường trực HĐND** | `thuong_truc` | Phê duyệt chính thức Nghị quyết và cây chỉ tiêu, giao nhiệm vụ cho UBND xã, theo dõi Dashboard giám sát |
| **Cơ quan thực hiện** | `co_quan_thuc_hien` | UBND xã / các phòng ban nhận việc, nhập số liệu thực tế định kỳ, đính kèm file minh chứng (Word/Excel/PDF/Ảnh) |

> **Mẹo thử nghiệm:**  
> Hệ thống tích hợp sẵn thanh chuyển đổi vai trò nhanh ngay góc trên cùng bên phải giao diện để thuận tiện chạy thử nghiệm quy trình mà không cần đăng nhập lại.

---

## 5. Xử lý các sự cố thường gặp (Troubleshooting)

1. **Lỗi `Chỉ chấp nhận file PDF, PNG, JPG` khi gửi báo cáo:**
   - Hệ thống hiện tại đã mở rộng hỗ trợ nhận: `.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.png`, `.jpg`, `.webp`. Dung lượng tối đa: 25MB.
2. **Lỗi không gửi được email thông báo về hộp thư:**
   - Đảm bảo tài khoản Gmail đã bật **Xác minh 2 bước (2-Step Verification)**.
   - Truy cập `Tài khoản Google -> Bảo mật -> Mật khẩu ứng dụng (App Passwords)` để tạo mã 16 chữ số và gán vào `SMTP_PASS` trong file `backend/.env`.
3. **Lỗi OCR tiếng Việt bị mất dấu hoặc không tìm thấy Tesseract:**
   - Kiểm tra đường dẫn cài đặt Tesseract trong `extract_pdf.py` hoặc thêm `Tesseract-OCR` vào biến `PATH`.
   - Kiểm tra xem file `vie.traineddata` đã nằm trong thư mục `tessdata` chưa.
