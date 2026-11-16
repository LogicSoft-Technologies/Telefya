const { query } = require("../config/db");

const {
  saveRecurrenceExceptionService,
  deleteRecurrenceExceptionService,
} = require("../services/26-recurrence-exception_service");
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

async function save_recurrence_exception_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await saveRecurrenceExceptionService(
      query,
      userId,
      req.params.meetingId,
      req.body,
    );
    queueGoogleMeetingSync(query, req.params.meetingId);
    publishCalendarChange(query, {
      meetingId: req.params.meetingId,
      eventType: "occurrence_updated",
    });
    recordMeetingAudit(query, {
      meetingId: req.params.meetingId,
      actorUserId: userId,
      actorType: "host",
      eventType: "RECURRENCE_OCCURRENCE_CHANGED",
      ipAddress: getRequestIp(req),
      metadata: {
        occurrenceStartsAt: req.body?.occurrenceStartsAt,
        exceptionType: req.body?.exceptionType,
        rescheduledFor: req.body?.rescheduledFor || null,
        durationMinutes: req.body?.durationMinutes || null,
        title: req.body?.title || null,
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
      message:
        error?.message ||
        "Unable to save meeting occurrence exception.",
    });
  }
}

async function delete_recurrence_exception_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return unauthorized(res);
    }

    const result = await deleteRecurrenceExceptionService(
      query,
      userId,
      req.params.meetingId,
      req.body?.occurrenceStartsAt,
    );
    queueGoogleMeetingSync(query, req.params.meetingId);
    publishCalendarChange(query, {
      meetingId: req.params.meetingId,
      eventType: "occurrence_restored",
    });
    recordMeetingAudit(query, {
      meetingId: req.params.meetingId,
      actorUserId: userId,
      actorType: "host",
      eventType: "RECURRENCE_OCCURRENCE_RESTORED",
      ipAddress: getRequestIp(req),
      metadata: {
        occurrenceStartsAt: req.body?.occurrenceStartsAt,
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
      message:
        error?.message ||
        "Unable to remove meeting occurrence exception.",
    });
  }
}

module.exports = {
  save_recurrence_exception_controller,
  delete_recurrence_exception_controller,
};

