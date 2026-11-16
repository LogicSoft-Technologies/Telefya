const { query } = require("../config/db");

const {
  getCalendarEventsService,
  updateCalendarEventService,
  cancelCalendarEventService,
} = require("../services/23-calendar_service");
const {
  getRequestIp,
  recordMeetingAudit,
  getMeetingAuditHistory,
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

async function get_calendar_events_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await getCalendarEventsService(
      query,
      userId,
      req.query,
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
      message: error?.message || "Unable to retrieve calendar events.",
    });
  }
}

async function update_calendar_event_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await updateCalendarEventService(
      query,
      userId,
      req.params.meetingId,
      req.body,
    );

    recordMeetingAudit(query, {
      meetingId: result.data?.id,
      actorUserId: userId,
      actorType: "host",
      eventType: "MEETING_RESCHEDULED",
      ipAddress: getRequestIp(req),
      metadata: {
        title: result.data?.des,
        scheduledFor: result.data?.scheduled_for,
        durationMinutes: result.data?.duration_minutes,
        timeZone: result.data?.time_zone,
        calendarSequence: result.data?.calendar_sequence,
      },
    });

    queueGoogleMeetingSync(query, result.data?.id);

    publishCalendarChange(query, {
      meetingId: result.data?.id,
      eventType: "meeting_updated",
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
      message: error?.message || "Unable to update calendar event.",
    });
  }
}

async function cancel_calendar_event_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await cancelCalendarEventService(
      query,
      userId,
      req.params.meetingId,
      req.body,
    );

    if (result.message !== "Meeting is already cancelled.") {
      recordMeetingAudit(query, {
        meetingId: result.data?.id,
        actorUserId: userId,
        actorType: "host",
        eventType: "MEETING_CANCELLED",
        ipAddress: getRequestIp(req),
        metadata: {
          reason: req.body?.reason || null,
          calendarSequence: result.data?.calendar_sequence,
        },
      });
    }

    queueGoogleMeetingSync(query, result.data?.id);

    publishCalendarChange(query, {
      meetingId: result.data?.id,
      eventType: "meeting_cancelled",
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
      message: error?.message || "Unable to cancel calendar event.",
    });
  }
}

async function get_calendar_event_audit_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await getMeetingAuditHistory(
      query,
      req.params.meetingId,
      userId,
      req.query,
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
      message: error?.message || "Unable to load meeting history.",
    });
  }
}

module.exports = {
  get_calendar_events_controller,
  update_calendar_event_controller,
  cancel_calendar_event_controller,
  get_calendar_event_audit_controller,
};

