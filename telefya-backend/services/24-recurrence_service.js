
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

function parseOptionalDate(value, label) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid ISO date and time.`);
  }

  return date;
}

function toMysqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeInterval(value) {
  const interval = Number(value ?? 1);

  if (
    !Number.isInteger(interval) ||
    interval < 1 ||
    interval > 52
  ) {
    throw new Error(
      "Repeat interval must be a whole number between 1 and 52.",
    );
  }

  return interval;
}

function normalizeWeekdays(value, frequency) {
  if (frequency !== "weekly") {
    return null;
  }

  const values = Array.isArray(value) ? value : [];

  const days = [...new Set(values.map(Number))]
    .filter(
      (day) =>
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6,
    )
    .sort((first, second) => first - second);

  if (!days.length) {
    throw new Error(
      "Weekly recurrence requires at least one weekday.",
    );
  }

  return days;
}

function normalizeMonthDay(value, frequency) {
  if (frequency !== "monthly") {
    return null;
  }

  const day = Number(value);

  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(
      "Monthly recurrence requires a day between 1 and 31.",
    );
  }

  return day;
}

function normalizeOccurrenceCount(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const count = Number(value);

  if (!Number.isInteger(count) || count < 2 || count > 365) {
    throw new Error(
      "Occurrence count must be between 2 and 365.",
    );
  }

  return count;
}

function normalizeRule(row) {
  if (!row) return null;

  let weekdays = row.weekdays;

  if (typeof weekdays === "string") {
    try {
      weekdays = JSON.parse(weekdays);
    } catch {
      weekdays = null;
    }
  }

  return {
    ...row,
    interval_count: Number(row.interval_count),
    occurrence_count: row.occurrence_count
      ? Number(row.occurrence_count)
      : null,
    month_day: row.month_day ? Number(row.month_day) : null,
    weekdays: Array.isArray(weekdays) ? weekdays.map(Number) : null,
  };
}

async function getOwnedMeeting(dbQuery, meetingId, userId) {
  const rows = await dbQuery(
    `
      SELECT
        id,
        scheduled_for,
        time_zone,
        status
      FROM meeting_schedules
      WHERE id = ?
        AND shedular_user_id = ?
      LIMIT 1
    `,
    [meetingId, userId],
  );

  return rows?.[0] || null;
}

async function saveMeetingRecurrenceService(
  dbQuery,
  userId,
  meetingId,
  payload,
) {
  const id = parseMeetingId(meetingId);
  const meeting = await getOwnedMeeting(dbQuery, id, userId);

  if (!meeting) {
    throw new Error("Meeting not found or you are not the host.");
  }

  if (meeting.status !== "upcoming") {
    throw new Error(
      "Only upcoming meetings can be made recurring.",
    );
  }

  const frequency = cleanText(payload.frequency).toLowerCase();

  if (!["daily", "weekly", "monthly"].includes(frequency)) {
    throw new Error(
      "Frequency must be daily, weekly, or monthly.",
    );
  }

  const intervalCount = normalizeInterval(payload.intervalCount);
  const weekdays = normalizeWeekdays(payload.weekdays, frequency);
  const monthDay = normalizeMonthDay(payload.monthDay, frequency);
  const endsAt = parseOptionalDate(payload.endsAt, "endsAt");
  const occurrenceCount = normalizeOccurrenceCount(
    payload.occurrenceCount,
  );

  if (endsAt && endsAt.getTime() <= new Date(meeting.scheduled_for).getTime()) {
    throw new Error(
      "Recurrence end date must be after the first meeting.",
    );
  }

  if (endsAt && occurrenceCount) {
    throw new Error(
      "Choose either an end date or an occurrence count, not both.",
    );
  }

  await dbQuery(
    `
      INSERT INTO meeting_recurrence_rules
      (
        meeting_id,
        frequency,
        interval_count,
        weekdays,
        month_day,
        ends_at,
        occurrence_count,
        created_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        frequency = VALUES(frequency),
        interval_count = VALUES(interval_count),
        weekdays = VALUES(weekdays),
        month_day = VALUES(month_day),
        ends_at = VALUES(ends_at),
        occurrence_count = VALUES(occurrence_count)
    `,
    [
      id,
      frequency,
      intervalCount,
      weekdays ? JSON.stringify(weekdays) : null,
      monthDay,
      endsAt ? toMysqlDateTime(endsAt) : null,
      occurrenceCount,
      userId,
    ],
  );

  const rules = await dbQuery(
    `
      SELECT *
      FROM meeting_recurrence_rules
      WHERE meeting_id = ?
      LIMIT 1
    `,
    [id],
  );

  return {
    success: true,
    message: "Recurring meeting settings saved.",
    data: normalizeRule(rules?.[0]),
  };
}

async function getMeetingRecurrenceService(
  dbQuery,
  userId,
  meetingId,
) {
  const id = parseMeetingId(meetingId);
  const meeting = await getOwnedMeeting(dbQuery, id, userId);

  if (!meeting) {
    throw new Error("Meeting not found or you are not the host.");
  }

  const rules = await dbQuery(
    `
      SELECT *
      FROM meeting_recurrence_rules
      WHERE meeting_id = ?
      LIMIT 1
    `,
    [id],
  );

  return {
    success: true,
    message: "Recurring meeting settings retrieved.",
    data: normalizeRule(rules?.[0]),
  };
}

async function deleteMeetingRecurrenceService(
  dbQuery,
  userId,
  meetingId,
) {
  const id = parseMeetingId(meetingId);
  const meeting = await getOwnedMeeting(dbQuery, id, userId);

  if (!meeting) {
    throw new Error("Meeting not found or you are not the host.");
  }

  await dbQuery(
    `
      DELETE FROM meeting_recurrence_rules
      WHERE meeting_id = ?
    `,
    [id],
  );

  return {
    success: true,
    message: "Recurring meeting settings removed.",
  };
}

module.exports = {
  saveMeetingRecurrenceService,
  getMeetingRecurrenceService,
  deleteMeetingRecurrenceService,
};