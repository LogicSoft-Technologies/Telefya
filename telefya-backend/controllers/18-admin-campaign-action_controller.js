const { query } = require("../config/db");

const {
  queue_admin_campaign_delivery_service,
  cancel_admin_campaign_delivery_service,
} = require("../services/18-admin-campaign-action_service");

function getPositiveInteger(value) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 64);
  }

  return String(req.ip || req.socket?.remoteAddress || "")
    .trim()
    .slice(0, 64);
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

function fail(res, error) {
  const message = error?.message || "Unable to update campaign delivery.";

  const requestError = [
    "valid",
    "required",
    "not found",
    "cannot",
    "choose",
    "only draft",
    "no recipients",
    "no queued",
    "past",
    "scheduled delivery time",
  ].some((phrase) => message.toLowerCase().includes(phrase));

  const status = requestError ? 400 : 500;

  return res.status(status).json({
    success: false,
    error: true,
    message,
    status,
  });
}

const queue_admin_campaign_delivery_controller = async (
  req,
  res,
) => {
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

    const result = await queue_admin_campaign_delivery_service(
      query,
      admin,
      campaignId,
      req.body,
      {
        ipAddress: getClientIp(req),
      },
    );

    return res.status(200).json({
      ...result,
      status: 200,
    });
  } catch (error) {
    return fail(res, error);
  }
};

const cancel_admin_campaign_delivery_controller = async (
  req,
  res,
) => {
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

    const result = await cancel_admin_campaign_delivery_service(
      query,
      admin,
      campaignId,
      {
        ipAddress: getClientIp(req),
      },
    );

    return res.status(200).json({
      ...result,
      status: 200,
    });
  } catch (error) {
    return fail(res, error);
  }
};

module.exports = {
  queue_admin_campaign_delivery_controller,
  cancel_admin_campaign_delivery_controller,
};