"use client";

import {
  CalendarClock,
  Loader2,
  Repeat2,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  deleteMeetingRecurrence,
  getMeetingRecurrence,
  saveMeetingRecurrence,
  type RecurrenceFrequency,
} from "@/lib/api/calendar";

type EndMode = "never" | "date" | "count";

type Props = {
  meetingId: number;
  scheduledFor: string;
  disabled?: boolean;
  onSaved?: () => Promise<void> | void;
};

const DAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 0, label: "S" },
];

function toDateInput(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function RecurrenceSettings({
  meetingId,
  scheduledFor,
  disabled = false,
  onSaved,
}: Props) {
  const meetingDate = useMemo(
    () => new Date(scheduledFor),
    [scheduledFor],
  );

  const defaultWeekday = meetingDate.getDay();
  const defaultMonthDay = meetingDate.getDate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] =
    useState<RecurrenceFrequency>("weekly");
  const [intervalCount, setIntervalCount] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>([
    defaultWeekday,
  ]);
  const [monthDay, setMonthDay] = useState(defaultMonthDay);
  const [endMode, setEndMode] = useState<EndMode>("never");
  const [endsAt, setEndsAt] = useState("");
  const [occurrenceCount, setOccurrenceCount] = useState(10);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setNotice("");

      try {
        const response = await getMeetingRecurrence(meetingId);

        if (!active) return;

        const recurrence = response.data;

        if (!recurrence) {
          setEnabled(false);
          return;
        }

        setEnabled(true);
        setFrequency(recurrence.frequency);
        setIntervalCount(recurrence.interval_count || 1);
        setWeekdays(
          recurrence.weekdays?.length
            ? recurrence.weekdays
            : [defaultWeekday],
        );
        setMonthDay(recurrence.month_day || defaultMonthDay);

        if (recurrence.ends_at) {
          setEndMode("date");
          setEndsAt(toDateInput(recurrence.ends_at));
        } else if (recurrence.occurrence_count) {
          setEndMode("count");
          setOccurrenceCount(recurrence.occurrence_count);
        } else {
          setEndMode("never");
        }
      } catch (error) {
        if (active) {
          setNotice(
            error instanceof Error
              ? error.message
              : "Unable to load recurrence settings.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [defaultMonthDay, defaultWeekday, meetingId]);

  function toggleWeekday(day: number) {
    setWeekdays((current) => {
      if (current.includes(day)) {
        const next = current.filter((value) => value !== day);
        return next.length ? next : current;
      }

      return [...current, day].sort(
        (first, second) => first - second,
      );
    });
  }

  async function handleSave() {
    setSaving(true);
    setNotice("");

    try {
      await saveMeetingRecurrence(meetingId, {
        frequency,
        intervalCount,
        weekdays:
          frequency === "weekly" ? weekdays : undefined,
        monthDay:
          frequency === "monthly" ? monthDay : undefined,
        endsAt:
          endMode === "date" && endsAt
            ? new Date(`${endsAt}T23:59:59`).toISOString()
            : undefined,
        occurrenceCount:
          endMode === "count"
            ? occurrenceCount
            : undefined,
      });

      setNotice("Recurrence saved.");
      await onSaved?.();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to save recurrence settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setNotice("");

    try {
      await deleteMeetingRecurrence(meetingId);
      setEnabled(false);
      setEndMode("never");
      setNotice("Recurrence removed.");
      await onSaved?.();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to remove recurrence settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-navy-50 px-3 py-3 text-xs font-bold text-navy-500">
        <Loader2 size={14} className="animate-spin text-telefya-blue" />
        Loading recurrence settings…
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-navy-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-telefya-violet shadow-soft">
            <Repeat2 size={18} />
          </span>

          <div>
            <h3 className="text-sm font-black text-navy-900">
              Recurring meeting
            </h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-navy-500">
              Repeat this meeting without creating duplicate rooms.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={disabled || saving}
          onClick={() => setEnabled((value) => !value)}
          className={[
            "rounded-full px-3 py-1.5 text-xs font-black transition disabled:opacity-60",
            enabled
              ? "bg-telefya-blue text-white"
              : "bg-white text-navy-500 ring-1 ring-border",
          ].join(" ")}
        >
          {enabled ? "On" : "Off"}
        </button>
      </div>

      {notice ? (
        <p
          className={[
            "mt-4 rounded-lg px-3 py-2 text-xs font-bold",
            notice === "Recurrence saved." ||
            notice === "Recurrence removed."
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700",
          ].join(" ")}
        >
          {notice}
        </p>
      ) : null}

      {enabled ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-black text-navy-700">
                Repeats
              </span>
              <select
                value={frequency}
                disabled={disabled || saving}
                onChange={(event) =>
                  setFrequency(
                    event.target.value as RecurrenceFrequency,
                  )
                }
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black text-navy-700">
                Every
              </span>
              <div className="flex h-10 overflow-hidden rounded-xl border border-border bg-white">
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={intervalCount}
                  disabled={disabled || saving}
                  onChange={(event) =>
                    setIntervalCount(
                      Math.max(1, Number(event.target.value)),
                    )
                  }
                  className="w-16 border-r border-border px-3 text-sm font-bold text-navy-900 outline-none"
                />
                <span className="flex flex-1 items-center px-3 text-xs font-bold text-navy-500">
                  {frequency === "daily"
                    ? "day(s)"
                    : frequency === "weekly"
                      ? "week(s)"
                      : "month(s)"}
                </span>
              </div>
            </label>
          </div>

          {frequency === "weekly" ? (
            <div>
              <p className="text-xs font-black text-navy-700">
                Repeat on
              </p>
              <div className="mt-2 flex gap-1.5">
                {DAYS.map((day, index) => {
                  const selected = weekdays.includes(day.value);

                  return (
                    <button
                      key={`${day.value}-${index}`}
                      type="button"
                      disabled={disabled || saving}
                      onClick={() => toggleWeekday(day.value)}
                      className={[
                        "grid h-9 w-9 place-items-center rounded-full text-xs font-black transition disabled:opacity-60",
                        selected
                          ? "bg-telefya-blue text-white"
                          : "bg-white text-navy-500 ring-1 ring-border hover:border-telefya-blue",
                      ].join(" ")}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {frequency === "monthly" ? (
            <label className="grid gap-2">
              <span className="text-xs font-black text-navy-700">
                Day of month
              </span>
              <select
                value={monthDay}
                disabled={disabled || saving}
                onChange={(event) =>
                  setMonthDay(Number(event.target.value))
                }
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
              >
                {Array.from({ length: 31 }, (_, index) => index + 1).map(
                  (day) => (
                    <option key={day} value={day}>
                      Day {day}
                    </option>
                  ),
                )}
              </select>
            </label>
          ) : null}

          <div>
            <p className="text-xs font-black text-navy-700">
              Ends
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["never", "Never"],
                  ["date", "On date"],
                  ["count", "After count"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={disabled || saving}
                  onClick={() => setEndMode(value)}
                  className={[
                    "h-10 rounded-xl border text-xs font-black transition disabled:opacity-60",
                    endMode === value
                      ? "border-telefya-blue bg-blue-50 text-telefya-blue"
                      : "border-border bg-white text-navy-500",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>

            {endMode === "date" ? (
              <label className="mt-3 grid gap-2">
                <span className="text-xs font-black text-navy-700">
                  Repeat until
                </span>
                <input
                  type="date"
                  min={toDateInput(scheduledFor)}
                  value={endsAt}
                  disabled={disabled || saving}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
                />
              </label>
            ) : null}

            {endMode === "count" ? (
              <label className="mt-3 grid gap-2">
                <span className="text-xs font-black text-navy-700">
                  Number of occurrences
                </span>
                <input
                  type="number"
                  min="2"
                  max="365"
                  value={occurrenceCount}
                  disabled={disabled || saving}
                  onChange={(event) =>
                    setOccurrenceCount(
                      Math.max(2, Number(event.target.value)),
                    )
                  }
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
                />
              </label>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => void handleSave()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-telefya-blue text-xs font-black text-white transition hover:bg-telefya-violet disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CalendarClock size={15} />
              )}
              Save recurrence
            </button>

            <button
              type="button"
              disabled={disabled || saving}
              onClick={() => void handleRemove()}
              className="grid h-10 w-10 place-items-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              aria-label="Remove recurrence"
              title="Remove recurrence"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}