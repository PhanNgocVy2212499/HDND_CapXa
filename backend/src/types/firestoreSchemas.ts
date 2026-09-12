/**
 * Firestore Schema — Quy trình 1: Quản lý Nghị quyết HĐND cấp xã
 * Dùng cho cả Backend (Node.js) và Frontend (ReactJS + TS).
 * Firestore là NoSQL: mỗi interface = 1 document trong collection tương ứng.
 */

import type { Timestamp } from 'firebase-admin/firestore';

// ============================================================
// 0. ENUMS & SHARED TYPES (đồng bộ với Custom Claims + Rules)
// ============================================================

/** Vai trò người dùng — lưu trong Firebase Auth Custom Claims: `role` */
export type UserRole =
  | 'chuyen_vien' // Chuyên viên HĐND: upload, OCR, dựng cây chỉ tiêu
  | 'thuong_truc' // Thường trực HĐND: phê duyệt, giao việc, ấn định deadline
  | 'co_quan_thuc_hien' // UBND xã / công chức: báo cáo tiến độ
  | 'ban_hdnd'; // Các Ban HĐND: thẩm tra báo cáo

export type ResolutionStatus =
  | 'draft' // Vừa OCR xong, chuyên viên đang hoàn thiện
  | 'pending_approval' // Đã trình Thường trực duyệt
  | 'approved' // Đã duyệt cây chỉ tiêu, bắt đầu triển khai
  | 'completed'; // Mọi indicator đã hoàn thành / hết hiệu lực

export type IndicatorStatus =
  | 'draft'
  | 'pending_approval'
  | 'assigned' // Đã giao việc, đang thực hiện
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'adjustment_requested'; // Đơn vị xin điều chỉnh, chờ Thường trực duyệt

/** Màu cảnh báo do Cron Job tự động tính từ deadline */
export type AlertLevel = 'green' | 'yellow' | 'red';

export type ReportFrequency = 'monthly' | 'quarterly' | 'annual';

export type AssignmentRole = 'primary' | 'cooperate';

export interface DepartmentAssignment {
  departmentId: string; // VD: 'ubnd-xa', 'dia-chinh', 'tai-chinh', 'tu-phap'
  departmentName?: string; // denormalize để hiển thị nhanh, tránh join
  role: AssignmentRole; // primary = chủ trì, cooperate = phối hợp
}

export type ProgressReportStatus = 'submitted' | 'approved' | 'rejected';

export type ReviewStatus = 'passed' | 'need_clarification';

// ============================================================
// 1. resolutions — Nghị quyết HĐND
// Collection: resolutions / Document ID: auto-id hoặc `NQ-2026-001`
// ============================================================
export interface Resolution {
  id: string;
  /** Số hiệu: VD "05/2026/NQ-HĐND" — OCR tự trích, cho phép sửa tay */
  codeNumber: string;
  /** Trích yếu / tiêu đề */
  title: string;
  /** Ngày ban hành (lưu Timestamp để query theo khoảng thời gian) */
  issuanceDate: Timestamp;
  /** Người ký: VD "Chủ tịch HĐND xã ..." */
  signer: string;
  /** File PDF gốc trên Firebase Storage (downloadURL hoặc gs:// path) */
  fileUrl: string;
  /** Đường dẫn storage để xóa/ghi đè: resolutions/2026/<uuid>.pdf */
  storagePath?: string;
  status: ResolutionStatus;
  /** Kết quả OCR thô — giữ lại để đối soát khi auto-fill sai */
  ocrRawText?: string;
  ocrConfidence?: number; // 0..1 (nếu dùng Vision API)
  createdByUserId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** DTO khi tạo document nháp sau bước Upload + OCR */
export interface CreateResolutionDraftInput {
  codeNumber: string;
  title: string;
  issuanceDate: Date;
  signer: string;
  fileUrl: string;
  storagePath: string;
  ocrRawText?: string;
  ocrConfidence?: number;
  createdByUserId: string;
}

// ============================================================
// 2. indicators — Chỉ tiêu / nhiệm vụ (cấu trúc CÂY Parent-Child)
// Collection: indicators / Query chính: where('resolutionId','==',...)
// ============================================================
export interface Indicator {
  id: string;
  resolutionId: string; // FK -> resolutions.id (CSDL dùng chung: khóa liên kết chính)
  /** Denormalize "sản sinh 1 lần, dùng nhiều lần": đọc indicator là biết NQ gốc, khỏi join */
  resolutionCodeNumber?: string; // VD "05/2026/NQ-HĐND"
  resolutionFileUrl?: string; // Văn bản nguồn NQ gốc
  /** null = nút gốc (chương trình/mục tiêu), có giá trị = chỉ tiêu con */
  parentId: string | null;
  title: string; // VD "Tỷ lệ hộ nghèo giảm còn dưới 2%"
  targetValue: number; // Giá trị kế hoạch: VD 2
  currentValue?: number; // Giá trị thực tế mới nhất (denormalize từ reports)
  unit: string; // VD "%", "km", "tỷ đồng", "hộ"
  frequency: ReportFrequency; // Chu kỳ báo cáo
  deadline: Timestamp; // Hạn hoàn thành — Thường trực ấn định
  status: IndicatorStatus;
  alertLevel?: AlertLevel; // Cron job cập nhật mỗi đêm
  progressPercentage?: number; // 0..100 — tổng hợp từ progressReports
  assignedDepartments: DepartmentAssignment[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** DTO dựng cây chỉ tiêu: Frontend gửi mảng cây, Backend lưu đệ quy */
export interface IndicatorTreeNodeInput {
  /** Có id = update, không có id = tạo mới */
  id?: string;
  parentId?: string | null;
  title: string;
  targetValue: number;
  unit: string;
  frequency: ReportFrequency;
  deadline: string; // ISO string từ Frontend, Backend convert sang Timestamp
  assignedDepartments?: DepartmentAssignment[];
  children?: IndicatorTreeNodeInput[];
}

// ============================================================
// 3. progressReports — Báo cáo tiến độ của đơn vị thực hiện
// Collection: progressReports / Query: where('indicatorId','==',...)
// ============================================================
export interface ProgressReport {
  id: string;
  indicatorId: string; // FK -> indicators.id
  resolutionId: string; // denormalize để lọc nhanh theo NQ
  resolutionCodeNumber?: string; // denormalize NQ gốc
  indicatorTitle?: string; // denormalize tên chỉ tiêu để dropdown thẩm tra khỏi join
  reportedByUserId: string;
  departmentId: string;
  /** Kỳ báo cáo: VD "2026-08" (monthly) hoặc "2026-Q3" (quarterly) */
  period?: string;
  actualValue: number; // Số liệu thực tế kỳ này
  progressPercentage: number; // 0..100 do đơn vị tự đánh giá
  remarks?: string; // Ghi chú / khó khăn / kiến nghị
  /** BẮT BUỘC: file minh chứng — 100% báo cáo phải có văn bản nguồn mới có giá trị pháp lý */
  evidenceFileUrl: string; // File minh chứng trên Storage (pdf/ảnh/excel)
  evidenceStoragePath: string;
  status: ProgressReportStatus;
  reportedAt: Timestamp; // đóng dấu thời gian tự động
}

/** DTO gửi báo cáo (multipart/form-data: fields + file minh chứng) */
export interface CreateProgressReportInput {
  indicatorId: string;
  actualValue: number;
  progressPercentage: number;
  remarks?: string;
  period?: string;
}

// ============================================================
// 4. reviews — Thẩm tra của các Ban HĐND trên từng báo cáo
// Collection: reviews / Mỗi report có thể có nhiều review (trao đổi 2 chiều)
// ============================================================
export interface Review {
  id: string;
  progressReportId: string; // FK -> progressReports.id
  indicatorId: string; // denormalize để query "mọi thẩm tra của 1 chỉ tiêu"
  resolutionId?: string; // denormalize NQ gốc để lọc theo NQ
  reviewedByUserId: string;
  reviewerRole: Extract<UserRole, 'ban_hdnd' | 'thuong_truc'>;
  comment: string;
  status: ReviewStatus; // passed = Đồng ý, need_clarification = Yêu cầu giải trình
  reviewedAt: Timestamp; // đóng dấu thời gian tự động
}

// ============================================================
// 5. auditLogs — Nhật ký CSDL dùng chung (append-only, không sửa/xóa)
// Collection: auditLogs / Query: where('resolutionId','==',...) orderBy createdAt desc
// Minden ghi (upload/tree/approve/report/review) đều sinh 1 dòng log kèm
// actor + before/after + sourceFileUrl + timestamp -> công khai, minh bạch, pháp lý.
// ============================================================

export type AuditAction =
  | 'create_resolution'
  | 'upsert_tree'
  | 'approve_indicator'
  | 'submit_report'
  | 'submit_review';

export interface AuditLog {
  id: string;
  collection: 'resolutions' | 'indicators' | 'progressReports' | 'reviews';
  docId: string; // ID document bị tác động
  resolutionId: string; // Khóa liên kết CSDL dùng chung
  action: AuditAction;
  actor: {
    uid: string;
    email?: string;
    role?: UserRole | string;
    departmentId?: string;
  };
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  /** Văn bản nguồn bắt buộc của hành động (PDF NQ / file minh chứng) */
  sourceFileUrl: string;
  sourceStoragePath?: string;
  message?: string;
  createdAt: Timestamp; // đóng dấu thời gian tự động, server-side
}

// ============================================================
// GỢI Ý FIRESTORE INDEXES (firestore.indexes.json)
// - indicators: resolutionId ASC + parentId ASC
// - indicators: resolutionId ASC + deadline ASC
// - progressReports: indicatorId ASC + reportedAt DESC
// - progressReports: resolutionId ASC + reportedAt DESC
// - reviews: progressReportId ASC + reviewedAt DESC
// - auditLogs: resolutionId ASC + createdAt DESC
// - auditLogs: collection ASC + createdAt DESC
// ============================================================
