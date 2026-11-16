"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  Users,
  Video,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { CalendarEventDrawer } from "@/components/calender/calendar-event-drawer";
import { AvailabilitySettingsPanel } from "@/components/calender/availability-settings-panel";
import { CalendarConnectionsPanel } from "@/components/calender/calendar-connections-panel";
import { useCalendarRealtime } from "@/hooks/use-calendar-realtime";
import { getSavedUser } from "@/lib/auth/session";
import {
  getCalendarEvents,
  type CalendarEvent,
} from "@/lib/api/calendar";

type CalendarView = "agenda" | "week" | "month";

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
});

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(value: Date) {
  const next = startOfDay(value);
  const weekday = next.getDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;

  return addDays(next, -daysSinceMonday);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function sameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function formatRange(start: Date, end: Date) {
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const endLabel = addDays(end, -1).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${startLabel} – ${endLabel}`;
}

function getStatusClasses(status: CalendarEvent["status"]) {
  switch (status) {
    case "live":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "ended":
      return "bg-navy-50 text-navy-500 ring-border";
    case "cancelled":
      return "bg-red-50 text-red-700 ring-red-200";
    default:
      return "bg-blue-50 text-telefya-blue ring-blue-100";
  }
}

function getRoleLabel(event: CalendarEvent) {
  if (event.viewer_role === "host") return "Hosted by you";
  if (event.viewer_role === "speaker") return "You are a speaker";
  if (event.viewer_role === "guest") return "Guest invitation";
  return "You are invited";
}

function EventCard({
  event,
  compact = false,
  onOpen,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const startsAt = new Date(event.scheduled_for);
  const endsAt = new Date(event.ends_at);
  const isCancelled = event.status === "cancelled";

  return (
    <article
      onClick={compact ? onOpen : undefined}
      onKeyDown={(keyboardEvent) => {
        if (
          compact &&
          onOpen &&
          (keyboardEvent.key === "Enter" ||
            keyboardEvent.key === " ")
        ) {
          keyboardEvent.preventDefault();
          onOpen();
        }
      }}
      role={compact && onOpen ? "button" : undefined}
      tabIndex={compact && onOpen ? 0 : undefined}
      className={[
        "rounded-xl border bg-white shadow-soft transition hover:border-telefya-blue/35 hover:shadow-enterprise",
        compact ? "p-3" : "p-4",
        isCancelled ? "border-red-100 opacity-70" : "border-border",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,rgba(15,107,255,0.14),rgba(100,38,255,0.13))] text-telefya-blue">
          <Video size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-black text-navy-900">
              {event.title}
            </h3>

            <span
              className={[
                "rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ring-1",
                getStatusClasses(event.status),
              ].join(" ")}
            >
              {event.status}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-navy-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={13} className="text-telefya-violet" />
              {timeFormatter.format(startsAt)} – {timeFormatter.format(endsAt)}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Users size={13} className="text-telefya-violet" />
              {getRoleLabel(event)}
            </span>
          </div>

          {event.host_name && event.viewer_role !== "host" ? (
            <p className="mt-2 text-xs font-semibold text-navy-400">
              Hosted by {event.host_name}
            </p>
          ) : null}

          {event.cancellation_reason ? (
            <p className="mt-2 text-xs font-semibold text-red-600">
              {event.cancellation_reason}
            </p>
          ) : null}
        </div>
      </div>

      {!compact && !isCancelled ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={event.meeting_url}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-telefya-blue px-3 text-xs font-black text-white transition hover:bg-telefya-violet"
          >
            <Video size={14} />
            Join meeting
          </a>

          <button
            onClick={onOpen}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-white px-3 text-xs font-black text-navy-700 transition hover:border-telefya-blue hover:text-telefya-blue"
          >
            {event.viewer_role === "host" ? "Manage" : "Details"}
          </button>

          <span className="inline-flex h-9 items-center rounded-lg border border-border bg-navy-50 px-3 text-xs font-bold text-navy-500">
            {event.duration_minutes} min
          </span>
        </div>
      ) : null}
    </article>
  );
}

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [selectedEvent, setSelectedEvent] =
    useState<CalendarEvent | null>(null);

  const savedUser = useMemo(() => getSavedUser(), []);

  const defaultDisplayName = [
    savedUser?.first_name,
    savedUser?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const range = useMemo(() => {
    if (view === "agenda") {
      const start = startOfDay(anchorDate);
      return { start, end: addDays(start, 30) };
    }

    if (view === "month") {
      const start = startOfWeek(startOfMonth(anchorDate));
      return { start, end: addDays(start, 42) };
    }

    const start = startOfWeek(anchorDate);
    return { start, end: addDays(start, 7) };
  }, [anchorDate, view]);

  const rangeKey = `${range.start.toISOString()}-${range.end.toISOString()}-${includeCancelled}`;

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getCalendarEvents({
        from: range.start.toISOString(),
        to: range.end.toISOString(),
        includeCancelled,
      });

      setEvents(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load calendar events.",
      );
    } finally {
      setLoading(false);
    }
  }, [includeCancelled, range.end, range.start]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents, rangeKey]);

  useCalendarRealtime(() => {
    void loadEvents();
  });

  const calendarDays = useMemo(() => {
    const count = view === "month" ? 42 : view === "week" ? 7 : 30;

    return Array.from(
      { length: count },
      (_, index) => addDays(range.start, index),
    );
  }, [range.start, view]);

  function moveRange(direction: -1 | 1) {
    const increment =
      view === "month" ? 30 : view === "agenda" ? 30 : 7;

    setAnchorDate((current) => addDays(current, direction * increment));
  }

  function resetToToday() {
    setAnchorDate(new Date());
  }

  function getEventsForDay(day: Date) {
    return events.filter((event) => {
      return sameDay(new Date(event.scheduled_for), day);
    });
  }

  const agendaGroups = calendarDays
    .map((day) => ({
      day,
      events: getEventsForDay(day),
    }))
    .filter((group) => group.events.length > 0);

  return (
    <main className="mx-auto max-w-[1440px] pb-6">
      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-soft">
        <div className="telefya-accent-line h-1" />

        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-telefya-blue">
              <CalendarDays size={14} />
              Telefya Calendar
            </span>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-navy-900">
              Meetings, organized.
            </h1>

            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-navy-500">
              View meetings you host and invitations you have received in one
              secure workspace.
            </p>
          </div>

          <Link
            href="/meetings/create"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-telefya-blue px-5 text-sm font-black text-white shadow-soft transition hover:bg-telefya-violet hover:shadow-enterprise"
          >
            <Plus size={17} />
            Schedule meeting
          </Link>
        </div>
      </section>

      <AvailabilitySettingsPanel
        defaultDisplayName={defaultDisplayName}
      />

      <CalendarConnectionsPanel />

      <section className="mt-5 rounded-2xl border border-border bg-white p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => moveRange(-1)}
              aria-label="Previous date range"
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-white text-navy-500 transition hover:border-telefya-blue hover:text-telefya-blue"
            >
              <ChevronLeft size={18} />
            </button>

            <button
              onClick={resetToToday}
              className="h-10 rounded-xl border border-border bg-white px-4 text-sm font-black text-navy-700 transition hover:border-telefya-blue hover:text-telefya-blue"
            >
              Today
            </button>

            <button
              onClick={() => moveRange(1)}
              aria-label="Next date range"
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-white text-navy-500 transition hover:border-telefya-blue hover:text-telefya-blue"
            >
              <ChevronRight size={18} />
            </button>

            <span className="ml-1 text-sm font-black text-navy-900 sm:text-base">
              {view === "month"
                ? anchorDate.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })
                : formatRange(range.start, range.end)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-navy-50 p-1">
              {(["agenda", "week", "month"] as CalendarView[]).map(
                (option) => (
                  <button
                    key={option}
                    onClick={() => setView(option)}
                    className={[
                      "h-8 rounded-lg px-3 text-xs font-black capitalize transition",
                      view === option
                        ? "bg-white text-telefya-blue shadow-soft"
                        : "text-navy-400 hover:text-navy-700",
                    ].join(" ")}
                  >
                    {option}
                  </button>
                ),
              )}
            </div>

            <button
              onClick={() => setIncludeCancelled((value) => !value)}
              className={[
                "h-10 rounded-xl border px-3 text-xs font-black transition",
                includeCancelled
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-border bg-white text-navy-500 hover:border-telefya-blue hover:text-telefya-blue",
              ].join(" ")}
            >
              {includeCancelled ? "Showing cancelled" : "Hide cancelled"}
            </button>

            <button
              onClick={() => void loadEvents()}
              aria-label="Refresh calendar"
              className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-white text-navy-500 transition hover:border-telefya-blue hover:text-telefya-blue"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 grid min-h-80 place-items-center rounded-2xl border border-border bg-white shadow-soft">
          <div className="flex items-center gap-3 text-sm font-black text-navy-500">
            <Loader2 size={18} className="animate-spin text-telefya-blue" />
            Loading your calendar…
          </div>
        </div>
      ) : null}

      {!loading && view === "agenda" ? (
        <section className="mt-5 grid gap-4">
          {agendaGroups.length ? (
            agendaGroups.map(({ day, events: dayEvents }) => (
              <div
                key={day.toISOString()}
                className="rounded-2xl border border-border bg-white p-4 shadow-soft sm:p-5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy-50 text-center">
                    <span className="text-[10px] font-black uppercase text-navy-400">
                      {weekdayFormatter.format(day)}
                    </span>
                    <span className="text-lg font-black text-navy-900">
                      {day.getDate()}
                    </span>
                  </span>

                  <h2 className="font-black text-navy-900">
                    {fullDateFormatter.format(day)}
                  </h2>
                </div>

                <div className="grid gap-3">
                  {dayEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onOpen={() => setSelectedEvent(event)}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <EmptyCalendarState />
          )}
        </section>
      ) : null}

      {!loading && view === "week" ? (
        <section className="mt-5 overflow-x-auto rounded-2xl border border-border bg-white shadow-soft">
          <div className="grid min-w-[840px] grid-cols-7">
            {calendarDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const today = sameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className="min-h-[440px] border-r border-border last:border-r-0"
                >
                  <div className="border-b border-border px-3 py-4 text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-navy-400">
                      {weekdayFormatter.format(day)}
                    </p>
                    <span
                      className={[
                        "mx-auto mt-2 grid h-9 w-9 place-items-center rounded-full text-sm font-black",
                        today
                          ? "bg-telefya-blue text-white"
                          : "text-navy-900",
                      ].join(" ")}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  <div className="grid gap-2 p-2">
                    {dayEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        compact
                        onOpen={() => setSelectedEvent(event)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading && view === "month" ? (
        <section className="mt-5 overflow-x-auto rounded-2xl border border-border bg-white shadow-soft">
          <div className="grid min-w-[840px] grid-cols-7 border-b border-border">
            {calendarDays.slice(0, 7).map((day) => (
              <div
                key={day.toISOString()}
                className="px-3 py-3 text-center text-[11px] font-black uppercase tracking-[0.12em] text-navy-400"
              >
                {weekdayFormatter.format(day)}
              </div>
            ))}
          </div>

          <div className="grid min-w-[840px] grid-cols-7">
            {calendarDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const outsideMonth =
                day.getMonth() !== anchorDate.getMonth();

              return (
                <div
                  key={day.toISOString()}
                  className={[
                    "min-h-32 border-b border-r border-border p-2 last:border-r-0",
                    outsideMonth ? "bg-navy-50/50" : "bg-white",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "grid h-7 w-7 place-items-center rounded-full text-xs font-black",
                      sameDay(day, new Date())
                        ? "bg-telefya-blue text-white"
                        : "text-navy-700",
                    ].join(" ")}
                  >
                    {day.getDate()}
                  </span>

                  <div className="mt-2 grid gap-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        title={event.title}
                        className={[
                          "w-full truncate rounded-md px-2 py-1 text-left text-[10px] font-black transition hover:brightness-95",
                          event.status === "cancelled"
                            ? "bg-red-50 text-red-600"
                            : "bg-blue-50 text-telefya-blue",
                        ].join(" ")}
                      >
                        {timeFormatter.format(
                          new Date(event.scheduled_for),
                        )}{" "}
                        {event.title}
                      </button>
                    ))}

                    {dayEvents.length > 3 ? (
                      <span className="px-2 text-[10px] font-black text-navy-400">
                        +{dayEvents.length - 3} more
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <CalendarEventDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onChanged={loadEvents}
      />
    </main>
  );
}

function EmptyCalendarState() {
  return (
    <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-border bg-navy-50/60 p-6 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-white text-telefya-violet shadow-soft">
          <CalendarDays size={25} />
        </div>

        <h2 className="mt-4 text-lg font-black text-navy-900">
          No meetings in this period
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-navy-500">
          Schedule a secure Telefya meeting or wait for an invitation to appear
          here.
        </p>

        <Link
          href="/meetings/create"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-telefya-blue px-4 text-sm font-black text-white transition hover:bg-telefya-violet"
        >
          <Plus size={16} />
          Schedule meeting
        </Link>
      </div>
    </div>
  );
}