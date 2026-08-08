const { query } = require("../config/db");
const service = require("../services/15-admin_service");

function getPositiveInteger(value) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 64);
  }

  return cleanIp(req.ip || req.socket?.remoteAddress || "");
}

function cleanIp(value) {
  return String(value).trim().slice(0, 64);
}

function ok(res, result, status = 200) {
  return res.status(status).json({
    ...result,
    status,
  });
}

function fail(res, error) {
  const message = error?.message || "Internal server error";

  const requestErrorMessages = [
    "required",
    "valid",
    "not found",
    "cannot change",
    "Only a super administrator",
    "No opted-in active users",
    "must accept",
    "Choose",
    "already",
  ];

  const isRequestError = requestErrorMessages.some((phrase) =>
    message.toLowerCase().includes(phrase.toLowerCase()),
  );

  return res.status(isRequestError ? 400 : 500).json({
    success: false,
    error: true,
    message,
    status: isRequestError ? 400 : 500,
  });
}

function requireAdmin(req, res) {
  if (!req.admin?.userId || !req.admin?.role) {
    res.status(403).json({
      success: false,
      error: true,
      message: "Admin access is required.",
      status: 403,
    });

    return null;
  }

  return req.admin;
}

const get_admin_dashboard_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    return ok(res, await service.get_admin_dashboard_service(query));
  } catch (error) {
    return fail(res, error);
  }
};

const list_admin_users_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    return ok(res, await service.list_admin_users_service(query, req.query));
  } catch (error) {
    return fail(res, error);
  }
};

const get_admin_user_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const userId = String(req.params.userId || "").trim();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "A valid user is required.",
        status: 400,
      });
    }

    return ok(res, await service.get_admin_user_service(query, userId));
  } catch (error) {
    return fail(res, error);
  }
};

const update_admin_user_status_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const userId = String(req.params.userId || "").trim();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "A valid user is required.",
        status: 400,
      });
    }

    return ok(
      res,
      await service.update_admin_user_status_service(
        query,
        admin,
        userId,
        req.body,
        {
          ipAddress: getClientIp(req),
        },
      ),
    );
  } catch (error) {
    return fail(res, error);
  }
};

const list_admin_segments_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    return ok(res, await service.list_admin_segments_service(query));
  } catch (error) {
    return fail(res, error);
  }
};

const create_admin_segment_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    return ok(
      res,
      await service.create_admin_segment_service(query, admin, req.body, {
        ipAddress: getClientIp(req),
      }),
      201,
    );
  } catch (error) {
    return fail(res, error);
  }
};

const preview_admin_audience_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    return ok(
      res,
      await service.preview_admin_audience_service(query, req.body),
    );
  } catch (error) {
    return fail(res, error);
  }
};

const list_admin_campaigns_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    return ok(
      res,
      await service.list_admin_campaigns_service(query, req.query),
    );
  } catch (error) {
    return fail(res, error);
  }
};

const create_admin_campaign_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    return ok(
      res,
      await service.create_admin_campaign_service(query, admin, req.body, {
        ipAddress: getClientIp(req),
      }),
      201,
    );
  } catch (error) {
    return fail(res, error);
  }
};

const get_admin_campaign_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const campaignId = getPositiveInteger(req.params.campaignId);

    if (!campaignId) {
      return res.status(400).json({
        success: false,
        error: true,
        message: "A valid campaign is required.",
        status: 400,
      });
    }

    return ok(res, await service.get_admin_campaign_service(query, campaignId));
  } catch (error) {
    return fail(res, error);
  }
};

const list_admin_meetings_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    return ok(res, await service.list_admin_meetings_service(query, req.query));
  } catch (error) {
    return fail(res, error);
  }
};

const list_admin_recordings_controller = async (req, res) => {
  try {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    return ok(
      res,
      await service.list_admin_recordings_service(query, req.query),
    );
  } catch (error) {
    return fail(res, error);
  }
};

module.exports = {
  get_admin_dashboard_controller,
  list_admin_users_controller,
  get_admin_user_controller,
  update_admin_user_status_controller,
  list_admin_segments_controller,
  create_admin_segment_controller,
  preview_admin_audience_controller,
  list_admin_campaigns_controller,
  create_admin_campaign_controller,
  get_admin_campaign_controller,
  list_admin_meetings_controller,
  list_admin_recordings_controller,
};
