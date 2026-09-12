/**
 * middleware/rbac.js
 * Phân quyền theo vai trò (Custom Claims: role)
 * Roles: chuyen_vien | thuong_truc | co_quan_thuc_hien | ban_hdnd
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(403).json({ message: 'Tài khoản chưa được gán vai trò (role).' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Vai trò '${req.user.role}' không có quyền thực hiện chức năng này.`,
        required: allowedRoles,
      });
    }
    return next();
  };
}

module.exports = { requireRole };
