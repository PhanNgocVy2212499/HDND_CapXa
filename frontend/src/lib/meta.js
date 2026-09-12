export const DEPTS = [
  { id: "ubnd-xa", name: "UBND xã" },
  { id: "dia-chinh", name: "Công chức Địa chính" },
  { id: "tai-chinh", name: "Công chức Tài chính" },
  { id: "tu-phap", name: "Công chức Tư pháp" },
  { id: "van-phong", name: "Văn phòng HĐND-UBND" },
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
