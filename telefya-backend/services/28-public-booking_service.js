const { DateTime, IANAZone } = require("luxon");

const {
  expandCalendarEvents,
} = require("./25-recurrence-expansion_service");

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeSlug(value) {
  const slug = cleanText(value).toLowerCase();

  if (!/^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$/.test(slug)) {
    throw new Error("Booking page not found.");
  }

  return slug;
}

function toUtcDateTime(value) {
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: "utc" });
  }

  const raw = String(value ?? "").trim();

  if (!raw) {
    return DateTime.invalid("Missing date");
  }

  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
      ? `${raw.replace(" ", "T")}Z`
      : raw;

  return DateTime.fromISO(normalized, { zone: "utc" });
}

function toMysqlUtc(value) {
  return value
    .toUTC()
    .toFormat("yyyy-LL-dd HH:mm:ss");
}

function parseCalendarDate(value, label) {
  const raw = cleanText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`${label} must use YYYY-MM-DD format.`);
  }

  return raw;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value)
    .slice(0, 5)
    .split(":")
    .map(Number);

  return hours * 60 + minutes;
}

function intervalsOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return (
    firstStart.toMillis() < secondEnd.toMillis() &&
    firstEnd.toMillis() > secondStart.toMillis()
  );
}

function getTimeZone(profile) {
  const timeZone = cleanText(profile.time_zone, "UTC");

  if (!IANAZone.isValidZone(timeZone)) {
    throw new Error("The host booking page has an invalid time zone.");
  }

  return timeZone;
}

async function getActiveBookingProfile(dbQuery, slug) {
  const rows = await dbQuery(
    `
      SELECT
        id,
        user_id,
        booking_slug,
        display_name,
        welcome_message,
        default_duration_minutes,
        minimum_notice_minutes,
        booking_window_days,
        time_zone,
        is_active
      FROM user_booking_profiles
      WHERE booking_slug = ?
        AND is_active = TRUE
      LIMIT 1
    `,
    [slug],
  );

  return rows?.[0] || null;
}

function serializePublicProfile(profile) {
  return {
    bookingSlug: profile.booking_slug,
    displayName: profile.display_name,
    welcomeMessage: profile.welcome_message || "",
    durationMinutes: Number(profile.default_duration_minutes),
    timeZone: profile.time_zone,
  };
}

async function getPublicBookingProfileService(dbQuery, rawSlug) {
  const slug = normalizeSlug(rawSlug);
  const profile = await getActiveBookingProfile(dbQuery, slug);

  if (!profile) {
    throw new Error("Booking page not found.");
  }

  return {
    success: true,
    data: serializePublicProfile(profile),
  };
}

function buildAvailabilityIntervals({
  day,
  rules,
  exceptions,
  timeZone,
}) {
  const weekday = day.weekday % 7;
  const intervals = [];

  for (const rule of rules) {
    if (Number(rule.weekday) !== weekday) {
      continue;
    }

    const startMinutes = timeToMinutes(rule.start_time);
    const endMinutes = timeToMinutes(rule.end_time);

    intervals.push({
      startsAt: day.startOf("day").plus({ minutes: startMinutes }),
      endsAt: day.startOf("day").plus({ minutes: endMinutes }),
    });
  }

  for (const exception of exceptions) {
    if (!Boolean(exception.is_available)) {
      continue;
    }

    const startsAt = toUtcDateTime(exception.starts_at).setZone(timeZone);
    const endsAt = toUtcDateTime(exception.ends_at).setZone(timeZone);

    if (
      startsAt.isValid &&
      endsAt.isValid &&
      intervalsOverlap(
        startsAt,
        endsAt,
        day.startOf("day"),
        day.endOf("day").plus({ milliseconds: 1 }),
      )
    ) {
      intervals.push({ startsAt, endsAt });
    }
  }

  return intervals;
}

function isBlockedByException({
  startsAt,
  endsAt,
  exceptions,
}) {
  return exceptions.some((exception) => {
    if (Boolean(exception.is_available)) {
      return false;
    }

    const blockedStart = toUtcDateTime(exception.starts_at);
    const blockedEnd = toUtcDateTime(exception.ends_at);

    return (
      blockedStart.isValid &&
      blockedEnd.isValid &&
      intervalsOverlap(
        startsAt.toUTC(),
        endsAt.toUTC(),
        blockedStart,
        blockedEnd,
      )
    );
  });
}

function isBusy({ startsAt, endsAt, busyIntervals }) {
  return busyIntervals.some((busy) =>
    intervalsOverlap(
      startsAt.toUTC(),
      endsAt.toUTC(),
      busy.startsAt,
      busy.endsAt,
    ),
  );
}

async function getPublicBookingSlotsService(
  dbQuery,
  rawSlug,
  filters = {},
) {
  const slug = normalizeSlug(rawSlug);
  const profile = await getActiveBookingProfile(dbQuery, slug);

  if (!profile) {
    throw new Error("Booking page not found.");
  }

  const timeZone = getTimeZone(profile);
  const today = DateTime.now().setZone(timeZone).startOf("day");

  const fromDate = DateTime.fromISO(
    parseCalendarDate(
      filters.from || today.toISODate(),
      "from",
    ),
    { zone: timeZone },
  ).startOf("day");

  const toDate = DateTime.fromISO(
    parseCalendarDate(
      filters.to ||
        fromDate.plus({ days: 6 }).toISODate(),
      "to",
    ),
    { zone: timeZone },
  ).startOf("day");

  if (!fromDate.isValid || !toDate.isValid) {
    throw new Error("Invalid booking date range.");
  }

  if (toDate.toMillis() < fromDate.toMillis()) {
    throw new Error("to must be on or after from.");
  }

  const dayCount = Math.floor(
    toDate.diff(fromDate, "days").days,
  ) + 1;

  if (dayCount > 31) {
    throw new Error("A booking search can cover at most 31 days.");
  }

  if (fromDate.toMillis() < today.toMillis()) {
    throw new Error("Booking availability cannot be requested in the past.");
  }

  const finalBookableDate = today.plus({
    days: Number(profile.booking_window_days) - 1,
  });

  if (toDate.toMillis() > finalBookableDate.toMillis()) {
    throw new Error(
      `This host accepts bookings up to ${Number(
        profile.booking_window_days,
      )} days ahead.`,
    );
  }

  const rangeStart = fromDate.toUTC();
  const rangeEnd = toDate
    .plus({ days: 1 })
    .startOf("day")
    .toUTC();

  const [
    rules,
    exceptions,
    meetings,
    recurrenceRules,
    recurrenceExceptions,
    bookings,
  ] = await Promise.all([
    dbQuery(
      `
        SELECT weekday, start_time, end_time
        FROM user_availability_rules
        WHERE user_id = ?
        ORDER BY weekday ASC, start_time ASC
      `,
      [profile.user_id],
    ),
    dbQuery(
      `
        SELECT starts_at, ends_at, is_available, note
        FROM user_availability_exceptions
        WHERE user_id = ?
          AND starts_at < ?
          AND ends_at > ?
      `,
      [
        profile.user_id,
        toMysqlUtc(rangeEnd),
        toMysqlUtc(rangeStart),
      ],
    ),
    dbQuery(
      `
        SELECT
          id,
          scheduled_for,
          duration_minutes,
          des,
          time_zone,
          status
        FROM meeting_schedules
        WHERE shedular_user_id = ?
          AND status IN ('upcoming', 'live')
          AND scheduled_for < ?
      `,
      [profile.user_id, toMysqlUtc(rangeEnd)],
    ),
    dbQuery(
      `
        SELECT recurrence.*
        FROM meeting_recurrence_rules recurrence
        INNER JOIN meeting_schedules meeting
          ON meeting.id = recurrence.meeting_id
        WHERE meeting.shedular_user_id = ?
          AND meeting.status IN ('upcoming', 'live')
          AND meeting.scheduled_for < ?
      `,
      [profile.user_id, toMysqlUtc(rangeEnd)],
    ),
    dbQuery(
      `
        SELECT exception.*
        FROM meeting_recurrence_exceptions exception
        INNER JOIN meeting_schedules meeting
          ON meeting.id = exception.meeting_id
        WHERE meeting.shedular_user_id = ?
          AND meeting.status IN ('upcoming', 'live')
          AND meeting.scheduled_for < ?
      `,
      [profile.user_id, toMysqlUtc(rangeEnd)],
    ),
    dbQuery(
      `
        SELECT starts_at, ends_at
        FROM meeting_bookings
        WHERE host_user_id = ?
          AND status = 'confirmed'
          AND starts_at < ?
          AND ends_at > ?
      `,
      [
        profile.user_id,
        toMysqlUtc(rangeEnd),
        toMysqlUtc(rangeStart),
      ],
    ),
  ]);

  const calendarBusy = expandCalendarEvents({
    meetings: meetings || [],
    rules: recurrenceRules || [],
    exceptions: recurrenceExceptions || [],
    from: rangeStart.toISO(),
    to: rangeEnd.toISO(),
  })
    .map((event) => ({
      startsAt: toUtcDateTime(event.scheduled_for),
      endsAt: toUtcDateTime(event.ends_at),
    }))
    .filter(
      (event) =>
        event.startsAt.isValid &&
        event.endsAt.isValid &&
        intervalsOverlap(
          event.startsAt,
          event.endsAt,
          rangeStart,
          rangeEnd,
        ),
    );

  const bookingBusy = (bookings || [])
    .map((booking) => ({
      startsAt: toUtcDateTime(booking.starts_at),
      endsAt: toUtcDateTime(booking.ends_at),
    }))
    .filter(
      (booking) =>
        booking.startsAt.isValid &&
        booking.endsAt.isValid,
    );

  const busyIntervals = [...calendarBusy, ...bookingBusy];
  const durationMinutes = Number(profile.default_duration_minutes);
  const minimumStart = DateTime.now()
    .toUTC()
    .plus({
      minutes: Number(profile.minimum_notice_minutes),
    });

  const slots = [];

  for (let dayOffset = 0; dayOffset < dayCount; dayOffset += 1) {
    const day = fromDate.plus({ days: dayOffset });
    const intervals = buildAvailabilityIntervals({
      day,
      rules: rules || [],
      exceptions: exceptions || [],
      timeZone,
    });

    for (const interval of intervals) {
      let cursor = interval.startsAt;

      while (
        cursor.plus({ minutes: durationMinutes }).toMillis() <=
        interval.endsAt.toMillis()
      ) {
        const endsAt = cursor.plus({
          minutes: durationMinutes,
        });

        const isTooSoon =
          cursor.toUTC().toMillis() < minimumStart.toMillis();

        if (
          !isTooSoon &&
          !isBlockedByException({
            startsAt: cursor,
            endsAt,
            exceptions: exceptions || [],
          }) &&
          !isBusy({
            startsAt: cursor,
            endsAt,
            busyIntervals,
          })
        ) {
          slots.push({
            startsAt: cursor.toUTC().toISO(),
            endsAt: endsAt.toUTC().toISO(),
          });
        }

        cursor = cursor.plus({ minutes: durationMinutes });
      }
    }
  }

  return {
    success: true,
    data: {
      profile: serializePublicProfile(profile),
      from: fromDate.toISODate(),
      to: toDate.toISODate(),
      slots,
    },
  };
}

module.exports = {
  getPublicBookingProfileService,
  getPublicBookingSlotsService,
};