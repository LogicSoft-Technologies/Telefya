const { query } = require("../config/db");

const {
  saveMeetingRecurrenceService,
  getMeetingRecurrenceService,
  deleteMeetingRecurrenceService,
} = require("../services/24-recurrence_service");

const {
  getRequestIp,
  recordMeetingAudit,
} = require("../services/30-meeting-audit_service");
const {
  publishCalendarChange,
} = require("../services/31-calendar-realtime_service");
const {
  queueGoogleMeetingSync,
} = require("../services/34-google-calendar-sync_service");

function getAuthenticatedUserId(req) {
  const embeddedUser = req.user?.user;

  const candidates = [
    embeddedUser?.user_id,
    embeddedUser?.id,
    embeddedUser?.userId,
    typeof embeddedUser === "string" ||
    typeof embeddedUser === "number"
      ? embeddedUser
      : null,
    req.user?.user_id,
    req.user?.id,
    req.user?.userId,
  ];

  const userId = candidates.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim(),
  );

  return userId ? String(userId).trim() : "";
}

function unauthorized(res) {
  return res.status(401).json({
    success: false,
    error: true,
    status: 401,
    message: "Authenticated user is required.",
  });
}

async function save_meeting_recurrence_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await saveMeetingRecurrenceService(
      query,
      userId,
      req.params.meetingId,
      req.body,
    );

    queueGoogleMeetingSync(query, req.params.meetingId);

    publishCalendarChange(query, {
      meetingId: req.params.meetingId,
      eventType: "recurrence_saved",
    });

    recordMeetingAudit(query, {
      meetingId: req.params.meetingId,
      actorUserId: userId,
      actorType: "host",
      eventType: "RECURRENCE_SAVED",
      ipAddress: getRequestIp(req),
      metadata: {
        frequency: result.data?.frequency,
        intervalCount: result.data?.interval_count,
        weekdays: result.data?.weekdays,
        monthDay: result.data?.month_day,
        endsAt: result.data?.ends_at,
        occurrenceCount: result.data?.occurrence_count,
      },
    });

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: true,
      status: 400,
      message: error?.message || "Unable to save recurrence.",
    });
  }
}

async function get_meeting_recurrence_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await getMeetingRecurrenceService(
      query,
      userId,
      req.params.meetingId,
    );

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: true,
      status: 400,
      message: error?.message || "Unable to retrieve recurrence.",
    });
  }
}

async function delete_meeting_recurrence_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await deleteMeetingRecurrenceService(
      query,
      userId,
      req.params.meetingId,
    );

    queueGoogleMeetingSync(query, req.params.meetingId);

    publishCalendarChange(query, {
      meetingId: req.params.meetingId,
      eventType: "recurrence_removed",
    });

    recordMeetingAudit(query, {
      meetingId: req.params.meetingId,
      actorUserId: userId,
      actorType: "host",
      eventType: "RECURRENCE_REMOVED",
      ipAddress: getRequestIp(req),
      metadata: {},
    });

    return res.status(200).json({
      ...result,
      error: false,
      status: 200,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: true,
      status: 400,
      message: error?.message || "Unable to remove recurrence.",
    });
  }
}

module.exports = {
  save_meeting_recurrence_controller,
  get_meeting_recurrence_controller,
  delete_meeting_recurrence_controller,
};

