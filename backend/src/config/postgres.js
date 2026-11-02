/**
 * config/postgres.js
 * Module kết nối và đồng bộ dữ liệu PostgreSQL cho Hệ thống Quản lý HĐND cấp xã
 * Hỗ trợ lưu trữ song song hoặc chuyển đổi giữa Firestore và PostgreSQL
 */
const { Pool } = require('pg');

let pool = null;

function getPostgresPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  const config = connectionString
    ? { connectionString }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT) || 5432,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'hdnd_xa',
        connectionTimeoutMillis: 3000,
      };

  pool = new Pool(config);

  pool.on('error', (err) => {
    console.warn('[PostgreSQL] Lỗi kết nối pool (không ảnh hưởng Firestore):', err.message);
  });

  return pool;
}

/**
 * Khởi tạo bảng PostgreSQL nếu chưa có
 */
async function initPostgresSchema() {
  const p = getPostgresPool();
  try {
    const client = await p.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS resolutions (
          id VARCHAR(128) PRIMARY KEY,
          code_number VARCHAR(128),
          title TEXT,
          issuance_date TIMESTAMP,
          signer VARCHAR(255),
          status VARCHAR(64),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS indicators (
          id VARCHAR(128) PRIMARY KEY,
          resolution_id VARCHAR(128) REFERENCES resolutions(id) ON DELETE CASCADE,
          parent_id VARCHAR(128),
          title TEXT,
          target_value NUMERIC,
          unit VARCHAR(64),
          frequency VARCHAR(64),
          deadline DATE,
          status VARCHAR(64),
          department_id VARCHAR(128),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS resolution_exports (
          id SERIAL PRIMARY KEY,
          resolution_id VARCHAR(128) REFERENCES resolutions(id) ON DELETE CASCADE,
          file_name VARCHAR(255),
          file_format VARCHAR(32) DEFAULT 'docx',
          recipient_email VARCHAR(255),
          email_sent BOOLEAN DEFAULT TRUE,
          exported_by VARCHAR(128),
          exported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.info('[PostgreSQL] Schema bảng resolutions, indicators, resolution_exports sẵn sàng.');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('[PostgreSQL] Chưa kết nối được DB (sử dụng Firestore làm DB chính):', err.message);
    return false;
  }
}

/**
 * Đồng bộ dữ liệu Nghị quyết và Cây chỉ tiêu sang PostgreSQL khi hoàn thành
 * @param {Object} resolution
 * @param {Array} indicators
 * @param {Object} exportInfo
 */
async function syncToPostgres(resolution, indicators = [], exportInfo = {}) {
  const p = getPostgresPool();
  try {
    const client = await p.connect();
    try {
      await client.query('BEGIN');

      // 1. Lưu / Cập nhật Resolution
      const issuanceDate = resolution.issuanceDate
        ? new Date(resolution.issuanceDate.toDate ? resolution.issuanceDate.toDate() : resolution.issuanceDate)
        : new Date();

      await client.query(
        `INSERT INTO resolutions (id, code_number, title, issuance_date, signer, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           code_number = EXCLUDED.code_number,
           title = EXCLUDED.title,
           status = EXCLUDED.status,
           signer = EXCLUDED.signer,
           updated_at = CURRENT_TIMESTAMP`,
        [
          resolution.id,
          resolution.codeNumber || '',
          resolution.title || '',
          issuanceDate,
          resolution.signer || '',
          resolution.status || 'pending_ban_review',
        ]
      );

      // 2. Lưu các chỉ tiêu
      for (const ind of indicators) {
        const targetVal = Number(ind.targetValue ?? ind.target) || 0;
        const deptId = ind.dept || ind.assignedDepartments?.[0]?.departmentId || 'ubnd-xa';
        const deadline = ind.deadline ? new Date(ind.deadline) : null;

        await client.query(
          `INSERT INTO indicators (id, resolution_id, parent_id, title, target_value, unit, frequency, deadline, status, department_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title,
             target_value = EXCLUDED.target_value,
             unit = EXCLUDED.unit,
             frequency = EXCLUDED.frequency,
             deadline = EXCLUDED.deadline,
             department_id = EXCLUDED.department_id`,
          [
            ind.id || `local-${Math.random()}`,
            resolution.id,
            ind.parentId || null,
            ind.title || '',
            targetVal,
            ind.unit || 'đồng',
            ind.frequency || 'quarterly',
            deadline,
            ind.status || 'draft',
            deptId,
          ]
        );
      }

      // 3. Ghi log export
      if (exportInfo.fileName) {
        await client.query(
          `INSERT INTO resolution_exports (resolution_id, file_name, file_format, recipient_email, email_sent, exported_by)
           VALUES ($1, $2, 'docx', $3, $4, $5)`,
          [
            resolution.id,
            exportInfo.fileName,
            exportInfo.recipientEmail || 'ubnd@xa.gov.vn',
            Boolean(exportInfo.emailSent),
            exportInfo.exportedBy || 'chuyen_vien',
          ]
        );
      }

      await client.query('COMMIT');
      console.info(`[PostgreSQL] Đã đồng bộ thành công NQ ${resolution.codeNumber} và ${indicators.length} chỉ tiêu.`);
      return true;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    // Không làm crash luồng chính nếu chưa bật service Postgres
    console.warn('[PostgreSQL] Bỏ qua đồng bộ PG (hệ thống hoạt động trên Firestore):', err.message);
    return false;
  }
}

module.exports = {
  getPostgresPool,
  initPostgresSchema,
  syncToPostgres,
};
