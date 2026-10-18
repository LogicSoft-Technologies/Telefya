const CRLF = "\r\n";

const DEFAULT_DURATION_MINUTES = Math.max(
  15,
  Number(process.env.MEETING_DEFAULT_DURATION_MINUTES || 60),
);

function parseUtcDate(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  const raw = String(value || "").trim();

  // Telefya stores MySQL scheduled_for as UTC.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(" ", "T")}Z`
    : raw;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Meeting has an invalid scheduled time.");
  }

  return date;
}

function formatIcsDate(value) {
  return parseUtcDate(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeIcsText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line) {
  const lines = [];
  let remaining = String(line);

  while (Buffer.byteLength(remaining, "utf8") > 75) {
    let position = Math.min(remaining.length, 75);

    while (
      position > 0 &&
      Buffer.byteLength(remaining.slice(0, position), "utf8") > 75
    ) {
      position -= 1;
    }

    lines.push(remaining.slice(0, position));
    remaining = ` ${remaining.slice(position)}`;
  }

  lines.push(remaining);
  return lines.join(CRLF);
}

function createMeetingCalendarInvite({
  meeting,
  hostName,
  attendeeEmail,
  method = "REQUEST",
  sequence = 0,
}) {
  if (
    !meeting?.id ||
    !meeting?.meeting_url ||
    !meeting?.scheduled_for
  ) {
    throw new Error(
      "Meeting ID, link, and scheduled time are required for a calendar invite.",
    );
  }

  const startsAt = parseUtcDate(meeting.scheduled_for);
  const endsAt = new Date(
    startsAt.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000,
  );

  const title = meeting.des || "Telefya meeting";
  const organizerEmail =
    process.env.SMTP_FROM_EMAIL ||
    process.env.SMTP_USER ||
    "no-reply@telefya.com";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Telefya//Meeting Calendar//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:telefya-meeting-${meeting.id}@telefya.com`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startsAt)}`,
    `DTEND:${formatIcsDate(endsAt)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(
      `${title}\n\nJoin meeting: ${meeting.meeting_url}`,
    )}`,
    `LOCATION:${escapeIcsText(meeting.meeting_url)}`,
    `URL:${escapeIcsText(meeting.meeting_url)}`,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `SEQUENCE:${Number(sequence) || 0}`,
    `ORGANIZER;CN=${escapeIcsText(
      hostName || "Telefya host",
    )}:mailto:${escapeIcsText(organizerEmail)}`,
  ];

  if (attendeeEmail) {
    lines.push(
      `ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${escapeIcsText(
        attendeeEmail,
      )}`,
    );
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return `${lines.map(foldIcsLine).join(CRLF)}${CRLF}`;
}

module.exports = {
  createMeetingCalendarInvite,
};