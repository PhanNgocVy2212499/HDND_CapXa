/**
 * middleware/rbac.js
 * Phân quyền theo vai trò (Custom Claims: role)
 * Roles hệ thống (mới): giup_viec | thuong_truc | co_quan_thuc_hien | ban_hdnd
 * Tương thích ngược: chuyen_vien được chuẩn hóa/áp vai trò giup_viec
 */
const ROLE_ALIASES = {
  giup_viec: ['giup_viec', 'chuyen_vien'],
  chuyen_vien: ['giup_viec', 'chuyen_vien'],
};

function expandRoles(roles) {
  const out = new Set();
  for (const r of roles) {
    out.add(r);
    for (const a of ROLE_ALIASES[r] || []) out.add(a);
  }
  return out;
}

function requireRole(...allowedRoles) {
  const allowed = expandRoles(allowedRoles);
  return (req, res, next) => {
    const role = req.user?.role;
    const rawRole = req.user?.rawRole;
    if (!role) {
      return res.status(403).json({ message: 'Tài khoản chưa được gán vai trò (role).' });
    }
    if (!allowed.has(role) && !(rawRole && allowed.has(rawRole))) {
      return res.status(403).json({
        message: `Vai trò '${role}' không có quyền thực hiện chức năng này.`,
        required: allowedRoles,
      });
    }
    return next();
  };
}

module.exports = { requireRole, expandRoles };
