"use client";

import {
  CalendarClock,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import {
  saveRecurrenceException,
  type CalendarEvent,
} from "@/lib/api/calendar";

type Props = {
  event: CalendarEvent;
  disabled?: boolean;
  onSaved: () => Promise<void> | void;
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

export function RecurrenceOccurrenceActions({
  event,
  disabled = false,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<"none" | "cancel" | "reschedule">(
    "none",
  );
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [newDateTime, setNewDateTime] = useState(
    toDateTimeLocal(event.scheduled_for),
  );
  const [durationMinutes, setDurationMinutes] = useState(
    event.duration_minutes || 60,
  );

  if (
    !event.is_recurring ||
    event.viewer_role !== "host" ||
    event.status !== "upcoming"
  ) {
    return null;
  }

  const occurrenceStartsAt =
    event.occurrence_starts_at || event.scheduled_for;

  async function cancelThisOccurrence() {
    setSaving(true);
    setNotice("");

    try {
      await saveRecurrenceException(event.id, {
        occurrenceStartsAt,
        exceptionType: "cancelled",
      });

      setNotice("This occurrence was cancelled.");
      setMode("none");
      await onSaved();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to cancel this occurrence.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function rescheduleThisOccurrence() {
    setSaving(true);
    setNotice("");

    try {
      await saveRecurrenceException(event.id, {
        occurrenceStartsAt,
        exceptionType: "rescheduled",
        rescheduledFor: new Date(newDateTime).toISOString(),
        durationMinutes,
        title: event.title,
      });

      setNotice("This occurrence was rescheduled.");
      setMode("none");
      await onSaved();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to reschedule this occurrence.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-telefya-violet shadow-soft">
          <RotateCcw size={18} />
        </span>

        <div>
          <h3 className="text-sm font-black text-navy-900">
            This occurrence
          </h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-navy-500">
            Change only this date. The rest of the recurring series stays the
            same.
          </p>
        </div>
      </div>

      {notice ? (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
          {notice}
        </p>
      ) : null}

      {mode === "none" ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => setMode("reschedule")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white text-xs font-black text-telefya-violet transition hover:bg-violet-100 disabled:opacity-60"
          >
            <CalendarClock size={15} />
            Reschedule this one
          </button>

          <button
            type="button"
            disabled={disabled || saving}
            onClick={() => setMode("cancel")}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-60"
          >
            <XCircle size={15} />
            Cancel this one
          </button>
        </div>
      ) : null}

      {mode === "cancel" ? (
        <div className="mt-4">
          <p className="text-xs font-bold leading-5 text-red-700">
            Cancel only this occurrence? Other dates in the series will remain
            scheduled.
          </p>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setMode("none")}
              className="h-10 flex-1 rounded-xl border border-border bg-white text-xs font-black text-navy-600"
            >
              Keep it
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void cancelThisOccurrence()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 text-xs font-black text-white disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : null}
              Cancel occurrence
            </button>
          </div>
        </div>
      ) : null}

      {mode === "reschedule" ? (
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-black text-navy-700">
              New date and time
            </span>
            <input
              type="datetime-local"
              value={newDateTime}
              disabled={saving}
              onChange={(input) => setNewDateTime(input.target.value)}
              className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-black text-navy-700">
              Duration
            </span>
            <select
              value={durationMinutes}
              disabled={saving}
              onChange={(input) =>
                setDurationMinutes(Number(input.target.value))
              }
              className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1 hour 30 minutes</option>
              <option value={120}>2 hours</option>
            </select>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setMode("none")}
              className="h-10 flex-1 rounded-xl border border-border bg-white text-xs font-black text-navy-600"
            >
              Back
            </button>

            <button
              type="button"
              disabled={saving || !newDateTime}
              onClick={() => void rescheduleThisOccurrence()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-telefya-blue text-xs font-black text-white disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CalendarClock size={15} />
              )}
              Save this date
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}