/**
 * services/docExportService.js
 * Tạo file Word (.docx) bảng phân khai chỉ tiêu Nghị quyết HĐND cấp xã
 * Tuân thủ quy chuẩn thể thức văn bản hành chính Việt Nam (Nghị định 30/2020/NĐ-CP)
 * - Phông chữ: Times New Roman
 * - Cỡ chữ bình thường: 13 pt (size: 26 half-points)
 * - Cỡ chữ tiêu đề: 15 pt (size: 30 half-points)
 * - Giãn dòng: 1.5 dòng (line: 360 twips, lineRule: auto)
 * - Căn lề hành chính khổ A4: Trên 20mm, Dưới 20mm, Trái 30mm, Phải 15mm
 */
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
  LineRuleType,
  convertMillimetersToTwip,
} = require('docx');

const FONT_FAMILY = 'Times New Roman';
// docx size tính bằng half-point: 1 pt = 2 units
const SIZE_NORMAL = 26; // 13 pt (chuẩn văn bản hành chính)
const SIZE_TITLE = 30;  // 15 pt (tiêu đề theo yêu cầu)
const SIZE_NOTE = 24;   // 12 pt (ghi chú / nơi nhận)
const SIZE_SMALL = 22;  // 11 pt (các dòng danh mục nơi nhận)

// Giãn dòng 1.5 line (240 * 1.5 = 360 twips)
const LINE_SPACING_1_5 = {
  line: 360,
  lineRule: LineRuleType.AUTO,
};

const DEPT_NAMES = {
  'ubnd-xa': 'UBND xã (Chỉ đạo chung)',
  'phong-kinh-te': 'Bộ phận Kinh tế xã (Địa chính - Nông nghiệp - XD)',
  'van-hoa-xa-hoi': 'Bộ phận Văn hóa - Xã hội xã (LĐTB&XH - GD)',
  'tai-chinh': 'Công chức Tài chính - Kế toán xã',
  'dia-chinh': 'Công chức Địa chính - Xây dựng - Môi trường',
  'tu-phap': 'Công chức Tư pháp - Hộ tịch',
  'van-phong': 'Văn phòng HĐND - UBND xã',
  'ban-ap': 'Ban Nhân dân các ấp / khóm',
  'truong-hoc': 'Đơn vị trường học / Trạm y tế trực thuộc',
};

const FREQ_NAMES = {
  monthly: 'Hàng tháng',
  quarterly: 'Hàng quý',
  annual: 'Hàng năm',
};

function formatVND(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n === 0) return '0';
  return n.toLocaleString('vi-VN');
}

/**
 * Tạo buffer file Word (.docx) chứa bảng cây chỉ tiêu
 * @param {Object} resolution Thông tin nghị quyết
 * @param {Array} indicators Danh sách chỉ tiêu đã phân cấp
 * @returns {Promise<Buffer>}
 */
async function generateResolutionDocx(arg1, arg2 = []) {
  let resolution = arg1 || {};
  let indicators = Array.isArray(arg2) ? arg2 : [];
  if (arg1 && typeof arg1 === 'object' && arg1.resolution) {
    resolution = arg1.resolution;
    indicators = Array.isArray(arg1.indicators) ? arg1.indicators : indicators;
  }
  const codeNumber = resolution.codeNumber || 'NQ-HĐND';
  const title = resolution.title || 'Nghị quyết HĐND cấp xã';
  const issuanceDate = resolution.issuanceDate
    ? new Date(resolution.issuanceDate.toDate ? resolution.issuanceDate.toDate() : resolution.issuanceDate)
    : new Date();
  const day = issuanceDate.getDate();
  const month = issuanceDate.getMonth() + 1;
  const year = issuanceDate.getFullYear();
  const signer = resolution.signer || 'Chủ tịch HĐND xã';

  // Độ rộng các cột (tổng ~ 9.350 DXA ~ 165mm, vừa khít khổ A4 trừ lề trái 30mm, phải 15mm)
  const COL_WIDTHS = {
    stt: 650,      // ~1.1 cm
    title: 3250,   // ~5.7 cm
    target: 1350,  // ~2.4 cm
    unit: 750,     // ~1.3 cm
    freq: 950,     // ~1.7 cm
    deadline: 1000,// ~1.8 cm
    dept: 1400,    // ~2.5 cm
  };

  // 1. Tiêu đề bảng chỉ tiêu (Header Table Row)
  const headerRows = [
    new TableRow({
      tableHeader: true,
      children: [
        cellHeader('STT', COL_WIDTHS.stt),
        cellHeader('Nội dung chỉ tiêu / Hạng mục nhiệm vụ', COL_WIDTHS.title),
        cellHeader('Chỉ tiêu KH', COL_WIDTHS.target),
        cellHeader('Đơn vị', COL_WIDTHS.unit),
        cellHeader('Chu kỳ', COL_WIDTHS.freq),
        cellHeader('Thời hạn', COL_WIDTHS.deadline),
        cellHeader('Đơn vị chủ trì thực hiện', COL_WIDTHS.dept),
      ],
    }),
  ];

  // 2. Chuyển đổi danh sách indicators thành các dòng bảng
  const dataRows = indicators.map((ind, index) => {
    const isParent = !ind.parentId;
    const depth = ind.depth || (isParent ? 0 : 1);
    const indentPrefix = depth > 0 ? '     '.repeat(depth) + '↳ ' : '';

    const deptId = ind.dept || ind.assignedDepartments?.[0]?.departmentId || 'ubnd-xa';
    const deptText = ind.assignedDepartments?.[0]?.departmentName || DEPT_NAMES[deptId] || deptId;
    const freqText = FREQ_NAMES[ind.frequency] || ind.frequency || 'Hàng quý';
    const deadlineText = ind.deadline
      ? new Date(ind.deadline).toLocaleDateString('vi-VN')
      : '31/12/' + year;

    let targetText = String(ind.targetValue ?? ind.target ?? '—');
    if (Number(ind.targetValue) >= 1000) {
      targetText = formatVND(ind.targetValue);
    }

    return new TableRow({
      children: [
        cellText(String(index + 1), COL_WIDTHS.stt, AlignmentType.CENTER, isParent),
        cellText(indentPrefix + (ind.title || '—'), COL_WIDTHS.title, AlignmentType.LEFT, isParent),
        cellText(targetText, COL_WIDTHS.target, AlignmentType.RIGHT, isParent),
        cellText(ind.unit || 'đồng', COL_WIDTHS.unit, AlignmentType.CENTER, false),
        cellText(freqText, COL_WIDTHS.freq, AlignmentType.CENTER, false),
        cellText(deadlineText, COL_WIDTHS.deadline, AlignmentType.CENTER, false),
        cellText(deptText, COL_WIDTHS.dept, AlignmentType.LEFT, false),
      ],
    });
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [...headerRows, ...dataRows],
  });

  // 3. Xây dựng toàn bộ tài liệu Word
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FAMILY,
            size: SIZE_NORMAL, // Mặc định cỡ chữ 13 pt
          },
          paragraph: {
            spacing: LINE_SPACING_1_5, // Mặc định giãn dòng 1.5 line
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            // Chuẩn căn lề văn bản hành chính theo Nghị định 30/2020/NĐ-CP:
            // Top: 20-25mm, Bottom: 20-25mm, Left: 30-35mm, Right: 15-20mm
            margin: {
              top: convertMillimetersToTwip(20),    // 20 mm
              bottom: convertMillimetersToTwip(20), // 20 mm
              left: convertMillimetersToTwip(30),   // 30 mm
              right: convertMillimetersToTwip(15),  // 15 mm
            },
          },
        },
        children: [
          // Header 2 cột: Cơ quan ban hành (trái) - Quốc hiệu & Tiêu ngữ (phải)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 45, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: LINE_SPACING_1_5,
                        children: [
                          new TextRun({
                            text: 'HỘI ĐỒNG NHÂN DÂN CẤP XÃ',
                            bold: true,
                            font: FONT_FAMILY,
                            size: SIZE_NORMAL, // 13 pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: LINE_SPACING_1_5,
                        children: [
                          new TextRun({
                            text: `Số: ${codeNumber}`,
                            font: FONT_FAMILY,
                            size: SIZE_NORMAL, // 13 pt
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 55, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: LINE_SPACING_1_5,
                        children: [
                          new TextRun({
                            text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
                            bold: true,
                            font: FONT_FAMILY,
                            size: SIZE_NORMAL, // 13 pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: LINE_SPACING_1_5,
                        children: [
                          new TextRun({
                            text: 'Độc lập - Tự do - Hạnh phúc',
                            bold: true,
                            font: FONT_FAMILY,
                            size: SIZE_NORMAL, // 13 pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: LINE_SPACING_1_5,
                        children: [
                          new TextRun({
                            text: `Ngày ${day} tháng ${month} năm ${year}`,
                            italics: true,
                            font: FONT_FAMILY,
                            size: SIZE_NORMAL, // 13 pt
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({
            text: '',
            spacing: { before: 120, after: 120, line: 360, lineRule: LineRuleType.AUTO },
          }),

          // Tiêu đề văn bản (Cỡ chữ 15, in đậm, căn giữa)
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: LINE_SPACING_1_5,
            children: [
              new TextRun({
                text: 'BẢNG PHÂN KHAI CHỈ TIÊU & NHIỆM VỤ THỰC HIỆN NGHỊ QUYẾT',
                bold: true,
                font: FONT_FAMILY,
                size: SIZE_TITLE, // 15 pt (30 half-points)
                color: '1A365D',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 250, line: 360, lineRule: LineRuleType.AUTO },
            children: [
              new TextRun({
                text: `(Kèm theo Nghị quyết số ${codeNumber} ngày ${day}/${month}/${year} của HĐND cấp xã)`,
                italics: true,
                font: FONT_FAMILY,
                size: SIZE_NORMAL, // 13 pt
              }),
            ],
          }),

          // Thông tin trích yếu (Cỡ chữ 13, giãn dòng 1.5)
          new Paragraph({
            spacing: { after: 200, line: 360, lineRule: LineRuleType.AUTO },
            children: [
              new TextRun({
                text: 'Trích yếu nội dung: ',
                bold: true,
                font: FONT_FAMILY,
                size: SIZE_NORMAL, // 13 pt
              }),
              new TextRun({
                text: title,
                font: FONT_FAMILY,
                size: SIZE_NORMAL, // 13 pt
              }),
            ],
          }),

          // Bảng dữ liệu chỉ tiêu
          table,

          new Paragraph({
            text: '',
            spacing: { before: 250, after: 150, line: 360, lineRule: LineRuleType.AUTO },
          }),

          // Chân trang: Nơi nhận (trái) và Người ký (phải)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        spacing: { line: 280, lineRule: LineRuleType.AUTO },
                        children: [
                          new TextRun({
                            text: 'Nơi nhận:',
                            bold: true,
                            italics: true,
                            font: FONT_FAMILY,
                            size: SIZE_NOTE, // 12 pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { line: 260, lineRule: LineRuleType.AUTO },
                        children: [
                          new TextRun({
                            text: '- UBND xã (để thực hiện);',
                            font: FONT_FAMILY,
                            size: SIZE_SMALL, // 11 pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { line: 260, lineRule: LineRuleType.AUTO },
                        children: [
                          new TextRun({
                            text: '- Thường trực HĐND xã (để chỉ đạo);',
                            font: FONT_FAMILY,
                            size: SIZE_SMALL, // 11 pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { line: 260, lineRule: LineRuleType.AUTO },
                        children: [
                          new TextRun({
                            text: '- Các Ban HĐND xã (để giám sát);',
                            font: FONT_FAMILY,
                            size: SIZE_SMALL, // 11 pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { line: 260, lineRule: LineRuleType.AUTO },
                        children: [
                          new TextRun({
                            text: '- Lưu: VP, VT.',
                            font: FONT_FAMILY,
                            size: SIZE_SMALL, // 11 pt
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: LINE_SPACING_1_5,
                        children: [
                          new TextRun({
                            text: 'TM. THƯỜNG TRỰC HỘI ĐỒNG NHÂN DÂN',
                            bold: true,
                            font: FONT_FAMILY,
                            size: SIZE_NORMAL, // 13 pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: LINE_SPACING_1_5,
                        children: [
                          new TextRun({
                            text: 'CHỦ TỊCH',
                            bold: true,
                            font: FONT_FAMILY,
                            size: SIZE_NORMAL, // 13 pt
                          }),
                        ],
                      }),
                      new Paragraph({
                        text: '',
                        spacing: { before: 800, line: 360, lineRule: LineRuleType.AUTO },
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: LINE_SPACING_1_5,
                        children: [
                          new TextRun({
                            text: signer,
                            bold: true,
                            font: FONT_FAMILY,
                            size: SIZE_NORMAL, // 13 pt
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

// Helper định dạng cell tiêu đề bảng (Cỡ 13, Bold, Canh giữa, Giãn dòng 1.5)
function cellHeader(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill: 'F1F5F9' },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: LINE_SPACING_1_5,
        children: [
          new TextRun({
            text,
            bold: true,
            font: FONT_FAMILY,
            size: SIZE_NORMAL, // 13 pt
          }),
        ],
      }),
    ],
  });
}

// Helper định dạng cell dữ liệu (Cỡ 13, Giãn dòng 1.5, Font Times New Roman)
function cellText(text, width, align = AlignmentType.LEFT, bold = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        spacing: LINE_SPACING_1_5,
        children: [
          new TextRun({
            text,
            bold,
            font: FONT_FAMILY,
            size: SIZE_NORMAL, // 13 pt
          }),
        ],
      }),
    ],
  });
}

module.exports = { generateResolutionDocx };
