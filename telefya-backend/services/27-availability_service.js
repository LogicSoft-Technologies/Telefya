const { DateTime, IANAZone } = require("luxon");

const RESERVED_BOOKING_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "calendar",
  "dashboard",
  "help",
  "login",
  "meet",
  "meeting",
  "meetings",
  "profile",
  "register",
  "settings",
  "support",
  "telefya",
]);

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function numberInRange(value, fallback, minimum, maximum, label) {
  const resolved =
    value === undefined || value === null || value === ""
      ? fallback
      : Number(value);

  if (
    !Number.isInteger(resolved) ||
    resolved < minimum ||
    resolved > maximum
  ) {
    throw new Error(
      `${label} must be a whole number between ${minimum} and ${maximum}.`,
    );
  }

  return resolved;
}

function normalizeTimeZone(value) {
  const timeZone = cleanText(value, "UTC");

  if (!IANAZone.isValidZone(timeZone)) {
    throw new Error("timeZone must be a valid IANA time zone.");
  }

  return timeZone;
}

function normalizeBookingSlug(value) {
  const slug = cleanText(value).toLowerCase();

  if (!/^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$/.test(slug)) {
    throw new Error(
      "Booking link must be 3–80 characters and use only lowercase letters, numbers, and hyphens.",
    );
  }

  if (RESERVED_BOOKING_SLUGS.has(slug)) {
    throw new Error("That booking link is reserved. Choose another.");
  }

  return slug;
}

function normalizeProfile(payload = {}) {
  const displayName = cleanText(payload.displayName);

  if (!displayName || displayName.length > 120) {
    throw new Error(
      "displayName is required and must not exceed 120 characters.",
    );
  }

  const welcomeMessage = cleanText(payload.welcomeMessage);

  if (welcomeMessage.length > 500) {
    throw new Error(
      "welcomeMessage must not exceed 500 characters.",
    );
  }

  return {
    bookingSlug: normalizeBookingSlug(payload.bookingSlug),
    displayName,
    welcomeMessage: welcomeMessage || null,
    defaultDurationMinutes: numberInRange(
      payload.defaultDurationMinutes,
      30,
      15,
      240,
      "defaultDurationMinutes",
    ),
    minimumNoticeMinutes: numberInRange(
      payload.minimumNoticeMinutes,
      60,
      0,
      10080,
      "minimumNoticeMinutes",
    ),
    bookingWindowDays: numberInRange(
      payload.bookingWindowDays,
      60,
      1,
      365,
      "bookingWindowDays",
    ),
    timeZone: normalizeTimeZone(payload.timeZone),
    isActive:
      payload.isActive === undefined ? true : Boolean(payload.isActive),
  };
}

function normalizeTime(value, label) {
  const time = cleanText(value);

  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error(`${label} must use 24-hour HH:mm format.`);
  }

  return time;
}

function minutesFromTime(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeRules(value) {
  if (!Array.isArray(value)) {
    throw new Error("rules must be an array.");
  }

  if (value.length > 28) {
    throw new Error("A maximum of 28 availability windows is allowed.");
  }

  const rules = value.map((rule, index) => {
    const weekday = Number(rule?.weekday);
    const startTime = normalizeTime(rule?.startTime, `rules[${index}].startTime`);
    const endTime = normalizeTime(rule?.endTime, `rules[${index}].endTime`);

    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      throw new Error(
        `rules[${index}].weekday must be between 0 (Sunday) and 6 (Saturday).`,
      );
    }

    if (minutesFromTime(endTime) <= minutesFromTime(startTime)) {
      throw new Error(
        `rules[${index}] must end after it starts.`,
      );
    }

    return {
      weekday,
      startTime,
      endTime,
    };
  });

  const byWeekday = new Map();

  for (const rule of rules) {
    const windows = byWeekday.get(rule.weekday) || [];
    windows.push(rule);
    byWeekday.set(rule.weekday, windows);
  }

  for (const windows of byWeekday.values()) {
    windows.sort(
      (first, second) =>
        minutesFromTime(first.startTime) -
        minutesFromTime(second.startTime),
    );

    for (let index = 1; index < windows.length; index += 1) {
      const previous = windows[index - 1];
      const current = windows[index];

      if (
        minutesFromTime(current.startTime) <
        minutesFromTime(previous.endTime)
      ) {
        throw new Error(
          "Availability windows on the same weekday cannot overlap.",
        );
      }
    }
  }

  return rules.sort(
    (first, second) =>
      first.weekday - second.weekday ||
      minutesFromTime(first.startTime) -
        minutesFromTime(second.startTime),
  );
}

function serializeProfile(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    userId: row.user_id,
    bookingSlug: row.booking_slug,
    displayName: row.display_name,
    welcomeMessage: row.welcome_message || "",
    defaultDurationMinutes: Number(row.default_duration_minutes),
    minimumNoticeMinutes: Number(row.minimum_notice_minutes),
    bookingWindowDays: Number(row.booking_window_days),
    timeZone: row.time_zone,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeRule(row) {
  return {
    id: Number(row.id),
    weekday: Number(row.weekday),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
  };
}

async function getAvailabilitySettingsService(dbQuery, userId) {
  const [profiles, rules] = await Promise.all([
    dbQuery(
      `
        SELECT *
        FROM user_booking_profiles
        WHERE user_id = ?
        LIMIT 1
      `,
      [userId],
    ),
    dbQuery(
      `
        SELECT *
        FROM user_availability_rules
        WHERE user_id = ?
        ORDER BY weekday ASC, start_time ASC
      `,
      [userId],
    ),
  ]);

  return {
    success: true,
    data: {
      profile: serializeProfile(profiles?.[0]),
      rules: (rules || []).map(serializeRule),
    },
  };
}

async function saveBookingProfileService(dbQuery, userId, payload) {
  const profile = normalizeProfile(payload);

  const existingSlug = await dbQuery(
    `
      SELECT user_id
      FROM user_booking_profiles
      WHERE booking_slug = ?
      LIMIT 1
    `,
    [profile.bookingSlug],
  );

  if (
    existingSlug?.[0] &&
    String(existingSlug[0].user_id) !== String(userId)
  ) {
    throw new Error(
      "That booking link is already in use. Choose another.",
    );
  }

  await dbQuery(
    `
      INSERT INTO user_booking_profiles
      (
        user_id,
        booking_slug,
        display_name,
        welcome_message,
        default_duration_minutes,
        minimum_notice_minutes,
        booking_window_days,
        time_zone,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        booking_slug = VALUES(booking_slug),
        display_name = VALUES(display_name),
        welcome_message = VALUES(welcome_message),
        default_duration_minutes = VALUES(default_duration_minutes),
        minimum_notice_minutes = VALUES(minimum_notice_minutes),
        booking_window_days = VALUES(booking_window_days),
        time_zone = VALUES(time_zone),
        is_active = VALUES(is_active)
    `,
    [
      userId,
      profile.bookingSlug,
      profile.displayName,
      profile.welcomeMessage,
      profile.defaultDurationMinutes,
      profile.minimumNoticeMinutes,
      profile.bookingWindowDays,
      profile.timeZone,
      profile.isActive,
    ],
  );

  return getAvailabilitySettingsService(dbQuery, userId);
}

async function replaceAvailabilityRulesService(
  withTransaction,
  dbQuery,
  userId,
  payload,
) {
  const rules = normalizeRules(payload?.rules);

  await withTransaction(async (transactionQuery) => {
    await transactionQuery(
      `
        DELETE FROM user_availability_rules
        WHERE user_id = ?
      `,
      [userId],
    );

    if (!rules.length) {
      return;
    }

    await transactionQuery(
      `
        INSERT INTO user_availability_rules
        (user_id, weekday, start_time, end_time)
        VALUES ?
      `,
      [
        rules.map((rule) => [
          userId,
          rule.weekday,
          rule.startTime,
          rule.endTime,
        ]),
      ],
    );
  });

  return getAvailabilitySettingsService(dbQuery, userId);
}

function parseDate(value, label) {
  const date = new Date(cleanText(value));

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid ISO date and time.`);
  }

  return date;
}

function toMysqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }

  if (
    value === false ||
    value === "false" ||
    value === 0 ||
    value === "0"
  ) {
    return false;
  }

  throw new Error("isAvailable must be true or false.");
}

function normalizeAvailabilityException(payload = {}) {
  const startsAt = parseDate(payload.startsAt, "startsAt");
  const endsAt = parseDate(payload.endsAt, "endsAt");
  const isAvailable = normalizeBoolean(payload.isAvailable, false);
  const note = cleanText(payload.note);

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("endsAt must be after startsAt.");
  }

  if (endsAt.getTime() - startsAt.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new Error(
      "An availability exception cannot be longer than 366 days.",
    );
  }

  if (note.length > 500) {
    throw new Error("note must not exceed 500 characters.");
  }

  return {
    startsAt,
    endsAt,
    isAvailable,
    note: note || null,
  };
}

function serializeAvailabilityException(row) {
  return {
    id: Number(row.id),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isAvailable: Boolean(row.is_available),
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAvailabilityExceptionsService(
  dbQuery,
  userId,
  filters = {},
) {
  const defaultFrom = new Date();
  const defaultTo = new Date(
    defaultFrom.getTime() + 180 * 24 * 60 * 60 * 1000,
  );

  const from = filters.from
    ? parseDate(filters.from, "from")
    : defaultFrom;

  const to = filters.to
    ? parseDate(filters.to, "to")
    : defaultTo;

  if (to.getTime() <= from.getTime()) {
    throw new Error("to must be after from.");
  }

  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new Error("Exception search range cannot exceed 366 days.");
  }

  const rows = await dbQuery(
    `
      SELECT *
      FROM user_availability_exceptions
      WHERE user_id = ?
        AND starts_at < ?
        AND ends_at > ?
      ORDER BY starts_at ASC
    `,
    [userId, toMysqlDateTime(to), toMysqlDateTime(from)],
  );

  return {
    success: true,
    data: (rows || []).map(serializeAvailabilityException),
  };
}

async function createAvailabilityExceptionService(
  dbQuery,
  userId,
  payload,
) {
  const exception = normalizeAvailabilityException(payload);

  const result = await dbQuery(
    `
      INSERT INTO user_availability_exceptions
      (
        user_id,
        starts_at,
        ends_at,
        is_available,
        note
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      userId,
      toMysqlDateTime(exception.startsAt),
      toMysqlDateTime(exception.endsAt),
      exception.isAvailable,
      exception.note,
    ],
  );

  const rows = await dbQuery(
    `
      SELECT *
      FROM user_availability_exceptions
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
    `,
    [result.insertId, userId],
  );

  return {
    success: true,
    data: serializeAvailabilityException(rows?.[0]),
  };
}

async function deleteAvailabilityExceptionService(
  dbQuery,
  userId,
  exceptionId,
) {
  const id = Number(exceptionId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("A valid availability exception ID is required.");
  }

  const result = await dbQuery(
    `
      DELETE FROM user_availability_exceptions
      WHERE id = ?
        AND user_id = ?
    `,
    [id, userId],
  );

  if (!result.affectedRows) {
    throw new Error(
      "Availability exception not found or you do not have access.",
    );
  }

  return {
    success: true,
    message: "Availability exception deleted.",
  };
}

module.exports = {
  getAvailabilitySettingsService,
  saveBookingProfileService,
  replaceAvailabilityRulesService,
  getAvailabilityExceptionsService,
  createAvailabilityExceptionService,
  deleteAvailabilityExceptionService,
};