const express = require("express");

const get_user_profile_controller = require(
  "../../controllers/05-user_profile_controller",
);
const update_user_profile_controller = require(
  "../../controllers/05-update_user_profile_controller",
);
const user_logout_controller = require(
  "../../controllers/06-logout-controller",
);
const auth_middleware = require("../../middleware/auth_middleware");

const get_mobile_profile_controller = get_user_profile_controller;

const loadMeetingControllers = () => {
  try {
    return require("../../controllers/07_meeting_controller");
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    return require("../../controllers/07-meeting_controller");
  }
};

const {
  get_analytics_summary_controller,
  list_attendance_reports_controller,
} = require("../../controllers/09-analytics_controller");

const {
  list_recordings_controller,
  download_recording_controller,
  delete_recording_controller,
} = require("../../controllers/10-recording_controller");

const {
  get_branding_controller,
  save_branding_controller,
  list_meeting_members_controller,
  invite_meeting_member_controller,
  remove_meeting_member_controller,
  respond_to_meeting_invite_controller,
  list_speaker_meetings_controller,
  list_attendee_meetings_controller,
  get_speaker_status_controller,
  save_speaker_status_controller,
  list_speaker_materials_controller,
  create_speaker_material_controller,
  list_attendee_networking_controller,
  list_certificates_controller,
  generate_certificate_controller,
  get_billing_overview_controller,
  get_mobile_meeting_inbox_controller,
} = require("../../controllers/12-workspace_controller");

const {
  register_push_device_controller,
  unregister_push_device_controller,
} = require("../../controllers/20-push-notification_controller");

const {
  get_notification_preferences_controller,
  update_notification_preferences_controller,
} = require(
  "../../controllers/21-notification-preferences_controller"
);

const {
  report_meeting_telemetry_controller,
} = require(
  "../../controllers/22-meeting-telemetry_controller"
);

const {
  get_calendar_events_controller,
  update_calendar_event_controller,
  cancel_calendar_event_controller,
  get_calendar_event_audit_controller,
} = require("../../controllers/23-calendar_controller");

const {
  list_calendar_connections_controller,
  start_google_calendar_connection_controller,
  google_calendar_callback_controller,
  disconnect_google_calendar_controller,
} = require("../../controllers/29-calendar-connections_controller");

const {
  save_meeting_recurrence_controller,
  get_meeting_recurrence_controller,
  delete_meeting_recurrence_controller,
} = require("../../controllers/24-recurrence_controller");

const {
  save_recurrence_exception_controller,
  delete_recurrence_exception_controller,
} = require("../../controllers/26-recurrence-exception_controller");

const {
  get_availability_settings_controller,
  save_booking_profile_controller,
  replace_availability_rules_controller,
  get_availability_exceptions_controller,
  create_availability_exception_controller,
  delete_availability_exception_controller,
} = require("../../controllers/27-availability_controller");

const {
  schedule_meeting_controller,
  start_instant_meeting_controller,
  get_meeting_controller,
  delete_meeting_controller,
  update_meeting_lifecycle_controller,
} = loadMeetingControllers();

const user_router = express.Router();

user_router.get(
  "/calendar/events",
  auth_middleware,
  get_calendar_events_controller,
);

user_router.patch(
  "/calendar/events/:meetingId",
  auth_middleware,
  update_calendar_event_controller,
);

user_router.post(
  "/calendar/events/:meetingId/cancel",
  auth_middleware,
  cancel_calendar_event_controller,
);

user_router.get(
  "/calendar/events/:meetingId/audit",
  auth_middleware,
  get_calendar_event_audit_controller,
);

user_router.get(
  "/calendar/events/:meetingId/recurrence",
  auth_middleware,
  get_meeting_recurrence_controller,
);

user_router.put(
  "/calendar/events/:meetingId/recurrence",
  auth_middleware,
  save_meeting_recurrence_controller,
);

user_router.delete(
  "/calendar/events/:meetingId/recurrence",
  auth_middleware,
  delete_meeting_recurrence_controller,
);

user_router.post(
  "/calendar/events/:meetingId/recurrence/exceptions",
  auth_middleware,
  save_recurrence_exception_controller,
);

user_router.delete(
  "/calendar/events/:meetingId/recurrence/exceptions",
  auth_middleware,
  delete_recurrence_exception_controller,
);

user_router.get(
  "/calendar/connections",
  auth_middleware,
  list_calendar_connections_controller,
);

user_router.post(
  "/calendar/connections/google/start",
  auth_middleware,
  start_google_calendar_connection_controller,
);

/*
 * Google sends the user here after consent. It cannot use our normal
 * Authorization header, so this route intentionally has no auth middleware.
 * The hashed, single-use OAuth state identifies the authenticated user.
 */
user_router.get(
  "/calendar/connections/google/callback",
  google_calendar_callback_controller,
);

user_router.delete(
  "/calendar/connections/google",
  auth_middleware,
  disconnect_google_calendar_controller,
);

user_router.get(
  "/calendar/availability/exceptions",
  auth_middleware,
  get_availability_exceptions_controller,
);

user_router.post(
  "/calendar/availability/exceptions",
  auth_middleware,
  create_availability_exception_controller,
);

user_router.delete(
  "/calendar/availability/exceptions/:exceptionId",
  auth_middleware,
  delete_availability_exception_controller,
);

user_router.get(
  "/profile",
  auth_middleware,
  get_user_profile_controller,
);

user_router.get(
  "/mobile/profile",
  auth_middleware,
  get_mobile_profile_controller,
);

user_router.post(
  "/push-devices",
  auth_middleware,
  register_push_device_controller,
);

user_router.delete(
  "/push-devices",
  auth_middleware,
  unregister_push_device_controller,
);

user_router.get(
  "/notification-preferences",
  auth_middleware,
  get_notification_preferences_controller,
);

user_router.put(
  "/notification-preferences",
  auth_middleware,
  update_notification_preferences_controller,
);

user_router.post(
  "/meeting-telemetry",
  auth_middleware,
  report_meeting_telemetry_controller,
);

user_router.patch(
  "/profile",
  auth_middleware,
  update_user_profile_controller,
);

user_router.put(
  "/profile",
  auth_middleware,
  update_user_profile_controller,
);

user_router.post(
  "/schedule-meeting",
  auth_middleware,
  schedule_meeting_controller,
);

user_router.post(
  "/start-meeting",
  auth_middleware,
  start_instant_meeting_controller,
);

user_router.patch(
  "/meetings/room/:roomId/lifecycle",
  auth_middleware,
  update_meeting_lifecycle_controller,
);

user_router.get(
  "/mobile/meeting-inbox",
  auth_middleware,
  get_mobile_meeting_inbox_controller,
);

user_router.get(
  "/get-meeting",
  auth_middleware,
  get_meeting_controller,
);

user_router.post(
  "/delete-meeting",
  auth_middleware,
  delete_meeting_controller,
);

user_router.get(
  "/analytics/summary",
  auth_middleware,
  get_analytics_summary_controller,
);

user_router.get(
  "/analytics/attendance",
  auth_middleware,
  list_attendance_reports_controller,
);

user_router.get(
  "/recordings",
  auth_middleware,
  list_recordings_controller,
);

user_router.get(
  "/recordings/:recordingId",
  auth_middleware,
  download_recording_controller,
);

user_router.delete(
  "/recordings/:recordingId",
  auth_middleware,
  delete_recording_controller,
);

/*
 * Meeting member management — host only.
 */
user_router.get(
  "/meetings/:meetingId/members",
  auth_middleware,
  list_meeting_members_controller,
);

user_router.post(
  "/meetings/:meetingId/members",
  auth_middleware,
  invite_meeting_member_controller,
);

user_router.delete(
  "/meetings/:meetingId/members/:memberId",
  auth_middleware,
  remove_meeting_member_controller,
);

/*
 * A user accepts or declines their own invitation.
 */
user_router.patch(
  "/meeting-invitations/:memberId",
  auth_middleware,
  respond_to_meeting_invite_controller,
);

/*
 * Speaker and attendee workspaces.
 */
user_router.get(
  "/workspace/speaker/meetings",
  auth_middleware,
  list_speaker_meetings_controller,
);

user_router.get(
  "/workspace/attendee/meetings",
  auth_middleware,
  list_attendee_meetings_controller,
);

user_router.get(
  "/speaker/status",
  auth_middleware,
  get_speaker_status_controller,
);

user_router.post(
  "/speaker/status",
  auth_middleware,
  save_speaker_status_controller,
);

user_router.get(
  "/speaker/materials",
  auth_middleware,
  list_speaker_materials_controller,
);

user_router.post(
  "/speaker/materials",
  auth_middleware,
  create_speaker_material_controller,
);

user_router.get(
  "/attendee/networking",
  auth_middleware,
  list_attendee_networking_controller,
);

user_router.get(
  "/attendee/certificates",
  auth_middleware,
  list_certificates_controller,
);

user_router.post(
  "/attendee/certificates/generate",
  auth_middleware,
  generate_certificate_controller,
);

user_router.get(
  "/admin/branding",
  auth_middleware,
  get_branding_controller,
);

user_router.post(
  "/admin/branding",
  auth_middleware,
  save_branding_controller,
);

user_router.get(
  "/billing",
  auth_middleware,
  get_billing_overview_controller,
);

user_router.post(
  "/logout",
  auth_middleware,
  user_logout_controller,
);

user_router.get(
  "/logout",
  auth_middleware,
  user_logout_controller,
);

module.exports = user_router;