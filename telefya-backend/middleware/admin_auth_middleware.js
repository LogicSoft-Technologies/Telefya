const auth_middleware = require("./auth_middleware");
const { query } = require("../config/db");

function getUserId(user) {
  return (
    user?.user ||
    user?.user_id ||
    user?.id ||
    user?.userId ||
    null
  );
}

function forbidden(
  res,
  message = "Admin access is required.",
) {
  return res.status(403).json({
    success: false,
    error: true,
    message,
    status: 403,
  });
}

function admin_auth_middleware(req, res, next) {
  return auth_middleware(req, res, async () => {
    try {
      const userId = getUserId(req.user);

      if (!userId) {
        return forbidden(res);
      }

      const admins = await query(
        `
          SELECT
            pa.user_id,
            pa.admin_role,
            pa.status,
            u.email,
            u.first_name,
            u.last_name
          FROM platform_admins pa
          INNER JOIN users u
            ON u.user_id = pa.user_id
          WHERE pa.user_id = ?
            AND pa.status = 'active'
          LIMIT 1
        `,
        [String(userId)],
      );

      const admin = admins?.[0];

      if (!admin) {
        return forbidden(res);
      }

      req.admin = {
        userId: admin.user_id,
        role: admin.admin_role,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
      };

      return next();
    } catch (error) {
      console.error(
        "[admin_auth_middleware] Failed to verify admin access:",
        error?.message || error,
      );

      return res.status(500).json({
        success: false,
        error: true,
        message: "Unable to verify admin access.",
        status: 500,
      });
    }
  });
}

function require_admin_roles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin?.role) {
      return forbidden(res);
    }

    if (
      allowedRoles.length > 0 &&
      !allowedRoles.includes(req.admin.role)
    ) {
      return forbidden(
        res,
        "Your administrator role cannot perform this action.",
      );
    }

    return next();
  };
}

module.exports = {
  admin_auth_middleware,
  require_admin_roles,
};