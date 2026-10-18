import {
  CalendarDays,
  CalendarPlus,
  Copy,
  ExternalLink,
  Trash2,
} from "lucide-react";

import { createGoogleCalendarUrl } from "@/lib/calendar";
import type { ScheduledMeeting } from "@/types/meeting";

type EventCardMeeting = ScheduledMeeting & {
  des?: string;
  scheduled_for?: string;
};

function getRoomId(meetingUrl: string) {
  try {
    const url = new URL(meetingUrl);
    return url.searchParams.get("roomId") ?? meetingUrl;
  } catch {
    return meetingUrl;
  }
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function EventCard({
  meeting,
  selected,
  onSelect,
  onDelete,
}: {
  meeting: EventCardMeeting;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onDelete: () => void;
}) {
  const roomId = getRoomId(meeting.meeting_url);
  const scheduledAt = meeting.scheduled_for ?? meeting.created_at;

  async function copyLink() {
    await navigator.clipboard.writeText(meeting.meeting_url);
  }

  function addToGoogleCalendar() {
    try {
      const calendarUrl = createGoogleCalendarUrl({
        title: meeting.des || "Telefya meeting",
        startsAt: scheduledAt,
        meetingUrl: meeting.meeting_url,
      });

      window.open(calendarUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.alert(
        "This meeting does not have a valid scheduled time.",
      );
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(event.target.checked)}
            className="h-4 w-4 accent-telefya-blue"
          />

          <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-telefya-blue">
            <CalendarDays size={22} />
          </span>
        </label>

        <button
          onClick={onDelete}
          className="grid h-10 w-10 place-items-center rounded-xl text-navy-300 transition hover:bg-red-50 hover:text-red-600"
          title="Cancel meeting"
          aria-label="Cancel meeting"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <h3 className="mt-5 text-lg font-black text-navy-900">
        {meeting.des || "Scheduled meeting"}
      </h3>

      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-navy-500">
        {roomId}
      </p>

      <div className="mt-5 grid gap-2 text-sm text-navy-500">
        <p>
          <span className="font-black text-navy-900">When:</span>{" "}
          {scheduledAt ? formatDate(scheduledAt) : "Time to be confirmed"}
        </p>

        <p>
          <span className="font-black text-navy-900">Timezone:</span>{" "}
          {meeting.time_zone}
        </p>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <button
          onClick={copyLink}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-black text-navy-900 transition hover:border-telefya-blue hover:text-telefya-blue"
        >
          <Copy size={16} />
          Copy
        </button>

        <button
          onClick={addToGoogleCalendar}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-sm font-black text-navy-900 transition hover:border-telefya-blue hover:text-telefya-blue"
        >
          <CalendarPlus size={16} />
          Calendar
        </button>

        <a
          href={meeting.meeting_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-telefya-blue px-3 py-3 text-sm font-black text-white transition hover:bg-telefya-violet"
        >
          <ExternalLink size={16} />
          Join
        </a>
      </div>
    </article>
  );
}