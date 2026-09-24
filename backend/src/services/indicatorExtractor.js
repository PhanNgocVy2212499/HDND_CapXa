/**
 * services/indicatorExtractor.js
 * Tự tách chỉ tiêu từ văn bản OCR của nghị quyết → khỏi nhập tay ở Cây chỉ tiêu.
 * Heuristic cho văn bản hành chính tiếng Việt: Điều / Khoản / 1. / 1.1 / a) / gạch đầu dòng.
 * Pure JS (không phụ thuộc firebase) để dễ test: node -e "require(...).extractIndicatorsFromText(...)".
 */

const MAX_ITEMS = 40;
const TITLE_MAX = 200;
const MIN_LINE = 12;

// Dòng cơ sở pháp lý / quốc hiệu / nơi nhận... — không phải chỉ tiêu
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
  /^nơi\s*nhận/i,
  /chủ\s*tịch/i,
  /thư\s*ký/i,
  /\btm\./i,
  /đã\s*ký/i,
  /căn\s*cứ/i,
];

const LINE_PATTERNS = [
  { re: /^đi[eê]u\s+\d+\s*[:.\-–]?\s*(.+)$/i, depthOf: () => 0 },
  { re: /^dieu\s+\d+\s*[:.\-–]?\s*(.+)$/i, depthOf: () => 0 }, // OCR mất dấu
  { re: /^(\d+(?:\.\d+)+)\s*[.)\]:\-–]?\s*(.+)$/, depthOf: (m) => m[1].split('.').length - 1 },
  { re: /^kho[ảa]n\s+(\d+)\s*[:.\-–]?\s*(.+)$/i, depthOf: () => 1 },
  { re: /^(\d+)\s*[.)\]]\s*(.+)$/, depthOf: () => 0 },
  { re: /^([a-zA-ZđĐ])\s*[.)\]]\s*(.+)$/, depthOf: () => 1 },
  { re: /^[-•*–]\s*(.+)$/, depthOf: () => 1 },
];

function normNumber(raw) {
  return Number(String(raw).replace(/\./g, '').replace(',', '.'));
}

function normUnit(u) {
  const s = String(u || '').toLowerCase();
  if (s === '%') return '%';
  if (s === 'tỷ' || s === 'tỉ' || s === 'ty') return 'tỷ đồng';
  if (s === 'triệu' || s === 'trieu') return 'triệu đồng';
  if (s === 'người' || s === 'nguoi') return 'người';
  if (s === 'hộ' || s === 'ho') return 'hộ';
  return s || '%';
}

// Tìm con số kế hoạch trong tiêu đề: ưu tiên số có đơn vị/%, bỏ qua số năm đứng một mình
function parseTarget(text) {
  const re = /(\d+(?:[.,]\d+)?)\s*(%|hộ|ho\b|người|nguoi|km|tỷ|tỉ|ty\b|triệu|trieu|ha|suất|vụ|xã|trường)?/gi;
  const cands = [];
  let m;
  while ((m = re.exec(text)) !== null) cands.push(m);
  const pick =
    cands.find((c) => c[2]) ||
    cands.find((c) => {
      const v = normNumber(c[1]);
      return !(v >= 1900 && v <= 2100);
    }) ||
    cands[0];
  if (!pick) return { targetValue: 100, unit: '%' };
  const value = normNumber(pick[1]);
  return {
    targetValue: Number.isFinite(value) ? value : 100,
    unit: normUnit(pick[2]),
  };
}

function extractIndicatorsFromText(rawText, opts = {}) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= MIN_LINE);

  const items = [];
  for (const line of lines) {
    if (SKIP_PATTERNS.some((re) => re.test(line))) continue;
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
    title = title.slice(0, TITLE_MAX);
    const { targetValue, unit } = parseTarget(title);
    items.push({ depth, title, targetValue, unit });
    if (items.length >= MAX_ITEMS) break;
  }

  // Dựng cây phân cấp theo depth (dạng input của saveNodeRecursive)
  const root = [];
  const stack = [];
  for (const it of items) {
    const node = {
      title: it.title,
      targetValue: it.targetValue,
      unit: it.unit,
      frequency: 'quarterly',
      deadline: opts.defaultDeadline,
      assignedDepartments: [],
      children: [],
    };
    while (stack.length && stack[stack.length - 1].depth >= it.depth) stack.pop();
    if (!stack.length) root.push(node);
    else stack[stack.length - 1].node.children.push(node);
    stack.push({ depth: it.depth, node });
  }
  return { tree: root, total: items.length };
}

module.exports = { extractIndicatorsFromText };
