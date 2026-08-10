const express = require("express");

const {
  admin_auth_middleware,
  require_admin_roles,
} = require("../../middleware/admin_auth_middleware");

const {
  get_admin_dashboard_controller,
  list_admin_users_controller,
  get_admin_user_controller,
  update_admin_user_status_controller,
  update_admin_user_participant_limit_controller,
  list_admin_segments_controller,
  create_admin_segment_controller,
  preview_admin_audience_controller,
  list_admin_campaigns_controller,
  create_admin_campaign_controller,
  get_admin_campaign_controller,
  list_admin_meetings_controller,
  list_admin_recordings_controller,
} = require("../../controllers/15-admin_controller");

const {
  get_admin_reporting_overview_controller,
  get_admin_usage_report_controller,
  get_admin_quality_report_controller,
  get_admin_compliance_report_controller,
  get_admin_security_report_controller,
} = require("../../controllers/16-admin-reporting_controller");

const {
  queue_admin_campaign_delivery_controller,
  cancel_admin_campaign_delivery_controller,
} = require("../../controllers/18-admin-campaign-action_controller");

const admin_router = express.Router();

admin_router.use(admin_auth_middleware);

admin_router.get(
  "/dashboard",
  require_admin_roles(
    "super_admin",
    "admin",
    "support",
    "analyst",
    "marketing",
  ),
  get_admin_dashboard_controller,
);

admin_router.get(
  "/users",
  require_admin_roles(
    "super_admin",
    "admin",
    "support",
    "analyst",
  ),
  list_admin_users_controller,
);

admin_router.get(
  "/users/:userId",
  require_admin_roles(
    "super_admin",
    "admin",
    "support",
    "analyst",
  ),
  get_admin_user_controller,
);

admin_router.patch(
  "/users/:userId/account-status",
  require_admin_roles("super_admin", "admin"),
  update_admin_user_status_controller,
);

admin_router.patch(
  "/users/:userId/participant-limit",
  require_admin_roles("super_admin", "admin"),
  update_admin_user_participant_limit_controller,
);

admin_router.get(
  "/segments",
  require_admin_roles(
    "super_admin",
    "admin",
    "analyst",
    "marketing",
  ),
  list_admin_segments_controller,
);

admin_router.post(
  "/segments",
  require_admin_roles("super_admin", "admin", "marketing"),
  create_admin_segment_controller,
);

admin_router.post(
  "/audience/preview",
  require_admin_roles(
    "super_admin",
    "admin",
    "analyst",
    "marketing",
  ),
  preview_admin_audience_controller,
);

admin_router.get(
  "/campaigns",
  require_admin_roles(
    "super_admin",
    "admin",
    "analyst",
    "marketing",
  ),
  list_admin_campaigns_controller,
);

admin_router.post(
  "/campaigns",
  require_admin_roles("super_admin", "admin", "marketing"),
  create_admin_campaign_controller,
);

/*
 * Campaign delivery:
 * delivery_mode = "now" sends through the worker on its next cycle.
 * delivery_mode = "scheduled" requires scheduled_for.
 */
admin_router.post(
  "/campaigns/:campaignId/delivery",
  require_admin_roles("super_admin", "admin", "marketing"),
  queue_admin_campaign_delivery_controller,
);

admin_router.post(
  "/campaigns/:campaignId/cancel",
  require_admin_roles("super_admin", "admin", "marketing"),
  cancel_admin_campaign_delivery_controller,
);

admin_router.get(
  "/campaigns/:campaignId",
  require_admin_roles(
    "super_admin",
    "admin",
    "analyst",
    "marketing",
  ),
  get_admin_campaign_controller,
);

admin_router.get(
  "/meetings",
  require_admin_roles(
    "super_admin",
    "admin",
    "support",
    "analyst",
  ),
  list_admin_meetings_controller,
);

admin_router.get(
  "/recordings",
  require_admin_roles(
    "super_admin",
    "admin",
    "support",
    "analyst",
  ),
  list_admin_recordings_controller,
);

admin_router.get(
  "/reports",
  require_admin_roles(
    "super_admin",
    "admin",
    "support",
    "analyst",
  ),
  get_admin_reporting_overview_controller,
);

admin_router.get(
  "/reports/usage",
  require_admin_roles(
    "super_admin",
    "admin",
    "support",
    "analyst",
  ),
  get_admin_usage_report_controller,
);

admin_router.get(
  "/reports/quality",
  require_admin_roles(
    "super_admin",
    "admin",
    "support",
    "analyst",
  ),
  get_admin_quality_report_controller,
);

admin_router.get(
  "/reports/compliance",
  require_admin_roles(
    "super_admin",
    "admin",
    "support",
    "analyst",
  ),
  get_admin_compliance_report_controller,
);

admin_router.get(
  "/reports/security",
  require_admin_roles("super_admin", "admin"),
  get_admin_security_report_controller,
);

module.exports = admin_router;