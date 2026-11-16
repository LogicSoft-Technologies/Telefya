"use client";

import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  UserPlus,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  getMeetingAuditHistory,
  type MeetingAuditEvent,
} from "@/lib/api/calendar";

const EVENT_DETAILS: Record<
  string,
  {
    label: string;
    icon: typeof History;
    tone: string;
  }
> = {
  MEETING_SCHEDULED: {
    label: "Meeting scheduled",
    icon: CalendarClock,
    tone: "bg-blue-50 text-telefya-blue",
  },
  MEETING_RESCHEDULED: {
    label: "Meeting updated",
    icon: RotateCcw,
    tone: "bg-violet-50 text-telefya-violet",
  },
  MEETING_CANCELLED: {
    label: "Meeting cancelled",
    icon: XCircle,
    tone: "bg-red-50 text-red-600",
  },
  MEETING_INVITATION_SENT: {
    label: "Invitation sent",
    icon: UserPlus,
    tone: "bg-emerald-50 text-emerald-600",
  },
  PUBLIC_BOOKING_CREATED: {
    label: "Booked through your link",
    icon: CheckCircle2,
    tone: "bg-emerald-50 text-emerald-600",
  },
  RECURRENCE_SAVED: {
    label: "Recurring schedule saved",
    icon: RotateCcw,
    tone: "bg-violet-50 text-telefya-violet",
  },
  RECURRENCE_REMOVED: {
    label: "Recurring schedule removed",
    icon: RotateCcw,
    tone: "bg-navy-50 text-navy-500",
  },
  RECURRENCE_OCCURRENCE_CHANGED: {
    label: "One occurrence changed",
    icon: CalendarClock,
    tone: "bg-amber-50 text-amber-700",
  },
  RECURRENCE_OCCURRENCE_RESTORED: {
    label: "One occurrence restored",
    icon: RotateCcw,
    tone: "bg-emerald-50 text-emerald-600",
  },
};

function getEventDetails(eventType: string) {
  return (
    EVENT_DETAILS[eventType] || {
      label: eventType
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/^\w/, (value) => value.toUpperCase()),
      icon: History,
      tone: "bg-navy-50 text-navy-500",
    }
  );
}

function eventSummary(event: MeetingAuditEvent) {
  const metadata = event.metadata || {};

  const scheduledFor =
    typeof metadata.scheduledFor === "string"
      ? metadata.scheduledFor
      : typeof metadata.startsAt === "string"
        ? metadata.startsAt
        : null;

  if (event.event_type === "MEETING_CANCELLED") {
    return typeof metadata.reason === "string" && metadata.reason
      ? metadata.reason
      : "No cancellation reason provided.";
  }

  if (scheduledFor) {
    return new Date(scheduledFor).toLocaleString();
  }

  if (
    event.event_type === "MEETING_INVITATION_SENT" &&
    typeof metadata.memberRole === "string"
  ) {
    return `Role: ${metadata.memberRole}`;
  }

  if (
    event.event_type === "RECURRENCE_SAVED" &&
    typeof metadata.frequency === "string"
  ) {
    const interval =
      typeof metadata.intervalCount === "number"
        ? metadata.intervalCount
        : 1;

    return `Repeats every ${interval} ${metadata.frequency}${interval === 1 ? "" : "s"}.`;
  }

  return "";
}

export function MeetingAuditHistory({
  meetingId,
}: {
  meetingId: number;
}) {
  const [items, setItems] = useState<MeetingAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getMeetingAuditHistory(meetingId);
      setItems(response.data || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load meeting history.",
      );
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <section className="border-t border-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History size={17} className="text-telefya-violet" />
          <h3 className="text-sm font-black text-navy-900">
            Activity history
          </h3>
        </div>

        <button
          type="button"
          onClick={() => void loadHistory()}
          aria-label="Refresh meeting history"
          className="grid h-8 w-8 place-items-center rounded-lg text-navy-400 transition hover:bg-navy-50 hover:text-telefya-blue"
        >
          <RefreshCw
            size={15}
            className={loading ? "animate-spin" : ""}
          />
        </button>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm font-bold text-navy-400">
          <Loader2 size={15} className="animate-spin" />
          Loading history…
        </div>
      ) : error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">
          {error}
        </p>
      ) : items.length ? (
        <ol className="mt-4 grid gap-3">
          {items.map((item) => {
            const details = getEventDetails(item.event_type);
            const Icon = details.icon;
            const summary = eventSummary(item);

            return (
              <li
                key={item.id}
                className="flex gap-3 rounded-xl border border-border bg-navy-50/50 p-3"
              >
                <span
                  className={[
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                    details.tone,
                  ].join(" ")}
                >
                  <Icon size={16} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-navy-800">
                    {details.label}
                  </p>

                  {summary ? (
                    <p className="mt-1 text-xs font-semibold leading-5 text-navy-500">
                      {summary}
                    </p>
                  ) : null}

                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold text-navy-400">
                    <Clock3 size={12} />
                    {new Date(item.occurred_at).toLocaleString()}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-border px-3 py-4 text-xs font-semibold leading-5 text-navy-400">
          Activity will appear here when this meeting is scheduled,
          updated, booked, or shared.
        </p>
      )}
    </section>
  );
}