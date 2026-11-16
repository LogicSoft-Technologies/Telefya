"use client";

import {
  CalendarOff,
  Check,
  Clock3,
  Copy,
  Link2,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  createAvailabilityException,
  deleteAvailabilityException,
  getAvailabilityExceptions,
  getAvailabilitySettings,
  saveAvailabilityRules,
  saveBookingProfile,
  type AvailabilityException,
  type AvailabilityRule,
} from "@/lib/api/availability";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type DraftRule = {
  key: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

function defaultRules(): DraftRule[] {
  return [1, 2, 3, 4, 5].map((weekday) => ({
    key: `default-${weekday}`,
    weekday,
    startTime: "09:00",
    endTime: "17:00",
  }));
}

function toDraftRule(rule: AvailabilityRule): DraftRule {
  return {
    key: String(rule.id),
    weekday: rule.weekday,
    startTime: rule.startTime,
    endTime: rule.endTime,
  };
}

function getLocalDateTimeValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

export function AvailabilitySettingsPanel({
  defaultDisplayName,
}: {
  defaultDisplayName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [savingException, setSavingException] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [bookingSlug, setBookingSlug] = useState("");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [minimumNoticeMinutes, setMinimumNoticeMinutes] =
    useState(60);
  const [bookingWindowDays, setBookingWindowDays] = useState(60);
  const [timeZone, setTimeZone] = useState("UTC");
  const [isActive, setIsActive] = useState(true);

  const [rules, setRules] = useState<DraftRule[]>([]);
  const [exceptions, setExceptions] = useState<
    AvailabilityException[]
  >([]);

  const [exceptionStartsAt, setExceptionStartsAt] = useState("");
  const [exceptionEndsAt, setExceptionEndsAt] = useState("");
  const [exceptionNote, setExceptionNote] = useState("");
  const [exceptionIsAvailable, setExceptionIsAvailable] =
    useState(false);

  const bookingLink = useMemo(() => {
    if (!bookingSlug || typeof window === "undefined") return "";

    return `${window.location.origin}/book/${bookingSlug}`;
  }, [bookingSlug]);

  async function loadSettings() {
    setLoading(true);
    setError("");

    try {
      const [settingsResponse, exceptionsResponse] =
        await Promise.all([
          getAvailabilitySettings(),
          getAvailabilityExceptions(),
        ]);

      const profile = settingsResponse.data.profile;

      if (profile) {
        setBookingSlug(profile.bookingSlug);
        setDisplayName(profile.displayName);
        setWelcomeMessage(profile.welcomeMessage);
        setDurationMinutes(profile.defaultDurationMinutes);
        setMinimumNoticeMinutes(profile.minimumNoticeMinutes);
        setBookingWindowDays(profile.bookingWindowDays);
        setTimeZone(profile.timeZone);
        setIsActive(profile.isActive);
      } else {
        setTimeZone(
          Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        );
      }

      setRules(
        settingsResponse.data.rules.length
          ? settingsResponse.data.rules.map(toDraftRule)
          : defaultRules(),
      );

      setExceptions(exceptionsResponse.data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load booking settings.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  function updateRule(
    key: string,
    changes: Partial<Omit<DraftRule, "key">>,
  ) {
    setRules((current) =>
      current.map((rule) =>
        rule.key === key ? { ...rule, ...changes } : rule,
      ),
    );
  }

  function addRule(weekday: number) {
    setRules((current) => [
      ...current,
      {
        key: `new-${crypto.randomUUID()}`,
        weekday,
        startTime: "09:00",
        endTime: "17:00",
      },
    ]);
  }

  function removeRule(key: string) {
    setRules((current) =>
      current.filter((rule) => rule.key !== key),
    );
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    setError("");
    setNotice("");

    try {
      const response = await saveBookingProfile({
        bookingSlug,
        displayName,
        welcomeMessage,
        defaultDurationMinutes: durationMinutes,
        minimumNoticeMinutes,
        bookingWindowDays,
        timeZone,
        isActive,
      });

      const profile = response.data.profile;

      if (profile) {
        setBookingSlug(profile.bookingSlug);
      }

      setNotice("Booking link settings saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save booking settings.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveRules() {
    setSavingRules(true);
    setError("");
    setNotice("");

    try {
      const response = await saveAvailabilityRules(
        rules.map(({ weekday, startTime, endTime }) => ({
          weekday,
          startTime,
          endTime,
        })),
      );

      setRules(response.data.rules.map(toDraftRule));
      setNotice("Weekly availability saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save availability.",
      );
    } finally {
      setSavingRules(false);
    }
  }

  async function handleCopyLink() {
    if (!bookingLink) return;

    try {
      await navigator.clipboard.writeText(bookingLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Unable to copy the booking link.");
    }
  }

  async function handleAddException(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSavingException(true);
    setError("");
    setNotice("");

    try {
      const response = await createAvailabilityException({
        startsAt: new Date(exceptionStartsAt).toISOString(),
        endsAt: new Date(exceptionEndsAt).toISOString(),
        isAvailable: exceptionIsAvailable,
        note: exceptionNote,
      });

      setExceptions((current) =>
        [...current, response.data].sort(
          (first, second) =>
            new Date(first.startsAt).getTime() -
            new Date(second.startsAt).getTime(),
        ),
      );

      setExceptionStartsAt("");
      setExceptionEndsAt("");
      setExceptionNote("");
      setExceptionIsAvailable(false);
      setNotice("Availability exception saved.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save this exception.",
      );
    } finally {
      setSavingException(false);
    }
  }

  async function handleDeleteException(exceptionId: number) {
    setError("");

    try {
      await deleteAvailabilityException(exceptionId);

      setExceptions((current) =>
        current.filter((item) => item.id !== exceptionId),
      );

      setNotice("Availability exception removed.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to remove this exception.",
      );
    }
  }

  if (loading) {
    return (
      <section className="mt-5 grid min-h-48 place-items-center rounded-2xl border border-border bg-white shadow-soft">
        <div className="flex items-center gap-3 text-sm font-black text-navy-500">
          <Loader2
            size={18}
            className="animate-spin text-telefya-blue"
          />
          Loading booking settings…
        </div>
      </section>
    );
  }

  return (
    <section className="mt-5 grid gap-5">
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-soft">
        <div className="telefya-accent-line h-1" />

        <div className="flex flex-col gap-2 p-5 sm:p-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-telefya-violet">
            <Link2 size={14} />
            Booking link
          </span>

          <h2 className="text-xl font-black text-navy-900">
            Let people book time with you
          </h2>

          <p className="max-w-2xl text-sm font-semibold leading-6 text-navy-500">
            Choose your working hours and share a secure Telefya link.
            Visitors see only available times, never your private calendar.
          </p>
        </div>

        <div className="grid gap-4 border-t border-border p-5 sm:grid-cols-2 sm:p-6">
          <label className="grid gap-2">
            <span className="text-xs font-black text-navy-700">
              Booking link
            </span>

            <div className="flex overflow-hidden rounded-xl border border-border bg-white focus-within:border-telefya-blue">
              <span className="flex items-center border-r border-border bg-navy-50 px-3 text-xs font-bold text-navy-400">
                /book/
              </span>

              <input
                value={bookingSlug}
                onChange={(event) =>
                  setBookingSlug(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, ""),
                  )
                }
                placeholder="your-name"
                maxLength={80}
                className="h-11 min-w-0 flex-1 px-3 text-sm font-bold text-navy-900 outline-none"
              />
            </div>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black text-navy-700">
              Display name
            </span>

            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your public name"
              maxLength={120}
              className="h-11 rounded-xl border border-border px-3 text-sm font-bold text-navy-900 outline-none transition focus:border-telefya-blue"
            />
          </label>

          <label className="grid gap-2 sm:col-span-2">
            <span className="text-xs font-black text-navy-700">
              Welcome message <span className="text-navy-400">(optional)</span>
            </span>

            <textarea
              value={welcomeMessage}
              onChange={(event) => setWelcomeMessage(event.target.value)}
              placeholder="Choose a time that works for you."
              maxLength={500}
              rows={2}
              className="resize-none rounded-xl border border-border px-3 py-3 text-sm font-semibold text-navy-900 outline-none transition focus:border-telefya-blue"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black text-navy-700">
              Default duration
            </span>

            <select
              value={durationMinutes}
              onChange={(event) =>
                setDurationMinutes(Number(event.target.value))
              }
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
            >
              {[15, 30, 45, 60, 90, 120].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black text-navy-700">
              Minimum notice
            </span>

            <select
              value={minimumNoticeMinutes}
              onChange={(event) =>
                setMinimumNoticeMinutes(Number(event.target.value))
              }
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
            >
              <option value={0}>No minimum notice</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
              <option value={1440}>24 hours</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black text-navy-700">
              Booking window
            </span>

            <select
              value={bookingWindowDays}
              onChange={(event) =>
                setBookingWindowDays(Number(event.target.value))
              }
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
            >
              <option value={14}>14 days ahead</option>
              <option value={30}>30 days ahead</option>
              <option value={60}>60 days ahead</option>
              <option value={90}>90 days ahead</option>
              <option value={180}>180 days ahead</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black text-navy-700">
              Time zone
            </span>

            <input
              value={timeZone}
              onChange={(event) => setTimeZone(event.target.value)}
              placeholder="Africa/Lagos"
              className="h-11 rounded-xl border border-border px-3 text-sm font-bold text-navy-900 outline-none transition focus:border-telefya-blue"
            />
          </label>

          <label className="flex items-center gap-3 rounded-xl border border-border bg-navy-50 px-4 py-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 accent-[#0F6BFF]"
            />

            <span className="text-sm font-bold text-navy-700">
              Accept new bookings through this link
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={savingProfile}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-telefya-blue px-4 text-sm font-black text-white transition hover:bg-telefya-violet disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingProfile ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Save booking link
            </button>

            {bookingLink ? (
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-black text-navy-700 transition hover:border-telefya-blue hover:text-telefya-blue"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy link"}
              </button>
            ) : null}

            {bookingLink ? (
              <span className="w-full truncate text-xs font-bold text-navy-400 sm:w-auto">
                {bookingLink}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-telefya-blue">
            <Clock3 size={19} />
          </span>

          <div>
            <h2 className="text-lg font-black text-navy-900">
              Weekly working hours
            </h2>

            <p className="mt-1 text-sm font-semibold leading-6 text-navy-500">
              Guests can only choose times inside these windows.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {DAYS.map((day, weekday) => {
            const dayRules = rules.filter(
              (rule) => rule.weekday === weekday,
            );

            return (
              <div
                key={day}
                className="rounded-xl border border-border bg-navy-50/50 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-24 text-sm font-black text-navy-800">
                    {day}
                  </span>

                  {dayRules.length ? (
                    dayRules.map((rule) => (
                      <div
                        key={rule.key}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="time"
                          value={rule.startTime}
                          onChange={(event) =>
                            updateRule(rule.key, {
                              startTime: event.target.value,
                            })
                          }
                          className="h-9 rounded-lg border border-border bg-white px-2 text-xs font-bold text-navy-800 outline-none focus:border-telefya-blue"
                        />

                        <span className="text-xs font-black text-navy-400">
                          to
                        </span>

                        <input
                          type="time"
                          value={rule.endTime}
                          onChange={(event) =>
                            updateRule(rule.key, {
                              endTime: event.target.value,
                            })
                          }
                          className="h-9 rounded-lg border border-border bg-white px-2 text-xs font-bold text-navy-800 outline-none focus:border-telefya-blue"
                        />

                        <button
                          type="button"
                          onClick={() => removeRule(rule.key)}
                          aria-label={`Remove ${day} availability`}
                          className="grid h-9 w-9 place-items-center rounded-lg text-navy-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs font-bold text-navy-400">
                      Unavailable
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => addRule(weekday)}
                    className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-black text-telefya-blue transition hover:border-telefya-blue"
                  >
                    <Plus size={14} />
                    Add hours
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void handleSaveRules()}
          disabled={savingRules}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-navy-900 px-4 text-sm font-black text-white transition hover:bg-telefya-blue disabled:cursor-not-allowed disabled:opacity-60"
        >
          {savingRules ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Check size={16} />
          )}
          Save working hours
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600">
            <CalendarOff size={19} />
          </span>

          <div>
            <h2 className="text-lg font-black text-navy-900">
              Date-specific availability
            </h2>

            <p className="mt-1 text-sm font-semibold leading-6 text-navy-500">
              Block PTO, holidays, or add a one-off extra booking window.
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => void handleAddException(event)}
          className="mt-5 grid gap-3 rounded-xl border border-border bg-navy-50/50 p-4 sm:grid-cols-2"
        >
          <label className="grid gap-2">
            <span className="text-xs font-black text-navy-700">
              Starts
            </span>

            <input
              required
              type="datetime-local"
              value={exceptionStartsAt}
              onChange={(event) =>
                setExceptionStartsAt(event.target.value)
              }
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black text-navy-700">
              Ends
            </span>

            <input
              required
              type="datetime-local"
              value={exceptionEndsAt}
              onChange={(event) =>
                setExceptionEndsAt(event.target.value)
              }
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
            />
          </label>

          <label className="grid gap-2 sm:col-span-2">
            <span className="text-xs font-black text-navy-700">
              Note <span className="text-navy-400">(optional)</span>
            </span>

            <input
              value={exceptionNote}
              onChange={(event) =>
                setExceptionNote(event.target.value)
              }
              placeholder="Annual leave"
              maxLength={500}
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none focus:border-telefya-blue"
            />
          </label>

          <label className="flex items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={exceptionIsAvailable}
              onChange={(event) =>
                setExceptionIsAvailable(event.target.checked)
              }
              className="h-4 w-4 accent-[#0F6BFF]"
            />

            <span className="text-sm font-bold text-navy-700">
              This is extra availability, not blocked time
            </span>
          </label>

          <button
            type="submit"
            disabled={savingException}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-telefya-blue bg-white px-4 text-sm font-black text-telefya-blue transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 sm:justify-self-start"
          >
            {savingException ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            Add exception
          </button>
        </form>

        <div className="mt-4 grid gap-2">
          {exceptions.length ? (
            exceptions.map((exception) => (
              <div
                key={exception.id}
                className="flex items-center gap-3 rounded-xl border border-border px-3 py-3"
              >
                <span
                  className={[
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    exception.isAvailable
                      ? "bg-emerald-500"
                      : "bg-red-500",
                  ].join(" ")}
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-navy-800">
                    {exception.isAvailable
                      ? "Extra availability"
                      : "Blocked time"}
                    {exception.note ? ` · ${exception.note}` : ""}
                  </p>

                  <p className="mt-0.5 text-xs font-semibold text-navy-400">
                    {new Date(exception.startsAt).toLocaleString()} –{" "}
                    {new Date(exception.endsAt).toLocaleString()}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void handleDeleteException(exception.id)
                  }
                  className="grid h-9 w-9 place-items-center rounded-lg text-navy-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete availability exception"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-5 text-sm font-semibold text-navy-400">
              No date-specific availability changes yet.
            </p>
          )}
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"
        >
          {notice}
        </p>
      ) : null}
    </section>
  );
}