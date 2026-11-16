const { DateTime } = require("luxon");

const {
  expandRecurringMeeting,
} = require("./25-recurrence-expansion_service");

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function parseMeetingId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("A valid meeting ID is required.");
  }

  return id;
}

function parseFutureDate(value, label) {
  const date = DateTime.fromISO(String(value || ""), {
    zone: "utc",
  });

  if (!date.isValid) {
    throw new Error(`${label} must be a valid ISO date and time.`);
  }

  if (date.toMillis() < Date.now() - 60_000) {
    throw new Error(`${label} cannot be in the past.`);
  }

  return date;
}

function toMysqlUtc(value) {
  return value
    .toUTC()
    .toFormat("yyyy-LL-dd HH:mm:ss");
}

function normalizeDuration(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const duration = Number(value);

  if (
    !Number.isInteger(duration) ||
    duration < 15 ||
    duration > 1440
  ) {
    throw new Error(
      "Duration must be between 15 and 1440 minutes.",
    );
  }

  return duration;
}

async function getOwnedRecurringMeeting(
  dbQuery,
  meetingId,
  userId,
) {
  const rows = await dbQuery(
    `
      SELECT
        m.*,
        r.frequency,
        r.interval_count,
        r.weekdays,
        r.month_day,
        r.ends_at,
        r.occurrence_count
      FROM meeting_schedules m
      INNER JOIN meeting_recurrence_rules r
        ON r.meeting_id = m.id
      WHERE m.id = ?
        AND m.shedular_user_id = ?
        AND m.status = 'upcoming'
      LIMIT 1
    `,
    [meetingId, userId],
  );

  return rows?.[0] || null;
}

function isActualOccurrence(meeting, occurrenceStartsAt) {
  const startsAt = DateTime.fromSQL(
    occurrenceStartsAt,
    { zone: "utc" },
  );

  const occurrences = expandRecurringMeeting({
    meeting,
    rule: meeting,
    exceptions: [],
    from: startsAt.minus({ minutes: 1 }),
    to: startsAt.plus({ minutes: 1 }),
  });

  return occurrences.some(
    (occurrence) =>
      occurrence.occurrence_starts_at === occurrenceStartsAt,
  );
}

async function saveRecurrenceExceptionService(
  dbQuery,
  userId,
  meetingId,
  payload,
) {
  const id = parseMeetingId(meetingId);
  const meeting = await getOwnedRecurringMeeting(
    dbQuery,
    id,
    userId,
  );

  if (!meeting) {
    throw new Error(
      "Recurring meeting not found or you are not the host.",
    );
  }

  const occurrence = parseFutureDate(
    payload.occurrenceStartsAt,
    "Occurrence start time",
  );

  const occurrenceStartsAt = toMysqlUtc(occurrence);

  if (!isActualOccurrence(meeting, occurrenceStartsAt)) {
    throw new Error(
      "This date is not a valid occurrence in the meeting series.",
    );
  }

  const exceptionType = cleanText(
    payload.exceptionType,
  ).toLowerCase();

  if (
    exceptionType !== "cancelled" &&
    exceptionType !== "rescheduled"
  ) {
    throw new Error(
      "Exception type must be cancelled or rescheduled.",
    );
  }

  const rescheduledFor =
    exceptionType === "rescheduled"
      ? parseFutureDate(
          payload.rescheduledFor,
          "Rescheduled time",
        )
      : null;

  if (
    exceptionType === "rescheduled" &&
    !rescheduledFor
  ) {
    throw new Error(
      "A new meeting time is required to reschedule an occurrence.",
    );
  }

  const durationMinutes = normalizeDuration(
    payload.durationMinutes,
  );

  const title = cleanText(payload.title).slice(0, 220) || null;

  await dbQuery(
    `
      INSERT INTO meeting_recurrence_exceptions
      (
        meeting_id,
        occurrence_starts_at,
        exception_type,
        rescheduled_for,
        duration_minutes,
        title,
        created_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        exception_type = VALUES(exception_type),
        rescheduled_for = VALUES(rescheduled_for),
        duration_minutes = VALUES(duration_minutes),
        title = VALUES(title),
        created_by_user_id = VALUES(created_by_user_id)
    `,
    [
      id,
      occurrenceStartsAt,
      exceptionType,
      rescheduledFor
        ? toMysqlUtc(rescheduledFor)
        : null,
      durationMinutes,
      title,
      userId,
    ],
  );

  return {
    success: true,
    message:
      exceptionType === "cancelled"
        ? "Meeting occurrence cancelled."
        : "Meeting occurrence rescheduled.",
  };
}

async function deleteRecurrenceExceptionService(
  dbQuery,
  userId,
  meetingId,
  occurrenceStartsAt,
) {
  const id = parseMeetingId(meetingId);

  const meeting = await getOwnedRecurringMeeting(
    dbQuery,
    id,
    userId,
  );

  if (!meeting) {
    throw new Error(
      "Recurring meeting not found or you are not the host.",
    );
  }

  const occurrence = parseFutureDate(
    occurrenceStartsAt,
    "Occurrence start time",
  );

  await dbQuery(
    `
      DELETE FROM meeting_recurrence_exceptions
      WHERE meeting_id = ?
        AND occurrence_starts_at = ?
    `,
    [id, toMysqlUtc(occurrence)],
  );

  return {
    success: true,
    message: "Occurrence exception removed.",
  };
}

module.exports = {
  saveRecurrenceExceptionService,
  deleteRecurrenceExceptionService,
};