/**
 * services/mailService.js
 * Gửi email tự động thông báo kết quả xử lý cây chỉ tiêu đến UBND xã
 * Đính kèm file văn bản Word (.docx)
 */
const nodemailer = require('nodemailer');

let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SERVICE } = process.env;

  // 1. Chế độ Gmail tiện lợi (chỉ cần SMTP_USER và SMTP_PASS là App Password 16 chữ cái)
  if (SMTP_USER && SMTP_PASS && (SMTP_SERVICE === 'gmail' || (!SMTP_HOST && SMTP_USER.includes('@gmail')) || (SMTP_HOST && SMTP_HOST.includes('gmail')))) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    console.info('[mail] Sử dụng dịch vụ Gmail SMTP trực tiếp:', SMTP_USER);
    return cachedTransporter;
  }

  // 2. Chế độ SMTP tiêu chuẩn (Custom Host/Port)
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    console.info('[mail] Sử dụng cấu hình SMTP chính:', SMTP_HOST);
    return cachedTransporter;
  }

  // Chế độ dev / test: Tạo tài khoản Ethereal tự động
  try {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.info('[mail] Sử dụng Ethereal Test Account:', testAccount.user);
    return cachedTransporter;
  } catch (err) {
    console.warn('[mail] Không thể tạo Ethereal account, dùng fallback log:', err.message);
    return null;
  }
}

/**
 * Gửi email kèm file Word đến UBND xã
 * @param {Object} params
 * @param {string} params.to Email người nhận (UBND xã)
 * @param {Object} params.resolution Thông tin nghị quyết
 * @param {number} params.totalIndicators Tổng số chỉ tiêu
 * @param {Buffer} params.docxBuffer Buffer file Word (.docx)
 * @param {string} params.filename Tên file đính kèm
 */
async function sendResolutionDocxEmail({
  to = 'ubnd@xa.gov.vn',
  resolution = {},
  totalIndicators = 0,
  docxBuffer,
  filename = 'Bang_phan_khai_chi_tieu.docx',
}) {
  const codeNumber = resolution.codeNumber || 'NQ-HĐND';
  const title = resolution.title || 'Nghị quyết HĐND cấp xã';
  const recipient = to || process.env.UBND_EMAIL || 'ubnd@xa.gov.vn';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
      <div style="background-color: #047857; color: white; padding: 20px 24px;">
        <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">HỘI ĐỒNG NHÂN DÂN CẤP XÃ</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Hệ thống Quản lý và Theo dõi thực hiện Nghị quyết HĐND cấp xã</p>
      </div>

      <div style="padding: 24px; line-height: 1.6; font-size: 14px;">
        <p><strong>Kính gửi:</strong> Ủy ban nhân dân xã,</p>

        <p>Chuyên viên Văn phòng HĐND xã xin thông báo đã <strong>hoàn thành xử lý và xây dựng Cây chỉ tiêu phân khai</strong> cho Nghị quyết HĐND cấp xã sau:</p>

        <div style="background-color: #f8fafc; border-left: 4px solid #047857; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="margin: 0 0 6px 0;"><strong>Số hiệu Nghị quyết:</strong> <span style="color: #047857; font-weight: bold;">${codeNumber}</span></p>
          <p style="margin: 0 0 6px 0;"><strong>Trích yếu:</strong> ${title}</p>
          <p style="margin: 0 0 6px 0;"><strong>Người ký:</strong> ${resolution.signer || 'Chủ tịch HĐND xã'}</p>
          <p style="margin: 0;"><strong>Tổng số chỉ tiêu/nhiệm vụ:</strong> <span style="background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 999px; font-weight: bold;">${totalIndicators} chỉ tiêu</span></p>
        </div>

        <p>Chi tiết danh mục các chỉ tiêu, dự toán kinh phí, thời hạn hoàn thành và bộ phận công chức chủ trì thực hiện đã được kết xuất đầy đủ trong <strong>tệp tài liệu Word (.docx) đính kèm</strong> theo email này.</p>

        <p>Đề nghị Ủy ban nhân dân xã tiếp nhận, chỉ đạo các bộ phận chuyên môn (Kinh tế, Văn hóa - Xã hội, Tài chính - Kế toán, Địa chính - Xây dựng...) triển khai thực hiện và cập nhật báo cáo tiến độ định kỳ lên hệ thống.</p>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 12px; color: #64748b;">
          <p style="margin: 0;"><em>Email này được gửi tự động từ Hệ thống Quản lý Nghị quyết HĐND cấp xã khi Chuyên viên hoàn tất xử lý cây chỉ tiêu.</em></p>
        </div>
      </div>
    </div>
  `;

  const transporter = await getTransporter();

  if (!transporter) {
    console.info(`[mail:mock] Đã ghi nhận gửi mail tới ${recipient} kèm file ${filename} (${docxBuffer.length} bytes)`);
    return {
      success: true,
      mode: 'mock-offline',
      recipient,
      messageId: 'mock-' + Date.now(),
      previewUrl: null,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || (process.env.SMTP_USER ? `"HĐND Cấp Xã" <${process.env.SMTP_USER}>` : '"HĐND Cấp Xã" <no-reply@hdnd-xa.gov.vn>'),
      to: recipient,
      subject: `[HĐND CẤP XÃ] Bàn giao Cây chỉ tiêu Nghị quyết số ${codeNumber}`,
      html: htmlContent,
      attachments: [
        {
          filename: filename || `Bang_chi_tieu_NQ_${codeNumber.replace(/[\/\\?%*:|"<>]/g, '_')}.docx`,
          content: docxBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      ],
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    console.info(`[mail] Đã gửi email thành công tới ${recipient}. MessageId: ${info.messageId}`);
    if (previewUrl) {
      console.info(`[mail:preview] Xem trước email tại: ${previewUrl}`);
    }

    return {
      success: true,
      mode: previewUrl ? 'ethereal-test' : 'smtp',
      recipient,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (sendErr) {
    console.error('[mail] Gửi email thất bại:', sendErr.message);
    // Vẫn trả kết quả thông tin lỗi rõ ràng để không làm crash toàn bộ request
    return {
      success: false,
      error: sendErr.message,
      recipient,
      previewUrl: null,
    };
  }
}

module.exports = {
  sendResolutionDocxEmail,
  sendResolutionNoticeMail: sendResolutionDocxEmail,
};
