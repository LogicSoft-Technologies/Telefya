const {
  sendMeetingCancellationEmail,
  sendMeetingUpdateEmail,
} = require("./meeting-invitation-email");
const {
  expandCalendarEvents,
} = require("./25-recurrence-expansion_service");

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toMysqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseDate(value, label) {
  const date = new Date(cleanText(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid ISO date and time.`);
  }

  return date;
}

function parseMeetingId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("A valid meeting ID is required.");
  }

  return id;
}

function normalizeDuration(value, fallback = 60) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const duration = Number(value);

  if (
    !Number.isInteger(duration) ||
    duration < 15 ||
    duration > 1440
  ) {
    throw new Error(
      "Meeting duration must be a whole number between 15 and 1440 minutes.",
    );
  }

  return duration;
}

function normalizeTitle(value, fallback = "Telefya meeting") {
  const title = cleanText(value, fallback);

  if (title.length > 220) {
    throw new Error("Meeting title must not exceed 220 characters.");
  }

  return title;
}

async function getMeetingInvitationRecipients(dbQuery, meetingId) {
  return dbQuery(
    `
      SELECT DISTINCT email
      FROM (
        SELECT u.email
        FROM meeting_members mm
        INNER JOIN users u ON u.user_id = mm.user_id
        WHERE mm.meeting_id = ?
          AND mm.status IN ('invited', 'accepted')

        UNION

        SELECT email
        FROM meeting_guest_invitations
        WHERE meeting_id = ?
          AND delivery_status = 'sent'
      ) AS invitation_recipients
      WHERE email IS NOT NULL
        AND TRIM(email) <> ''
    `,
    [meetingId, meetingId],
  );
}

function notifyMeetingUpdated(dbQuery, meeting) {
  void getMeetingInvitationRecipients(dbQuery, meeting.id)
    .then((recipients) =>
      Promise.allSettled(
        recipients.map(({ email }) =>
          sendMeetingUpdateEmail({
            meetingId: meeting.id,
            email,
            hostName: meeting.host_name || "The host",
            meetingUrl: meeting.meeting_url,
            meetingTitle: meeting.des || "Telefya meeting",
            scheduledFor: meeting.scheduled_for,
            durationMinutes: meeting.duration_minutes,
            calendarSequence: meeting.calendar_sequence,
          }),
        ),
      ),
    )
    .then((results) => {
      results.forEach((result) => {
        if (result.status === "rejected") {
          console.warn(
            "[calendar-update] Email delivery failed:",
            result.reason?.message || result.reason,
          );
        }
      });
    })
    .catch((error) => {
      console.warn(
        "[calendar-update] Could not prepare notifications:",
        error?.message || error,
      );
    });
}

async function getCalendarEventsService(dbQuery, userId, query) {
  const from = parseDate(query.from, "from");
  const to = parseDate(query.to, "to");

  if (to <= from) {
    throw new Error("to must be after from.");
  }

  const maxRangeMs = 93 * 24 * 60 * 60 * 1000;

  if (to.getTime() - from.getTime() > maxRangeMs) {
    throw new Error("Calendar range cannot exceed 93 days.");
  }

  const includeCancelled =
    String(query.includeCancelled || "false").toLowerCase() ===
    "true";

  const fromMysql = toMysqlDateTime(from);
  const toMysql = toMysqlDateTime(to);

  const meetings = await dbQuery(
    `
      SELECT
        m.id,
        m.room_id,
        m.meeting_url,
        COALESCE(NULLIF(m.des, ''), 'Telefya meeting') AS title,
        m.des,
        m.scheduled_for,
        m.duration_minutes,
        m.time_zone,
        m.status,
        m.started_at,
        m.ended_at,
        m.cancelled_at,
        m.cancellation_reason,
        m.calendar_sequence,
        m.shedular_user_id AS host_user_id,
        CONCAT_WS(' ', host.first_name, host.last_name) AS host_name,
        CASE
          WHEN m.shedular_user_id = ? THEN 'host'
          WHEN member.id IS NOT NULL THEN member.member_role
          ELSE 'guest'
        END AS viewer_role,
        member.status AS invitation_status
      FROM meeting_schedules m
      LEFT JOIN users host
        ON host.user_id = m.shedular_user_id
      LEFT JOIN meeting_members member
        ON member.meeting_id = m.id
        AND member.user_id = ?
      LEFT JOIN users viewer
        ON viewer.user_id = ?
      LEFT JOIN meeting_guest_invitations guest
        ON guest.meeting_id = m.id
        AND LOWER(guest.email) = LOWER(viewer.email)
      LEFT JOIN meeting_recurrence_rules recurrence
        ON recurrence.meeting_id = m.id
      WHERE (
        m.shedular_user_id = ?
        OR member.id IS NOT NULL
        OR guest.id IS NOT NULL
      )
        AND (
          (
            recurrence.meeting_id IS NULL
            AND m.scheduled_for < ?
            AND DATE_ADD(
              m.scheduled_for,
              INTERVAL m.duration_minutes MINUTE
            ) > ?
          )
          OR (
            recurrence.meeting_id IS NOT NULL
            AND m.scheduled_for < ?
            AND (
              recurrence.ends_at IS NULL
              OR recurrence.ends_at >= ?
            )
          )
        )
        AND (
          ? = TRUE
          OR m.status <> 'cancelled'
        )
      ORDER BY m.scheduled_for ASC
    `,
    [
      userId,
      userId,
      userId,
      userId,
      toMysql,
      fromMysql,
      toMysql,
      fromMysql,
      includeCancelled,
    ],
  );

  const meetingIds = meetings
    .map((meeting) => Number(meeting.id))
    .filter(Number.isInteger);

  if (!meetingIds.length) {
    return {
      success: true,
      message: "Calendar events retrieved successfully.",
      data: [],
    };
  }

  const placeholders = meetingIds.map(() => "?").join(", ");

  const rules = await dbQuery(
    `
      SELECT
        id,
        meeting_id,
        frequency,
        interval_count,
        weekdays,
        month_day,
        ends_at,
        occurrence_count
      FROM meeting_recurrence_rules
      WHERE meeting_id IN (${placeholders})
    `,
    meetingIds,
  );

  const exceptions = await dbQuery(
    `
      SELECT
        id,
        meeting_id,
        occurrence_starts_at,
        exception_type,
        rescheduled_for,
        duration_minutes,
        title
      FROM meeting_recurrence_exceptions
      WHERE meeting_id IN (${placeholders})
    `,
    meetingIds,
  );

  return {
    success: true,
    message: "Calendar events retrieved successfully.",
    data: expandCalendarEvents({
      meetings,
      rules,
      exceptions,
      from: from.toISOString(),
      to: to.toISOString(),
    }),
  };
}

async function updateCalendarEventService(
  dbQuery,
  userId,
  meetingId,
  payload,
) {
  const id = parseMeetingId(meetingId);

  const rows = await dbQuery(
    `
      SELECT *
      FROM meeting_schedules
      WHERE id = ?
        AND shedular_user_id = ?
      LIMIT 1
    `,
    [id, userId],
  );

  const meeting = rows?.[0];

  if (!meeting) {
    throw new Error("Meeting not found or you are not the host.");
  }

  if (meeting.status !== "upcoming") {
    throw new Error("Only upcoming meetings can be edited.");
  }

  const scheduledFor =
    payload.scheduledFor === undefined
      ? new Date(
          `${String(meeting.scheduled_for).replace(" ", "T")}Z`,
        )
      : parseDate(payload.scheduledFor, "scheduledFor");

  if (scheduledFor.getTime() < Date.now() - 60_000) {
    throw new Error("A meeting cannot be scheduled in the past.");
  }

  const title = normalizeTitle(payload.title, meeting.des);
  const durationMinutes = normalizeDuration(
    payload.durationMinutes,
    Number(meeting.duration_minutes || 60),
  );

  const timeZone = cleanText(payload.timeZone, meeting.time_zone);

  if (timeZone.length > 100) {
    throw new Error("Timezone is invalid.");
  }

  await dbQuery(
    `
      UPDATE meeting_schedules
      SET
        des = ?,
        scheduled_for = ?,
        duration_minutes = ?,
        time_zone = ?,
        calendar_sequence = calendar_sequence + 1,
        updated_by_user_id = ?
      WHERE id = ?
        AND shedular_user_id = ?
    `,
    [
      title,
      toMysqlDateTime(scheduledFor),
      durationMinutes,
      timeZone,
      userId,
      id,
      userId,
    ],
  );

  const updated = await dbQuery(
    `
      SELECT
        m.id,
        m.room_id,
        m.meeting_url,
        m.des,
        m.scheduled_for,
        m.duration_minutes,
        m.time_zone,
        m.status,
        m.calendar_sequence,
        CONCAT_WS(' ', host.first_name, host.last_name) AS host_name
      FROM meeting_schedules m
      LEFT JOIN users host
        ON host.user_id = m.shedular_user_id
      WHERE m.id = ?
      LIMIT 1
    `,
    [id],
  );

  const updatedMeeting = updated[0];

  notifyMeetingUpdated(dbQuery, updatedMeeting);

  return {
    success: true,
    message: "Meeting updated successfully.",
    data: updatedMeeting,
  };
}

async function cancelCalendarEventService(
  dbQuery,
  userId,
  meetingId,
  payload = {},
) {
  const id = parseMeetingId(meetingId);
  const reason = cleanText(payload.reason).slice(0, 500) || null;

  const rows = await dbQuery(
    `
      SELECT
        m.*,
        CONCAT_WS(' ', host.first_name, host.last_name) AS host_name
      FROM meeting_schedules m
      LEFT JOIN users host
        ON host.user_id = m.shedular_user_id
      WHERE m.id = ?
        AND m.shedular_user_id = ?
      LIMIT 1
    `,
    [id, userId],
  );

  const meeting = rows?.[0];

  if (!meeting) {
    throw new Error("Meeting not found or you are not the host.");
  }

  if (meeting.status === "cancelled") {
    return {
      success: true,
      message: "Meeting is already cancelled.",
      data: meeting,
    };
  }

  if (meeting.status !== "upcoming") {
    throw new Error("Only upcoming meetings can be cancelled.");
  }

  await dbQuery(
    `
      UPDATE meeting_schedules
      SET
        status = 'cancelled',
        cancelled_at = NOW(),
        cancellation_reason = ?,
        calendar_sequence = calendar_sequence + 1,
        updated_by_user_id = ?
      WHERE id = ?
        AND shedular_user_id = ?
    `,
    [reason, userId, id, userId],
  );

  const recipients = await dbQuery(
    `
      SELECT DISTINCT email
      FROM (
        SELECT u.email
        FROM meeting_members mm
        INNER JOIN users u ON u.user_id = mm.user_id
        WHERE mm.meeting_id = ?
          AND mm.status IN ('invited', 'accepted')

        UNION

        SELECT email
        FROM meeting_guest_invitations
        WHERE meeting_id = ?
          AND delivery_status = 'sent'
      ) AS invitation_recipients
      WHERE email IS NOT NULL
        AND TRIM(email) <> ''
    `,
    [id, id],
  );

  const calendarSequence =
    Number(meeting.calendar_sequence || 0) + 1;

  void Promise.allSettled(
    recipients.map(({ email }) =>
      sendMeetingCancellationEmail({
        meetingId: meeting.id,
        email,
        hostName: meeting.host_name || "The host",
        meetingUrl: meeting.meeting_url,
        meetingTitle: meeting.des || "Telefya meeting",
        scheduledFor: meeting.scheduled_for,
        calendarSequence,
      }),
    ),
  ).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") {
        console.warn(
          "[calendar-cancellation] Email delivery failed:",
          result.reason?.message || result.reason,
        );
      }
    });
  });

  return {
    success: true,
    message: "Meeting cancelled successfully.",
    data: {
      id: meeting.id,
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      calendar_sequence: calendarSequence,
    },
  };
}

module.exports = {
  getCalendarEventsService,
  updateCalendarEventService,
  cancelCalendarEventService,
};