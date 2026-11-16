import { apiRequest } from "@/lib/api/client";

export type CalendarEventStatus =
  | "upcoming"
  | "live"
  | "ended"
  | "cancelled";

export type CalendarViewerRole =
  | "host"
  | "speaker"
  | "attendee"
  | "guest";

export type CalendarEvent = {
  id: number;
  room_id: string;
  meeting_url: string;
  title: string;
  des?: string | null;
  scheduled_for: string;
  ends_at: string;
  duration_minutes: number;
  time_zone: string;
  status: CalendarEventStatus;
  started_at?: string | null;
  occurrence_key?: string;
  occurrence_starts_at?: string;
  is_recurring?: boolean;
  ended_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  calendar_sequence: number;
  host_user_id: string;
  host_name?: string | null;
  viewer_role: CalendarViewerRole;
  invitation_status?: "invited" | "accepted" | null;
};

type CalendarEventsResponse = {
  success: boolean;
  message: string;
  data: CalendarEvent[];
};

export async function getCalendarEvents({
  from,
  to,
  includeCancelled = false,
}: {
  from: string;
  to: string;
  includeCancelled?: boolean;
}) {
  const query = new URLSearchParams({
    from,
    to,
    includeCancelled: String(includeCancelled),
  });

  const response = await apiRequest<CalendarEventsResponse>(
    `/user/calendar/events?${query.toString()}`,
    { method: "GET" },
  );

  return Array.isArray(response.data) ? response.data : [];
}

export async function updateCalendarEvent(
  meetingId: number,
  payload: {
    title?: string;
    scheduledFor?: string;
    durationMinutes?: number;
    timeZone?: string;
  },
) {
  return apiRequest<{
    success: boolean;
    message: string;
    data: CalendarEvent;
  }>(`/user/calendar/events/${meetingId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function cancelCalendarEvent(
  meetingId: number,
  reason?: string,
) {
  return apiRequest<{
    success: boolean;
    message: string;
    data: Pick<
      CalendarEvent,
      "id" | "status" | "cancelled_at" | "calendar_sequence"
    >;
  }>(`/user/calendar/events/${meetingId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export type RecurrenceFrequency =
  | "daily"
  | "weekly"
  | "monthly";

export type MeetingRecurrence = {
  id: number;
  meeting_id: number;
  frequency: RecurrenceFrequency;
  interval_count: number;
  weekdays: number[] | null;
  month_day: number | null;
  ends_at: string | null;
  occurrence_count: number | null;
};

export type SaveMeetingRecurrencePayload = {
  frequency: RecurrenceFrequency;
  intervalCount?: number;
  weekdays?: number[];
  monthDay?: number;
  endsAt?: string;
  occurrenceCount?: number;
};

export async function getMeetingRecurrence(
  meetingId: number,
) {
  return apiRequest<{
    success: boolean;
    message: string;
    data: MeetingRecurrence | null;
  }>(`/user/calendar/events/${meetingId}/recurrence`, {
    method: "GET",
  });
}

export async function saveMeetingRecurrence(
  meetingId: number,
  payload: SaveMeetingRecurrencePayload,
) {
  return apiRequest<{
    success: boolean;
    message: string;
    data: MeetingRecurrence;
  }>(`/user/calendar/events/${meetingId}/recurrence`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteMeetingRecurrence(
  meetingId: number,
) {
  return apiRequest<{
    success: boolean;
    message: string;
  }>(`/user/calendar/events/${meetingId}/recurrence`, {
    method: "DELETE",
  });
}

export type RecurrenceExceptionPayload = {
  occurrenceStartsAt: string;
  exceptionType: "cancelled" | "rescheduled";
  rescheduledFor?: string;
  durationMinutes?: number;
  title?: string;
};

export async function saveRecurrenceException(
  meetingId: number,
  payload: RecurrenceExceptionPayload,
) {
  return apiRequest<{
    success: boolean;
    message: string;
  }>(
    `/user/calendar/events/${meetingId}/recurrence/exceptions`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteRecurrenceException(
  meetingId: number,
  occurrenceStartsAt: string,
) {
  return apiRequest<{
    success: boolean;
    message: string;
  }>(
    `/user/calendar/events/${meetingId}/recurrence/exceptions`,
    {
      method: "DELETE",
      body: JSON.stringify({ occurrenceStartsAt }),
    },
  );
}

export type MeetingAuditEvent = {
  id: number;
  meeting_id: number | null;
  booking_id: number | null;
  actor_user_id: string | null;
  actor_type: "host" | "member" | "guest" | "system";
  event_type: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export async function getMeetingAuditHistory(
  meetingId: number,
  limit = 100,
) {
  const query = new URLSearchParams({
    limit: String(limit),
  });

  return apiRequest<{
    success: boolean;
    data: MeetingAuditEvent[];
  }>(
    `/user/calendar/events/${meetingId}/audit?${query.toString()}`,
    { method: "GET" },
  );
}