"use client";

import {
  CalendarClock,
  Clock3,
  Loader2,
  Save,
  ShieldAlert,
  Users,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  cancelCalendarEvent,
  updateCalendarEvent,
  type CalendarEvent,
} from "@/lib/api/calendar";
import { RecurrenceOccurrenceActions } from "./recurrence-occurrence-actions";
import { RecurrenceSettings } from "./recurrence-settings";
import { MeetingAuditHistory } from "./meeting-audit-history";

type Props = {
  event: CalendarEvent | null;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

function toDateTimeLocal(value: string) {
  const date = new Date(value);

  const pad = (number: number) => String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export function CalendarEventDrawer({
  event,
  onClose,
  onChanged,
}: Props) {
  const [title, setTitle] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [timeZone, setTimeZone] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");

  const isHost = event?.viewer_role === "host";
  const canManage = isHost && event?.status === "upcoming";

  useEffect(() => {
    if (!event) return;

    setTitle(event.title || "Telefya meeting");
    setScheduledFor(toDateTimeLocal(event.scheduled_for));
    setDurationMinutes(event.duration_minutes || 60);
    setTimeZone(event.time_zone || "UTC");
    setNotice("");
    setConfirmingCancel(false);
    setCancellationReason("");
  }, [event]);

  if (!event) return null;

  async function refreshAndClose() {
    await onChanged();
    onClose();
  }

  async function handleSave(eventSubmit: React.FormEvent) {
    eventSubmit.preventDefault();
    const meeting = event;

    if (!meeting) {
      return;
    }

    setNotice("");
    setSaving(true);

    try {
      await updateCalendarEvent(meeting.id, {
        title,
        scheduledFor: new Date(scheduledFor).toISOString(),
        durationMinutes,
        timeZone,
      });

      await refreshAndClose();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to update the meeting.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    const meeting = event;

    if (!meeting) {
      return;
    }

    setNotice("");
    setSaving(true);

    try {
      await cancelCalendarEvent(
        meeting.id,
        cancellationReason,
      );
      await refreshAndClose();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to cancel the meeting.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        aria-label="Close meeting details"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-navy-900/45 backdrop-blur-[2px]"
      />

      <aside className="absolute bottom-0 right-0 flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:bottom-5 sm:right-5 sm:max-h-[calc(100dvh-40px)] sm:rounded-3xl">
        <div className="telefya-accent-line h-1 shrink-0" />

        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-telefya-blue">
              <CalendarClock size={13} />
              Meeting details
            </span>

            <h2 className="mt-3 truncate text-xl font-black text-navy-900">
              {event.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-500 transition hover:bg-navy-100 hover:text-navy-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {notice ? (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
            >
              {notice}
            </div>
          ) : null}

          {!canManage ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-navy-50/70 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-telefya-blue shadow-soft">
                    <Clock3 size={18} />
                  </span>

                  <div>
                    <p className="text-sm font-black text-navy-900">
                      {new Date(event.scheduled_for).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-navy-500">
                      {event.duration_minutes} minutes · {event.time_zone}
                    </p>
                  </div>
                </div>

                {event.host_name ? (
                  <div className="mt-4 flex items-center gap-2 text-sm font-bold text-navy-500">
                    <Users size={15} className="text-telefya-violet" />
                    Hosted by {event.host_name}
                  </div>
                ) : null}
              </div>

              {event.status !== "cancelled" ? (
                <a
                  href={event.meeting_url}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-telefya-blue px-5 text-sm font-black text-white shadow-soft transition hover:bg-telefya-violet"
                >
                  <Video size={17} />
                  Join meeting
                </a>
              ) : (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  This meeting was cancelled.
                </div>
              )}
            </div>
          ) : confirmingCancel ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert
                    size={20}
                    className="mt-0.5 shrink-0 text-red-600"
                  />
                  <div>
                    <h3 className="font-black text-red-900">
                      Cancel this meeting?
                    </h3>
                    <p className="mt-1 text-sm font-semibold leading-6 text-red-700">
                      Invitees will receive a calendar cancellation notice.
                    </p>
                  </div>
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-black text-navy-900">
                  Reason for cancellation
                </span>
                <textarea
                  value={cancellationReason}
                  onChange={(input) =>
                    setCancellationReason(input.target.value)
                  }
                  maxLength={500}
                  placeholder="Optional note for your invited participants"
                  className="min-h-28 rounded-xl border border-border bg-white p-3 text-sm font-semibold text-navy-900 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </label>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmingCancel(false)}
                  disabled={saving}
                  className="h-11 flex-1 rounded-xl border border-border bg-white text-sm font-black text-navy-700"
                >
                  Keep meeting
                </button>

                <button
                  onClick={() => void handleCancel()}
                  disabled={saving}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-black text-white disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  Cancel meeting
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-black text-navy-900">
                  Meeting title
                </span>
                <input
                  value={title}
                  onChange={(input) => setTitle(input.target.value)}
                  maxLength={220}
                  required
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy-900 outline-none transition focus:border-telefya-blue focus:ring-2 focus:ring-telefya-blue/15"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-black text-navy-900">
                    Date and time
                  </span>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(input) =>
                      setScheduledFor(input.target.value)
                    }
                    required
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy-900 outline-none transition focus:border-telefya-blue focus:ring-2 focus:ring-telefya-blue/15"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black text-navy-900">
                    Duration
                  </span>
                  <select
                    value={durationMinutes}
                    onChange={(input) =>
                      setDurationMinutes(Number(input.target.value))
                    }
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy-900 outline-none transition focus:border-telefya-blue focus:ring-2 focus:ring-telefya-blue/15"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1 hour 30 minutes</option>
                    <option value={120}>2 hours</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm font-black text-navy-900">
                  Time zone
                </span>
                <input
                  value={timeZone}
                  onChange={(input) => setTimeZone(input.target.value)}
                  required
                  className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-navy-900 outline-none transition focus:border-telefya-blue focus:ring-2 focus:ring-telefya-blue/15"
                />
              </label>

              <RecurrenceOccurrenceActions
                event={event}
                disabled={saving}
                onSaved={onChanged}
              />

              <RecurrenceSettings
                meetingId={event.id}
                scheduledFor={event.scheduled_for}
                disabled={saving}
                onSaved={onChanged}
              />

              <MeetingAuditHistory meetingId={event.id} />

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-telefya-blue text-sm font-black text-white shadow-soft transition hover:bg-telefya-violet disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Save size={17} />
                )}
                Save changes
              </button>

              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                disabled={saving}
                className="h-11 rounded-xl border border-red-200 bg-white text-sm font-black text-red-600 transition hover:bg-red-50"
              >
                Cancel meeting
              </button>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}