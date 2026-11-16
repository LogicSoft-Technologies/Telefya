const { DateTime } = require("luxon");

function toUtcDateTime(value) {
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: "utc" });
  }

  const raw = String(value || "").trim();

  if (!raw) {
    return DateTime.invalid("Missing date");
  }

  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(" ", "T")}Z`
    : raw;

  return DateTime.fromISO(normalized, { zone: "utc" });
}

function toMysqlUtc(value) {
  return value
    .toUTC()
    .toFormat("yyyy-LL-dd HH:mm:ss");
}

function normalizeWeekdays(value, fallbackDay) {
  if (!value) return [fallbackDay];

  let parsed = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [fallbackDay];
  }

  const result = [...new Set(parsed.map(Number))]
    .filter(
      (day) =>
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6,
    )
    .sort((first, second) => first - second);

  return result.length ? result : [fallbackDay];
}

function localDayCode(value) {
  // Luxon: Monday=1 … Sunday=7.
  // Telefya recurrence: Sunday=0 … Saturday=6.
  return value.weekday % 7;
}

function startOfWeek(value) {
  return value.startOf("week");
}

function isSameOrAfter(first, second) {
  return first.toMillis() >= second.toMillis();
}

function isInRange(value, from, to) {
  return (
    value.toMillis() >= from.toMillis() &&
    value.toMillis() < to.toMillis()
  );
}

function parseExceptionMap(exceptions) {
  const map = new Map();

  for (const exception of exceptions) {
    const occurrence = toUtcDateTime(
      exception.occurrence_starts_at,
    );

    if (!occurrence.isValid) {
      continue;
    }

    const key = `${exception.meeting_id}:${toMysqlUtc(occurrence)}`;

    map.set(key, exception);
  }

  return map;
}

function createOccurrence(meeting, startsAt, overrides = {}) {
  const durationMinutes = Math.max(
    15,
    Number(
      overrides.duration_minutes ||
        meeting.duration_minutes ||
        60,
    ),
  );

  const endsAt = startsAt.plus({
    minutes: durationMinutes,
  });

  return {
    ...meeting,
    occurrence_key: `${meeting.id}:${toMysqlUtc(startsAt)}`,
    occurrence_starts_at: toMysqlUtc(startsAt),
    scheduled_for: startsAt.toUTC().toISO(),
    ends_at: endsAt.toUTC().toISO(),
    duration_minutes: durationMinutes,
    title:
      overrides.title ||
      meeting.title ||
      meeting.des ||
      "Telefya meeting",
    is_recurring: true,
  };
}

function shouldIncludeCandidate({
  candidate,
  firstOccurrence,
  rule,
}) {
  if (!isSameOrAfter(candidate, firstOccurrence)) {
    return false;
  }

  const interval = Math.max(
    1,
    Number(rule.interval_count || 1),
  );

  if (rule.frequency === "daily") {
    const difference = Math.floor(
      candidate.startOf("day").diff(
        firstOccurrence.startOf("day"),
        "days",
      ).days,
    );

    return difference >= 0 && difference % interval === 0;
  }

  if (rule.frequency === "weekly") {
    const weekday = localDayCode(candidate);
    const weekdays = normalizeWeekdays(
      rule.weekdays,
      localDayCode(firstOccurrence),
    );

    if (!weekdays.includes(weekday)) {
      return false;
    }

    const weeks = Math.floor(
      startOfWeek(candidate).diff(
        startOfWeek(firstOccurrence),
        "weeks",
      ).weeks,
    );

    return weeks >= 0 && weeks % interval === 0;
  }

  if (rule.frequency === "monthly") {
    const desiredDay = Number(
      rule.month_day || firstOccurrence.day,
    );

    const months =
      (candidate.year - firstOccurrence.year) * 12 +
      candidate.month -
      firstOccurrence.month;

    return (
      months >= 0 &&
      months % interval === 0 &&
      candidate.day === desiredDay
    );
  }

  return false;
}

function expandRecurringMeeting({
  meeting,
  rule,
  exceptions,
  from,
  to,
}) {
  const zone = meeting.time_zone || "UTC";
  const baseUtc = toUtcDateTime(meeting.scheduled_for);

  if (!baseUtc.isValid) {
    return [];
  }

  const firstOccurrence = baseUtc.setZone(zone);

  if (!firstOccurrence.isValid) {
    return [];
  }

  const rangeStart = from.setZone(zone);
  const rangeEnd = to.setZone(zone);
  const recurrenceEndsAt = rule.ends_at
    ? toUtcDateTime(rule.ends_at)
    : null;

  const occurrenceLimit = rule.occurrence_count
    ? Number(rule.occurrence_count)
    : null;

  const exceptionMap = parseExceptionMap(exceptions);
  const generated = [];
  let occurrenceCount = 0;
  let cursor = firstOccurrence.startOf("day");
  let iterations = 0;

  // 15 years of daily checks protects the server from unbounded bad data.
  const maxIterations = 5_500;

  while (
    cursor.toMillis() < rangeEnd.plus({ days: 1 }).toMillis() &&
    iterations < maxIterations
  ) {
    const candidate = cursor.set({
      hour: firstOccurrence.hour,
      minute: firstOccurrence.minute,
      second: firstOccurrence.second,
      millisecond: 0,
    });

    if (
      shouldIncludeCandidate({
        candidate,
        firstOccurrence,
        rule,
      })
    ) {
      if (
        recurrenceEndsAt &&
        candidate.toUTC().toMillis() >
          recurrenceEndsAt.toMillis()
      ) {
        break;
      }

      occurrenceCount += 1;

      if (
        occurrenceLimit &&
        occurrenceCount > occurrenceLimit
      ) {
        break;
      }

      const originalStart = toMysqlUtc(candidate);
      const exceptionKey = `${meeting.id}:${originalStart}`;
      const exception = exceptionMap.get(exceptionKey);

      if (!exception && isInRange(candidate, rangeStart, rangeEnd)) {
        generated.push(
          createOccurrence(meeting, candidate),
        );
      }
    }

    cursor = cursor.plus({ days: 1 });
    iterations += 1;
  }

  return generated;
}

function expandCalendarEvents({
  meetings,
  rules,
  exceptions,
  from,
  to,
}) {
  const fromDate = toUtcDateTime(from);
  const toDate = toUtcDateTime(to);

  if (!fromDate.isValid || !toDate.isValid) {
    throw new Error("Calendar range is invalid.");
  }

  const rulesByMeeting = new Map(
    rules.map((rule) => [Number(rule.meeting_id), rule]),
  );

  const exceptionsByMeeting = new Map();

  for (const exception of exceptions) {
    const meetingId = Number(exception.meeting_id);
    const current = exceptionsByMeeting.get(meetingId) || [];

    current.push(exception);
    exceptionsByMeeting.set(meetingId, current);
  }

  const output = [];

  for (const meeting of meetings) {
    const rule = rulesByMeeting.get(Number(meeting.id));

    if (!rule) {
      const startsAt = toUtcDateTime(meeting.scheduled_for);

      if (!startsAt.isValid) continue;

      const endsAt = startsAt.plus({
        minutes: Math.max(
          15,
          Number(meeting.duration_minutes || 60),
        ),
      });

      output.push({
        ...meeting,
        occurrence_key: `${meeting.id}:${toMysqlUtc(startsAt)}`,
        occurrence_starts_at: toMysqlUtc(startsAt),
        scheduled_for: startsAt.toUTC().toISO(),
        ends_at: endsAt.toUTC().toISO(),
        title:
          meeting.title ||
          meeting.des ||
          "Telefya meeting",
        is_recurring: false,
      });

      continue;
    }

    output.push(
      ...expandRecurringMeeting({
        meeting,
        rule,
        exceptions: exceptionsByMeeting.get(Number(meeting.id)) || [],
        from: fromDate,
        to: toDate,
      }),
    );
  }

  // Add rescheduled exceptions that now fall inside this calendar range.
  for (const exception of exceptions) {
    if (
      exception.exception_type !== "rescheduled" ||
      !exception.rescheduled_for
    ) {
      continue;
    }

    const meeting = meetings.find(
      (item) =>
        Number(item.id) === Number(exception.meeting_id),
    );

    if (!meeting) continue;

    const rescheduledAt = toUtcDateTime(
      exception.rescheduled_for,
    );

    if (
      !rescheduledAt.isValid ||
      !isInRange(rescheduledAt, fromDate, toDate)
    ) {
      continue;
    }

    output.push(
      createOccurrence(meeting, rescheduledAt, exception),
    );
  }

  return output.sort(
    (first, second) =>
      new Date(first.scheduled_for).getTime() -
      new Date(second.scheduled_for).getTime(),
  );
}

module.exports = {
  expandCalendarEvents,
  expandRecurringMeeting,
};