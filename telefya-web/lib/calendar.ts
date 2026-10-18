function formatGoogleCalendarDate(value: string | Date) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Meeting has an invalid scheduled time.");
  }

  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function createGoogleCalendarUrl({
  title,
  startsAt,
  meetingUrl,
  durationMinutes = 60,
}: {
  title: string;
  startsAt: string | Date;
  meetingUrl: string;
  durationMinutes?: number;
}) {
  const start = new Date(startsAt);

  if (Number.isNaN(start.getTime())) {
    throw new Error("Meeting has an invalid scheduled time.");
  }

  const end = new Date(
    start.getTime() + Math.max(15, durationMinutes) * 60 * 1000,
  );

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Telefya meeting",
    dates: `${formatGoogleCalendarDate(start)}/${formatGoogleCalendarDate(end)}`,
    details: `Join Telefya meeting: ${meetingUrl}`,
    location: meetingUrl,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}