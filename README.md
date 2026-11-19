# HE THONG QUAN LY VA THEO DOI THUC HIEN NGHI QUYET HOI DONG NHAN DAN CAP XA

## 1. TONG QUAN DU AN

### 1.1. Gioi thieu
He thong Quan ly va Theo doi thuc hien Nghi quyet Hoi dong Nhan dan (HDND) cap xa la giai phap chuyen doi so nghiep vu hanh chinh cong cap co so, tap trung vao Quy trinh 1: Quan ly, phan khai, giam sat va tham tra tien do thuc hien cac Nghi quyet do HDND cap xa ban hanh.

He thong giup so hoa van ban giay/PDF scan, tu dong boc tach du lieu dinh danh va he thong chi tieu bang tri tue nhan tao (OCR ket hop Regex chuyen sau cho van kien hanh chinh), phan cong giao viec den tung cong chuc/don vi chu tri, theo doi bao cao tien do thoi gian thuc va ho tro tham tra truc tuyen giua cac Ban HDND va UBND cap xa.

### 1.2. Kien truc cong nghe
- Backend: Node.js (Express framework), Firebase Admin SDK, RESTful API.
- Co so du lieu: Firebase Firestore (CSDL NoSQL chinh, thoi gian thuc), PostgreSQL (dong bo luu tru du phong).
- Luu tru tep tin: Cloudinary / Firebase Storage (quan ly file scan Nghi quyet va tai lieu minh chung).
- Tri tue nhan tao & Xu ly anh (OCR): PyMuPDF (Fitz) trich xuat text vector, Tesseract OCR tieng Viet (220 DPI) xu ly file scan anh, mo-dun lam sach tu vung hanh chinh va thuat toan boc tach cay chi tieu phan cap.
- Frontend: React 18, Vite, Tailwind CSS, Framer Motion, Lucide Icons, Axios.
- Xac thuc & Phan quyen: Firebase Authentication, Custom Claims RBAC (Role-Based Access Control).

---

## 2. PHAN QUYEN NGUOI DUNG (RBAC)

He thong phan dinh chat che 4 nhom vai tro nghiep vu:

1. Thuong truc HDND cap xa (Chu tich / Pho Chu tich HDND):
   - Ky ban hanh / Phe duyet Nghi quyet sau khi soan thao.
   - Phe duyet viec phan khai cay chi tieu va an dinh thoi han (deadline), giao trach nhiem cho tung don vi.
   - Theo doi Dashboard tien do tong hop va xac nhan hoan thanh Nghi quyet.

2. Bo phan giup viec / Chuyen vien HDND:
   - Tiep nhan, so hoa file van ban goc (PDF/Anh).
   - Kiem tra thuoc tinh dinh danh (so hieu, trich yeu, nguoi ky, ngay ban hanh) do OCR tu dong dien.
   - Su dung cong cu tu dong boc tach cay chi tieu kinh te - xa hoi va du an dau tu, trinh Thuong truc HDND phe duyet.
   - Phan bo chi tieu ve cac ban/don vi theo tham quyen.

3. Co quan / Don vi thuc hien (UBND xa, Cong chuc Dia chinh, Tai chinh, Tu phap...):
   - Tiep nhan cac chi tieu, nhiem vu duoc giao.
   - Cap nhat tien do dinh ky (thang/quy/nam), ty le % hoan thanh, gia tri thuc te.
   - Bat buoc dinh kem van ban, tai lieu minh chung (PDF/Anh/Bao cao) cho tung lan cap nhat.

4. Cac Ban cua HDND cap xa (Ban Phap che, Ban Kinh te - Xa hoi):
   - Tham tra truc tuyen tinh xac thuc, hop le cua cac bao cao do UBND va cong chuc chuyen mon gui len.
   - Dua ra y kien tham tra: Dong y thong qua hoac Yeu cau giai trinh / lam lai.

---

## 3. SO DO HOAT DONG VA LUONG XU LY (WORKFLOW)

### 3.1. So do tong the quy trinh nghiep vu

```
[Chuyen vien HDND]
       │
       ▼
1. Upload file scan NQ ──▶ Tu dong OCR trich xuat metadata (so hieu, trich yeu, ngay, nguoi ky)
       │
       ▼
2. Tao ban soan thao (draft) ──▶ Trinh Thuong truc HDND
       │
       ▼
[Thuong truc HDND]
       │
       ▼
3. Xem xet PDF goc & Ky ban hanh (issued)
       │
       ▼
[Chuyen vien HDND]
       │
       ▼
4. Tu dong boc tach cay chi tieu (extract indicators) ──▶ Chinh sua / Bo sung cay chi tieu
       │
       ▼
5. Phan bo chi tieu ve cac Ban / Don vi chu tri (pending_distribution -> distributed)
       │
       ▼
[Thuong truc HDND]
       │
       ▼
6. Phe duyet giao viec & an dinh deadline tung chi tieu (assigned)
       │
       ▼
[Don vi thuc hien (UBND / Cong chuc)]
       │
       ▼
7. Cap nhat tien do, gia tri dat duoc + Dinh kem minh chung (in_progress / submitted)
       │
       ▼
[Cac Ban HDND xa]
       │
       ▼
8. Tham tra truc tuyen bao cao & minh chung (approved / rejected)
       │
       ▼
[Dashboard He thong]
       │
       ▼
9. Canh bao tien do (Xanh / Vang / Do) ──▶ Thuong truc xac nhan hoan thanh (completed)
```

### 3.2. Vong doi trang thai (State Lifecycle)

- Nghi quyet (Resolution):
  `draft` -> `pending_issue` -> `issued` -> `pending_distribution` -> `distributed` -> `pending_completion` -> `completed`.
  *(Tuong thich luong cu: `pending_ban_review` -> `pending_approval` -> `approved`).*

- Chi tieu (Indicator):
  `draft` -> `pending_approval` -> `assigned` -> `in_progress` -> `completed` (hoac `overdue` neu cham deadline).

- Bao cao tien do (Progress Report):
  `submitted` -> `approved` (tham tra dat) hoac `rejected` (yeu cau bo sung minh chung).

---

## 4. CAC CHUC NANG CHINH CUA HE THONG

### 4.1. Soan thao & So hoa van ban bang OCR chuyen sau
- Ho tro nhieu dinh dang van ban dau vao: PDF scan, PDF dien tu, anh chup giay to hanh chinh (PNG, JPG, JPEG).
- Tich hop PyMuPDF bop tach text vector toc do cao. Doi voi file scan anh thuan tuy, he thong tu dong kich hoat Tesseract OCR tieng Viet 220 DPI.
- Bo loc tu dien hanh chinh (`cleanAdministrativeWords`) chuan hoa cac loi ky tu OCR quang hoc (vi du: sua loi mat dau, vỡ phong, nhan dien cac cum tu dac thu nhu "Hoi dong nhan dan", "bien che", "vien chuc", "don vi su nghiep").
- Tu dong trich xuat cac truong can thiet: So hieu Nghi quyet, Trich yeu noi dung, Ngay ban hanh va Nguoi ky van ban.

### 4.2. Boc tach tu dong va Phan khai cay chi tieu
- Nhan dien cau truc van ban theo cap bac: Dieu, Khoan, Diem, phan tich do sau phan cap (Parent - Child Tree).
- Thuat toan tach con so ke hoach (`parseTarget`): Nhan dien chinh xac gia tri so va don vi tinh (dong, trieu dong, ty dong, bien che, nguoi, %, cong trinh, truong hoc...), tu dong loai bo so nam (nhu "nam 2026").
- Tu dong suy doan phong ban/don vi chu tri (`inferDepartment`) dua vao tu khoa nghiep vu: Kinh te - Dia chinh - Xay dung, Van hoa - Xa hoi, Tai chinh - Ke toan, Tu phap - Ho tich.
- Cho phep nguoi dung chinh sua truc tiep tren bang luoi, them/xoa nhanh chi tieu, ho tro xuat du lieu ra file Word (.docx) gui email den UBND xa.

### 4.3. Ky ban hanh & Phe duyet giao viec
- Thuong truc HDND xem truc tiep file van ban PDF goc thong qua trinh xem nhung.
- Giao trach nhiem truc tiep cho don vi chu tri, don vi phoi hop kem thoi han hoan thanh cu the.
- Luu lich su truy vet he thong (Audit Log) theo tung lan thao tac: ai thuc hien, thoi diem, trang thai truoc va sau.

### 4.4. Bao cao tien do va Quan ly minh chung
- Don vi thuc hien cap nhat dinh ky so lieu thuc hien va % hoan thanh.
- Bat buoc tai len van ban minh chung (quyet dinh, bien ban nghiem thu, hoa don, anh hien truong...).
- Chuyen vien va cac Ban HDND co the tai xuong hoac xem truc tiep minh chung qua he thong bao mat.

### 4.5. Tham tra truc tuyen cua cac Ban HDND
- Giao dien danh rieng cho cac Ban HDND kiem tra doi chieu so lieu bao cao voi minh chung goc.
- Phe duyet hoac gui yeu cau dieu chinh kem ghi chu y kien ro rang.

### 4.6. Bang dieu hanh tong hop (Dashboard) & Canh bao tu dong
- Thong ke truc quan tong so Nghi quyet, tong chi tieu, ty le bao cao, ty le tham tra dat yeu cau.
- Bieu do phan bo tien do thuc hien theo tung phong ban, linh vuc.
- Co che danh gia han chot tu dong (Cron job chay dinh ky):
  + Xanh (Binh thuong): Thoi gian con lai tren 7 ngay.
  + Vang (Can chu y): Thoi gian con lai tu 1 den 7 ngay.
  + Do (Qua han): Da vuot qua deadline ma chua hoan thanh.

---

## 5. YEU CAU HE THONG

- He dieu hanh: Windows 10/11, Ubuntu 20.04+, macOS.
- Node.js: Phien ban 18.x tro len (khuyen nghi 20.x hoac 22.x LTS).
- Python: Phien ban 3.9 tro len (dung cho module bop tach PyMuPDF).
- Tesseract OCR: Phien ban 5.x tro len, da cai dat goi ngon ngu tieng Viet (`vie.traineddata`).
- Tai khoan dich vu Firebase: Project Firebase da kich hoat Authentication va Cloud Firestore.
- Dich vu Cloudinary (tuy chon): Luu tru file PDF/minh chung.

---

## 6. HUONG DAN CAI DAT

### 6.1. Clone ma nguon
```bash
git clone https://github.com/PhanNgocVy2212499/HDND_CapXa.git
cd HDND_CapXa
```

### 6.2. Cai dat moi truong Python & OCR
1. Cai dat thu vien Python:
```bash
pip install pymupdf
```
2. Kiem tra Tesseract OCR:
- Tren Windows: Cai dat Tesseract vao thu muc mac dinh `C:\Program Files\Tesseract-OCR`.
- Goi du lieu ngon ngu tieng Viet `vie.traineddata` da duoc tich hop san trong du an tai `backend/tessdata/`. He thong se tu dong nhan dien qua bien moi truong `TESSDATA_PREFIX`.

### 6.3. Cai dat Backend
1. Chuyen vao thu muc backend:
```bash
cd backend
npm install
```
2. Cau hinh tep bien moi truong `backend/.env`:
```env
PORT=5000
CLIENT_URL=http://localhost:3000

# Firebase Admin SDK
FIREBASE_PROJECT_ID=ten-project-firebase
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@ten-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=ten-project.firebasestorage.app

# Che do luu tru file: 'cloudinary' hoac 'local' hoac 'firebase'
STORAGE_MODE=cloudinary
CLOUDINARY_CLOUD_NAME=ten_cloud
CLOUDINARY_API_KEY=key_cloud
CLOUDINARY_API_SECRET=secret_cloud
```

### 6.4. Cai dat Frontend
1. Chuyen vao thu muc frontend:
```bash
cd ../frontend
npm install
```
2. Cau hinh tep bien moi truong `frontend/.env`:
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

## 7. HUONG DAN VAN HANH VA SU DUNG

### 7.1. Khoi dong ung dung
1. Khoi dong Backend (cong 5000):
```bash
cd backend
npm run dev
```
2. Khoi dong Frontend (cong 3000):
```bash
cd frontend
npm run dev
```
Truy cap trinh duyet tai: `http://localhost:3000`

### 7.2. Danh sach tai khoan thu nghiem
He thong tich hop san cac tai khoan kiem thu tuong ung voi 4 vai tro (mat khau mac dinh: `123456`):
- Chuyen vien HDND: `chuyenvien@xa.gov.vn`
- Thuong truc HDND: `thuongtruc@xa.gov.vn`
- Don vi thuc hien (UBND xa): `ubnd@xa.gov.vn`
- Cac Ban HDND: `banhdnd@xa.gov.vn`

### 7.3. Kich ban van hanh mau (Walkthrough)

1. Soan thao Nghi quyet:
   - Dang nhap tai khoan `chuyenvien@xa.gov.vn`.
   - Vao the "Soan thao NQ" (`upload`).
   - Keo tha file PDF Nghi quyet hoac bam "Nap mau NQ 32 xa Chau Thanh".
   - Kiem tra thong tin OCR auto-fill, bam "Tao ban soan thao nghi quyet", sau do bam "Trinh Thuong truc ky ban hanh".

2. Ky ban hanh:
   - Dang nhap tai khoan `thuongtruc@xa.gov.vn`.
   - Vao the "Ky ban hanh / Xac nhan" (`approve`).
   - Xem lai file PDF goc, bam "Ky ban hanh nghi quyet", sau do bam "Chuyen sang Boc tach chi tieu".

3. Boc tach va Phan chi tieu:
   - Tai the "Boc tach & Phan chi tieu" (`tree`), chon Nghi quyet vua ky ban hanh.
   - Bam "Boc tach tu dong" de he thong tu phan tich cac Dieu/Khoan thanh cay chi tieu kem con so va phong ban.
   - Chinh sua thong tin neu can va bam "Luu boc tach chi tieu", tiep theo bam "Phan chi tieu ve cac ban".

4. Phe duyet giao viec:
   - Thuong truc HDND vao the "Ky ban hanh / Phe duyet", xac nhan deadline va don vi thuc hien cho tung chi tieu.

5. Bao cao tien do:
   - Dang nhap tai khoan `ubnd@xa.gov.vn`.
   - Vao the "Bao cao" (`report`), chon chi tieu can cap nhat, nhap so lieu, % hoan thanh va tai len file minh chung bat buoc. Bam "Gui bao cao".

6. Tham tra bao cao:
   - Dang nhap tai khoan `banhdnd@xa.gov.vn`.
   - Vao the "Tham tra" (`review`), kiem tra minh chung va xac nhan danh gia.

7. Theo doi giam sat:
   - Vao the "Tong quan" (`dashboard`) de xem he thong so sanh tien do thuc te voi chi tieu ke hoach tren bieu do thoi gian thuc.

---

## 8. CAU TRUC DU LIEU (DATABASE SCHEMA)

He thong to chuc du lieu tren Firebase Firestore gom 4 bo suu tap chinh:

1. `resolutions` (Nghi quyet):
   - `id`: Ma dinh danh.
   - `codeNumber`: So hieu van ban (vd: 32/NQ-HDND).
   - `title`: Trich yeu noi dung.
   - `signer`: Nguoi ky van ban.
   - `issuanceDate`: Ngay ban hanh (Timestamp).
   - `fileUrl`, `storagePath`: Duong dan luu tru file scan.
   - `status`: draft | pending_issue | issued | pending_distribution | distributed | pending_completion | completed.
   - `ocrRawText`: Toan bo van ban OCR da qua bo loc lam sach.

2. `indicators` (Chi tieu / Nhiem vu):
   - `id`: Ma chi tieu.
   - `resolutionId`: Lien ket Nghi quyet goc.
   - `parentId`: Ma chi tieu cap cha (null neu la goc).
   - `title`: Noi dung chi tieu.
   - `targetValue`: Con so ke hoach can dat.
   - `unit`: Don vi tinh (dong, %, bien che, cong trinh...).
   - `deadline`: Han chot hoan thanh.
   - `assignedDepartments`: Danh sach phong ban chu tri / phoi hop.
   - `status`: draft | pending_approval | assigned | in_progress | completed | overdue.

3. `progressReports` (Bao cao tien do):
   - `id`: Ma bao cao.
   - `indicatorId`: Lien ket chi tieu.
   - `actualValue`: Gia tri thuc te dat duoc.
   - `progressPercentage`: Ty le hoan thanh (0 - 100%).
   - `evidenceUrl`: Duong dan file minh chung bat buoc.
   - `status`: submitted | approved | rejected.

4. `reviews` (Ket qua tham tra):
   - `id`: Ma tham tra.
   - `progressReportId`: Lien ket bao cao.
   - `reviewerUid`, `reviewerEmail`: Nguoi thuc hien tham tra.
   - `status`: passed | need_clarification.
   - `comment`: Y kien danh gia cua Ban HDND.
