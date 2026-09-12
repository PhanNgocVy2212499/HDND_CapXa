/**
 * services/ocrService.js
 * Chiến lược OCR cho văn bản hành chính Việt Nam:
 *  1. PDF text-based  -> dùng pdf-parse (nhanh, rẻ, chính xác cao).
 *  2. Ảnh/scan/photo -> dùng Google Cloud Vision documentTextDetection.
 * Sau đó dùng Regex tiếng Việt để trích: Số hiệu, Ngày ban hành, Trích yếu, Người ký.
 */
const vision = require('@google-cloud/vision');
const pdfParse = require('pdf-parse');

const visionClient = new vision.ImageAnnotatorClient();

/**
 * Trích text thô từ buffer.
 * @returns {Promise<{ text: string, confidence: number, engine: 'pdf-parse'|'vision' }>}
 */
async function extractText(buffer, mimetype) {
  // PDF: thử pdf-parse trước
  if (mimetype === 'application/pdf') {
    try {
      const data = await pdfParse(buffer);
      if (data.text && data.text.trim().length > 50) {
        return { text: data.text, confidence: 0.95, engine: 'pdf-parse' };
      }
    } catch (e) {
      console.warn('[ocr] pdf-parse failed, fallback to Vision:', e.message);
    }
    // PDF scan -> Vision (gửi bytes, Vision tự xử lý trang đầu)
    const [result] = await visionClient.documentTextDetection({ image: { content: buffer } });
    const annotation = result.fullTextAnnotation;
    return {
      text: annotation?.text || '',
      confidence: 0.85,
      engine: 'vision',
    };
  }

  // Ảnh PNG/JPG -> Vision
  const [result] = await visionClient.documentTextDetection({ image: { content: buffer } });
  return {
    text: result.fullTextAnnotation?.text || '',
    confidence: 0.85,
    engine: 'vision',
  };
}

/** "ngày 15 tháng 8 năm 2026" -> Date(2026, 7, 15) */
function parseVietnameseDate(text) {
  const m = text.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const m2 = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m2) return new Date(Number(m2[3]), Number(m2[2]) - 1, Number(m2[1]));
  return new Date(); // fallback: hôm nay, chuyên viên sửa tay
}

/** Tách text OCR thành mảng dòng đã chuẩn hóa (bỏ dòng trống, gộp khoảng trắng) */
function normLines(rawText) {
  return (rawText || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

const HEADER_KEYWORDS =
  /(cộng hòa|độc lập|tự do|hạnh phúc|hội đồng nhân dân|ủy ban nhân dân|nghị quyết|quyết nghị|nơi nhận|căn cứ|lưu:|số\s*:|chủ tịch|phó chủ tịch|^kt\.?$|^tm\.?$|thay mặt|chữ ký|ký tên|đóng dấu|người ký)/i;

function looksLikeName(line) {
  const clean = line.split(/[-–:]/).pop().trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (/[0-9@#%\/\\()«»";]/.test(clean)) return false;
  if (HEADER_KEYWORDS.test(clean)) return false;
  // Mỗi từ viết hoa đầu từ, hoặc cả dòng IN HOA (bản scan hay thế)
  return words.every((w) => /^[A-ZÀ-ỸĐ][a-zà-ỹđ.]*\.?$/.test(w) || /^[A-ZÀ-ỸĐ.]{2,}$/.test(w));
}

function titleCaseName(line) {
  const clean = line.split(/[-–:]/).pop().trim();
  return clean
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Người ký: nằm sau khối "TM. HĐND / KT. CHỦ TỊCH / PHÓ CHỦ TỊCH" ở cuối văn bản */
function extractSigner(lines, rawText) {
  // Cách 1: khối ký tên cổ điển
  const m = rawText
    .replace(/\r/g, '')
    .match(/TM\.\s*HỘI ĐỒNG NHÂN DÂN[\s\S]{0,150}?(KT\.\s*)?(PHÓ\s+)?CHỦ TỊCH[^\n]*\n+([^\n]+)/i);
  if (m && looksLikeName(m[3])) return titleCaseName(m[3]);

  // Cách 2: dòng CHỦ TỊCH cuối cùng -> tên nằm cùng dòng hoặc 1-5 dòng sau
  let anchor = -1;
  lines.forEach((l, i) => {
    if (/(PHÓ\s+)?CHỦ TỊCH/i.test(l)) anchor = i;
  });
  if (anchor >= 0) {
    const sameLine = lines[anchor].replace(/.*(PHÓ\s+)?CHỦ TỊCH/i, '').trim();
    if (sameLine && looksLikeName(sameLine)) return titleCaseName(sameLine);
    for (let i = anchor + 1; i < Math.min(lines.length, anchor + 6); i++) {
      if (looksLikeName(lines[i])) return titleCaseName(lines[i]);
    }
  }
  return '';
}

/** Trích yếu = TÊN đầy đủ của nghị quyết: "Nghị quyết về việc <nội dung>" */
function extractTitle(lines) {
  const STOP =
    /^(căn cứ|quyết nghị|điều\s*\d|chương\s+[ivx\d]|mục\s*\d|nơi nhận|tm\.|kt\.|(phó\s+)?chủ tịch|hội đồng nhân dân|kính gửi|người ký)/i;
  const collect = (startIdx, first) => {
    const parts = first ? [first] : [];
    for (let i = startIdx; i < lines.length && parts.length < 6; i++) {
      if (STOP.test(lines[i])) break;
      parts.push(lines[i]);
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  };

  let body = '';
  // Trường hợp 1: có mốc "Về việc / V/v"
  let idx = lines.findIndex((l) => /^(V\/v|v\/v|về việc)\b/i.test(l));
  if (idx === -1) idx = lines.findIndex((l) => /(V\/v|về việc)\s*:/i.test(l));
  if (idx >= 0) {
    const first = lines[idx].replace(/^(V\/v|v\/v|về việc)\s*:?\s*/i, '').trim();
    body = collect(idx + 1, first);
  } else {
    // Trường hợp 2: không có "Về việc" — lấy nội dung ngay sau dòng "NGHỊ QUYẾT"
    const hIdx = lines.findIndex((l) => /^nghị quyết\b/i.test(l));
    if (hIdx >= 0) {
      const sameLine = lines[hIdx].replace(/^nghị quyết\s*:?\s*/i, '').trim();
      // "NGHỊ QUYẾT Về việc ..." nằm cùng 1 dòng
      const m = sameLine.match(/(?:về việc|v\/v)\s*:?\s*(.+)/i);
      const first = m ? m[1].trim() : sameLine;
      body = collect(hIdx + 1, first);
    }
  }
  if (!body) {
    // Fallback: dòng IN HOA dài đầu tiên (bỏ quốc hiệu)
    const upper = lines.find(
      (l) => l.length > 20 && l === l.toUpperCase() && !/(CỘNG HÒA|ĐỘC LẬP|HẠNH PHÚC)/.test(l)
    );
    body = (upper || '').trim();
  }
  if (!body) return '';
  // Chuẩn hóa thành tên đầy đủ: "Nghị quyết về việc ..."
  if (!/^nghị quyết/i.test(body)) {
    body = `Nghị quyết về việc ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
  }
  return body.slice(0, 500);
}

function extractFields(rawText) {
  const text = (rawText || '').replace(/\r/g, '');
  const lines = normLines(rawText);
  // Số hiệu: "Số: 05/2026/NQ-HĐND" hoặc "Số 12/NQ-HĐND"
  const codeMatch =
    text.match(/Số\s*:?\s*(\d+\s*\/\s*\d{4}\s*\/\s*NQ-HĐND)/i) ||
    text.match(/(\d+\s*\/\s*NQ-HĐND)/i);
  const codeNumber = codeMatch ? codeMatch[1].replace(/\s+/g, '') : '';

  let title = extractTitle(lines);
  if (!title) title = 'Nghị quyết HĐND (chờ hoàn thiện trích yếu)';

  return {
    codeNumber,
    title,
    issuanceDate: parseVietnameseDate(text),
    signer: extractSigner(lines, rawText),
  };
}

/**
 * Hàm tổng hợp cho Controller: buffer -> { fields, ocrRawText, confidence, engine }
 */
async function ocrResolutionFile(buffer, mimetype) {
  const { text, confidence, engine } = await extractText(buffer, mimetype);
  if (!text || text.trim().length < 10) {
    throw new Error('OCR không trích xuất được nội dung. Hãy upload file rõ nét hơn.');
  }
  const out = {
    fields: extractFields(text),
    ocrRawText: text.slice(0, 20000), // giới hạn để không phình document
    confidence,
    engine,
  };
  console.info('[ocr] extracted:', {
    engine,
    codeNumber: out.fields.codeNumber || '(trống)',
    titleLen: out.fields.title.length,
    signer: out.fields.signer || '(trống)',
  });
  return out;
}

module.exports = { ocrResolutionFile, extractFields, parseVietnameseDate };
