/**
 * frontend/src/components/ResolutionUploadOcr.jsx
 * Màn hình Upload & OCR: preview PDF bên trái, form auto-fill bên phải.
 * Dùng: React + Ant Design + Firebase Client SDK (lấy ID Token) + Axios.
 */
import { useState } from 'react';
import { Upload, Form, Input, DatePicker, Button, Row, Col, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { getAuth } from 'firebase/auth';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function ResolutionUploadOcr({ onCreated }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const beforeUpload = (f) => {
    const ok = ['application/pdf', 'image/png', 'image/jpeg'].includes(f.type);
    if (!ok) message.error('Chỉ chấp nhận PDF/PNG/JPG');
    else {
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    }
    return false; // chặn auto-upload của Antd, submit tay
  };

  const handleSubmit = async () => {
    if (!file) return message.warning('Hãy chọn file nghị quyết trước.');
    try {
      setLoading(true);
      const token = await getAuth().currentUser?.getIdToken();
      const fd = new FormData();
      fd.append('file', file);
      // Gửi kèm giá trị đã sửa tay (nếu có) để Backend override kết quả OCR
      const v = form.getFieldsValue();
      if (v.codeNumber) fd.append('codeNumber', v.codeNumber);
      if (v.title) fd.append('title', v.title);

      const { data } = await axios.post(`${API}/resolutions/upload-ocr`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const r = data.data;
      // Auto-fill form từ kết quả OCR trả về
      form.setFieldsValue({
        codeNumber: r.codeNumber,
        title: r.title,
        signer: r.signer,
        issuanceDate: r.issuanceDate ? dayjs(r.issuanceDate) : null,
      });
      message.success('OCR xong — kiểm tra lại rồi trình Thường trực.');
      onCreated?.(r);
    } catch (e) {
      message.error(e.response?.data?.message || 'Upload/OCR thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row gutter={16}>
      <Col span={12}>
        <Upload.Dragger beforeUpload={beforeUpload} maxCount={1} accept=".pdf,.png,.jpg,.jpeg">
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>Kéo thả PDF Nghị quyết vào đây</p>
        </Upload.Dragger>
        {previewUrl && (
          <iframe title="preview" src={previewUrl} style={{ width: '100%', height: 500, marginTop: 12 }} />
        )}
      </Col>
      <Col span={12}>
        <Form form={form} layout="vertical">
          <Form.Item name="codeNumber" label="Số hiệu (OCR)"><Input placeholder="05/2026/NQ-HĐND" /></Form.Item>
          <Form.Item name="title" label="Trích yếu"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="signer" label="Người ký"><Input /></Form.Item>
          <Form.Item name="issuanceDate" label="Ngày ban hành"><DatePicker format="DD/MM/YYYY" /></Form.Item>
          <Button type="primary" loading={loading} onClick={handleSubmit}>Upload & OCR</Button>
        </Form>
      </Col>
    </Row>
  );
}
