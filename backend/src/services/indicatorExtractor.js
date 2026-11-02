/**
 * services/indicatorExtractor.js
 * Tự tách chỉ tiêu từ văn bản OCR của Nghị quyết HĐND cấp xã.
 * Tối ưu hóa đặc thù Nghị quyết HĐND cấp xã (như NQ số 32/NQ-HĐND về bổ sung dự toán ngân sách,
 * phát triển kinh tế - xã hội, đầu tư cơ sở hạ tầng trường học, ấp/khóm...).
 */

const MAX_ITEMS = 40;
const TITLE_MAX = 250;
const MIN_LINE = 10;

// Dòng cơ sở pháp lý / quốc hiệu / điều khoản giám sát chung
const SKIP_PATTERNS = [
  /cộng\s*hòa/i,
  /quốc\s*huy/i,
  /độc\s*lập/i,
  /tự\s*do/i,
  /hạnh\s*phúc/i,
  /^nghị\s*quyết\b/i,
  /^tờ\s*trình/i,
  /^quyết\s*định/i,
  /^kế\s*hoạch/i,
  /chủ\s*tịch/i,
  /thư\s*ký/i,
  /\btm\./i,
  /đã\s*ký/i,
  /căn\s*cứ/i,
  /xét\s*tờ\s*trình/i,
  /báo\s*cáo\s*thẩm\s*tra/i,
  /ý\s*kiến\s*thảo\s*luận/i,
  /có\s*hiệu\s*lực\s*kể\s*từ\s*ngày/i,
  /thông\s*qua\s*ngày\s+\d+/i,
  /tổ\s*chức\s*triển\s*khai.*?giám\s*sát/i, // Điều 2 giám sát chung của HĐND xã
  /bảng\s*tổng\s*hợp\s*kinh\s*phí/i,       // Tiêu đề phụ lục
  /nguồn\s*kinh\s*phí\s*thực\s*hiện\s*:?$/i, // Tiêu đề nhóm không có số tiền
  /^[-•*–+]?\s*(tt\.|sở\s*tài\s*chính|ubmttq|đb\s*hđnd|ủy\s*viên\s*ubnd|phòng\s*nghiệp\s*vụ.*?kbnn|lđvp|lưu\s*:?\s*vt)/i, // Nơi nhận văn bản
];

const LINE_PATTERNS = [
  { re: /^đi[eê]u\s+\d+\s*[:.\-–]?\s*(.+)$/i, depthOf: () => 0 },
  { re: /^dieu\s+\d+\s*[:.\-–]?\s*(.+)$/i, depthOf: () => 0 }, // OCR mất dấu
  { re: /^(\d+(?:\.\d+)+)\s*[.)\]:\-–]?\s*(.+)$/, depthOf: (m) => m[1].split('.').length - 1 },
  { re: /^kho[ảa]n\s+(\d+)\s*[:.\-–]?\s*(.+)$/i, depthOf: () => 1 },
  { re: /^(\d+)\s*[.)\]]\s*(.+)$/, depthOf: () => 0 },
  { re: /^([a-zA-ZđĐ])\s*[.)\]]\s*(.+)$/, depthOf: () => 1 },
  { re: /^[-•*–+]\s*(.+)$/, depthOf: () => 1 },
];

function normNumber(raw) {
  if (!raw) return 0;
  const str = String(raw).trim();
  // Nếu có dạng 6.378.572.500 (phân cách hàng nghìn bằng dấu chấm)
  if (/\d+\.\d{3}/.test(str)) {
    return Number(str.replace(/\./g, '').replace(',', '.'));
  }
  return Number(str.replace(/,/g, '.'));
}

function normUnit(u) {
  const s = String(u || '').toLowerCase().trim();
  if (s === '%') return '%';
  if (s === 'tỷ' || s === 'tỉ' || s === 'ty') return 'tỷ đồng';
  if (s === 'triệu' || s === 'trieu' || s === 'tr') return 'triệu đồng';
  if (s === 'đồng' || s === 'dong' || s === 'đ' || s === 'vnd' || s === 'vnđ') return 'đồng';
  if (s === 'người' || s === 'nguoi') return 'người';
  if (s === 'hộ' || s === 'ho') return 'hộ';
  if (s === 'công trình' || s === 'cong trinh' || s === 'hạng mục' || s === 'hang muc') return 'công trình';
  if (s === 'trường' || s === 'truong') return 'trường';
  if (s === 'ấp' || s === 'ap' || s === 'khóm' || s === 'khom' || s === 'thôn') return 'ấp/khóm';
  return s || 'đồng';
}

// Tìm con số kế hoạch/kinh phí trong văn bản chỉ tiêu cấp xã
function parseTarget(text) {
  const re = /(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)\s*(đồng|dong|vnđ|vnd|đ\b|%|hộ|ho\b|người|nguoi|km|tỷ|tỉ|ty\b|triệu|trieu|ha|suất|vụ|xã|trường|công trình|hạng mục|ấp|khóm)?/gi;
  const cands = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const val = normNumber(m[1]);
    const hasUnit = Boolean(m[2]);
    if (!hasUnit && val >= 1990 && val <= 2099) continue;
    cands.push(m);
  }

  const pick =
    cands.find((c) => c[2] && normUnit(c[2]) !== '') ||
    cands.find((c) => normNumber(c[1]) > 0) ||
    cands[0];

  if (!pick) return { targetValue: 100, unit: '%' };
  const value = normNumber(pick[1]);
  return {
    targetValue: Number.isFinite(value) ? value : 100,
    unit: normUnit(pick[2]),
  };
}

// Tự động nhận diện bộ phận/công chức phụ trách cấp xã theo từ khóa
function inferDepartment(text) {
  const s = String(text || '').toLowerCase();
  // Kinh tế / Địa chính / Xây dựng / Thoát nước / Trường học
  if (/kinh\s*tế|sửa\s*chữa|cải\s*tạo|thoát\s*nước|ngập\s*úng|sân\s*đường|hàng\s*rào|trường|xây\s*dựng|giao\s*thông|hạ\s*tầng|mầm\s*non|tiểu\s*học/.test(s)) {
    return { departmentId: 'phong-kinh-te', departmentName: 'Bộ phận Kinh tế xã (Địa chính - XD)', role: 'primary' };
  }
  // Văn hóa - Xã hội / Chế độ / Cán bộ không chuyên trách ấp
  if (/văn\s*hóa|xã\s*hội|chế\s*độ|nghỉ\s*việc|không\s*chuyên\s*trách|ấp|khóm|y\s*tế|lao\s*động|thương\s*binh/.test(s)) {
    return { departmentId: 'van-hoa-xa-hoi', departmentName: 'Bộ phận Văn hóa - Xã hội xã', role: 'primary' };
  }
  // Ngân sách / Tài chính / Dự toán
  if (/tài\s*chính|ngân\s*sách|kết\s*dư|dự\s*phòng|chi\s*ngân\s*sách/.test(s)) {
    return { departmentId: 'tai-chinh', departmentName: 'Công chức Tài chính - Kế toán xã', role: 'primary' };
  }
  if (/địa\s*chính|đất\s*đai|môi\s*trường|giải\s*phóng\s*mặt\s*bằng/.test(s)) {
    return { departmentId: 'dia-chinh', departmentName: 'Công chức Địa chính - Xây dựng', role: 'primary' };
  }
  if (/tư\s*pháp|hộ\s*tịch|pháp\s*chế/.test(s)) {
    return { departmentId: 'tu-phap', departmentName: 'Công chức Tư pháp - Hộ tịch', role: 'primary' };
  }
  return { departmentId: 'ubnd-xa', departmentName: 'UBND xã (Chỉ đạo chung)', role: 'primary' };
}

function extractIndicatorsFromText(rawText, opts = {}) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= MIN_LINE);

  const items = [];
  let inNoiNhan = false;

  for (const line of lines) {
    // Bỏ qua toàn bộ khối "Nơi nhận: ... đến Chủ tịch / Phụ lục"
    if (/nơi\s*nhận/i.test(line)) {
      inNoiNhan = true;
      continue;
    }
    if (inNoiNhan) {
      if (/phụ\s*lục|quyết\s*nghị|^\d+\.\s*phòng|điều\s*\d/i.test(line)) {
        inNoiNhan = false;
      } else {
        continue;
      }
    }

    if (SKIP_PATTERNS.some((re) => re.test(line))) continue;

    // Bỏ qua dòng kết thúc bằng dấu hai chấm mà không chứa con số (thường là tiêu đề nhóm)
    if (/:\s*$/.test(line) && !/\d/.test(line)) continue;

    let depth = -1;
    let title = '';
    for (const p of LINE_PATTERNS) {
      const m = line.match(p.re);
      if (m) {
        depth = p.depthOf(m);
        title = (m[m.length - 1] || '').trim();
        break;
      }
    }
    if (depth < 0 || !title || title.length < 8) continue;

    // Phân tích con số trên toàn bộ dòng trước khi cắt ngắn title
    const { targetValue, unit } = parseTarget(title);
    const dept = inferDepartment(title);
    title = title.slice(0, TITLE_MAX);

    items.push({ depth, title, targetValue, unit, dept });
    if (items.length >= MAX_ITEMS) break;
  }

  // Dựng cây phân cấp theo depth
  const root = [];
  const stack = [];
  for (const it of items) {
    let assignedDept = it.dept;
    if (stack.length && (it.dept.departmentId === 'ubnd-xa' || it.dept.departmentId === 'tai-chinh')) {
      const parentDept = stack[stack.length - 1].node.assignedDepartments[0];
      if (parentDept && parentDept.departmentId !== 'ubnd-xa') {
        assignedDept = parentDept;
      }
    }

    const node = {
      title: it.title,
      targetValue: it.targetValue,
      unit: it.unit,
      frequency: it.unit === 'đồng' || it.unit === 'triệu đồng' ? 'quarterly' : 'monthly',
      deadline: opts.defaultDeadline || new Date().toISOString().slice(0, 10),
      assignedDepartments: [assignedDept],
      children: [],
    };
    while (stack.length && stack[stack.length - 1].depth >= it.depth) stack.pop();
    if (!stack.length) root.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ depth: it.depth, node });
  }
  return { tree: root, total: items.length };
}

module.exports = { extractIndicatorsFromText, inferDepartment };
