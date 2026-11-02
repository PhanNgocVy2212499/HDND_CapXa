export const DEPTS = [
  { id: "ubnd-xa", name: "UBND xã (Chỉ đạo chung)" },
  { id: "phong-kinh-te", name: "Bộ phận Kinh tế xã (Địa chính - Nông nghiệp - XD)" },
  { id: "van-hoa-xa-hoi", name: "Bộ phận Văn hóa - Xã hội xã (LĐTB&XH - GD)" },
  { id: "tai-chinh", name: "Công chức Tài chính - Kế toán xã" },
  { id: "dia-chinh", name: "Công chức Địa chính - Xây dựng - Môi trường" },
  { id: "tu-phap", name: "Công chức Tư pháp - Hộ tịch" },
  { id: "van-phong", name: "Văn phòng HĐND - UBND xã" },
  { id: "ban-ap", name: "Ban Nhân dân các ấp / khóm" },
  { id: "truong-hoc", name: "Đơn vị trường học / Trạm y tế trực thuộc" },
];

export const FREQS = [
  { id: "monthly", name: "Hàng tháng" },
  { id: "quarterly", name: "Hàng quý" },
  { id: "annual", name: "Hàng năm" },
];

export const ROLES = [
  { id: "primary", name: "Chủ trì" },
  { id: "cooperate", name: "Phối hợp" },
];

export const deptName = (id) => DEPTS.find((d) => d.id === id)?.name ?? id;
export const freqName = (id) => FREQS.find((f) => f.id === id)?.name ?? id;

export function formatVND(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "0";
  return n.toLocaleString("vi-VN");
}

export function daysLeft(deadline) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

/** Khớp logic cron backend: red = quá hạn, yellow <= 7 ngày, còn lại green */
export function alertLevelFor(deadline) {
  const d = daysLeft(deadline);
  if (d === null) return "green";
  if (d < 0) return "red";
  if (d <= 7) return "yellow";
  return "green";
}

export const cx = (...parts) => parts.filter(Boolean).join(" ");

export const RESOLUTION_STATUS_META = {
  draft: { label: "Bản nháp", tone: "slate" },
  pending_ban_review: { label: "Chờ Ban HĐND thẩm tra", tone: "amber" },
  revision_requested: { label: "Ban HĐND yêu cầu sửa", tone: "red" },
  pending_approval: { label: "Ban HĐND đã thông qua (Chờ duyệt)", tone: "sky" },
  approved: { label: "Thường trực HĐND đã duyệt", tone: "emerald" },
  completed: { label: "Hoàn thành", tone: "emerald" },
};

export const resolutionStatusLabel = (s) => RESOLUTION_STATUS_META[s]?.label || s || "—";
export const resolutionStatusTone = (s) => RESOLUTION_STATUS_META[s]?.tone || "slate";

// Mẫu chỉ tiêu chuẩn hóa theo Nghị quyết số 32/NQ-HĐND xã Châu Thành (Bổ sung dự toán ngân sách)
export const SAMPLE_COMMUNE_TREE = [
  {
    key: "sample-1",
    parent: null,
    title: "Phòng Kinh tế (Bộ phận Kinh tế - Địa chính xã): Tổng số 3.121.000.000 đồng (Nguồn dự phòng ngân sách xã)",
    target: "3121000000",
    unit: "đồng",
    freq: "quarterly",
    deadline: "2026-12-31",
    dept: "phong-kinh-te",
    role: "primary",
  },
  {
    key: "sample-1-1",
    parent: "sample-1",
    title: "Sửa chữa, cải tạo các trường mầm non, tiểu học trên địa bàn xã Châu Thành (Tuổi Xanh, TH Châu Thành, TH Thanh Mỹ B)",
    target: "2571000000",
    unit: "đồng",
    freq: "quarterly",
    deadline: "2026-11-30",
    dept: "phong-kinh-te",
    role: "primary",
  },
  {
    key: "sample-1-2",
    parent: "sample-1",
    title: "Hệ thống thoát nước chống ngập úng khu dân cư ấp Phú Mỹ và Trường tiểu học Thanh Mỹ B (Phân hiệu Giồng Trôm)",
    target: "550000000",
    unit: "đồng",
    freq: "quarterly",
    deadline: "2026-12-15",
    dept: "phong-kinh-te",
    role: "primary",
  },
  {
    key: "sample-2",
    parent: null,
    title: "Phòng Văn hóa - Xã hội (Bộ phận VH-XH xã): Tổng số 3.257.572.500 đồng (Nguồn kết dư ngân sách xã)",
    target: "3257572500",
    unit: "đồng",
    freq: "monthly",
    deadline: "2026-12-31",
    dept: "van-hoa-xa-hoi",
    role: "primary",
  },
  {
    key: "sample-2-1",
    parent: "sample-2",
    title: "Chi trả chế độ đối với người hoạt động không chuyên trách ở ấp nghỉ thôi việc theo Nghị quyết 28/2026/NQ-HĐND tỉnh",
    target: "3257572500",
    unit: "đồng",
    freq: "monthly",
    deadline: "2026-12-31",
    dept: "van-hoa-xa-hoi",
    role: "primary",
  },
];
