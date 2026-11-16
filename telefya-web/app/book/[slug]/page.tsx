"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Mail,
  ShieldCheck,
  Video,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  createPublicBooking,
  getPublicBookingProfile,
  getPublicBookingSlots,
  type BookingSlot,
  type PublicBookingProfile,
} from "@/lib/api/availability";

function dateKeyInTimeZone(timeZone: string, value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(dateKey: string, amount: number) {
  const value = new Date(`${dateKey}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function getBrowserTimeZone() {
  return (
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC"
  );
}

function formatDay(dateKey: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T12:00:00Z`));
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeURIComponent(params.slug || "");

  const [profile, setProfile] =
    useState<PublicBookingProfile | null>(null);

  const [rangeStart, setRangeStart] = useState("");
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] =
    useState<BookingSlot | null>(null);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    hostName: string;
    meetingTitle: string;
    startsAt: string;
    timeZone: string;
  } | null>(null);

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");

  const days = useMemo(() => {
    if (!rangeStart) return [];

    return Array.from({ length: 7 }, (_, index) =>
      addDays(rangeStart, index),
    );
  }, [rangeStart]);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, BookingSlot[]>();

    for (const slot of slots) {
      const key = dateKeyInTimeZone(
        profile?.timeZone || "UTC",
        new Date(slot.startsAt),
      );

      const current = groups.get(key) || [];
      current.push(slot);
      groups.set(key, current);
    }

    return groups;
  }, [profile?.timeZone, slots]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoadingProfile(true);
      setError("");

      try {
        const response = await getPublicBookingProfile(slug);

        if (!active) return;

        setProfile(response.data);
        setRangeStart(dateKeyInTimeZone(response.data.timeZone));
      } catch (loadError) {
        if (!active) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this booking page.",
        );
      } finally {
        if (active) setLoadingProfile(false);
      }
    }

    if (slug) {
      void loadProfile();
    }

    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    let active = true;

    async function loadSlots() {
      if (!profile || !rangeStart) return;

      setLoadingSlots(true);
      setError("");

      try {
        const response = await getPublicBookingSlots(slug, {
          from: rangeStart,
          to: addDays(rangeStart, 6),
        });

        if (!active) return;

        setSlots(response.data.slots);

        setSelectedSlot((current) => {
          if (
            current &&
            response.data.slots.some(
              (slot) => slot.startsAt === current.startsAt,
            )
          ) {
            return current;
          }

          return null;
        });
      } catch (loadError) {
        if (!active) return;

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load available times.",
        );
      } finally {
        if (active) setLoadingSlots(false);
      }
    }

    void loadSlots();

    return () => {
      active = false;
    };
  }, [profile, rangeStart, slug]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedSlot || !profile) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await createPublicBooking(slug, {
        guestName,
        guestEmail,
        guestTimeZone: getBrowserTimeZone(),
        meetingTitle: meetingTitle.trim() || undefined,
        startsAt: selectedSlot.startsAt,
      });

      setConfirmation({
        hostName: response.data.hostName,
        meetingTitle: response.data.meetingTitle,
        startsAt: response.data.startsAt,
        timeZone: response.data.timeZone,
      });
    } catch (bookingError) {
      const message =
        bookingError instanceof Error
          ? bookingError.message
          : "Unable to confirm your booking.";

      setError(message);

      if (message.toLowerCase().includes("no longer available")) {
        setSelectedSlot(null);
        setRangeStart((current) => current);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingProfile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8ff] px-5">
        <div className="flex items-center gap-3 text-sm font-black text-navy-500">
          <Loader2 size={19} className="animate-spin text-telefya-blue" />
          Loading booking page…
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8ff] px-5">
        <section className="w-full max-w-md rounded-3xl border border-border bg-white p-8 text-center shadow-enterprise">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <CalendarDays size={25} />
          </div>

          <h1 className="mt-5 text-2xl font-black text-navy-900">
            Booking page unavailable
          </h1>

          <p className="mt-3 text-sm font-semibold leading-6 text-navy-500">
            {error ||
              "This booking link does not exist or is no longer accepting appointments."}
          </p>
        </section>
      </main>
    );
  }

  if (confirmation) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8ff] px-5 py-10">
        <section className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-white shadow-enterprise">
          <div className="h-2 bg-[linear-gradient(90deg,#7B1CFF,#0F6BFF,#12D8B0)]" />

          <div className="p-7 text-center sm:p-10">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={34} />
            </div>

            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.15em] text-emerald-600">
              Booking confirmed
            </p>

            <h1 className="mt-2 text-3xl font-black tracking-tight text-navy-900">
              You’re on the calendar.
            </h1>

            <p className="mx-auto mt-4 max-w-md text-sm font-semibold leading-6 text-navy-500">
              Your meeting with {confirmation.hostName} has been scheduled for{" "}
              <strong className="text-navy-800">
                {formatDateTime(
                  confirmation.startsAt,
                  confirmation.timeZone,
                )}
              </strong>
              .
            </p>

            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-left">
              <div className="flex gap-3">
                <Mail
                  size={19}
                  className="mt-0.5 shrink-0 text-telefya-blue"
                />

                <p className="text-sm font-semibold leading-6 text-navy-600">
                  Check your inbox for the secure Telefya meeting link and
                  calendar invitation. You can add it to Google Calendar,
                  Outlook, or Apple Calendar directly from the attached
                  invite.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f8ff] px-4 py-6 sm:px-6 sm:py-10">
      <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-border bg-white shadow-enterprise">
        <div className="h-2 bg-[linear-gradient(90deg,#7B1CFF,#0F6BFF,#12D8B0)]" />

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5 sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-telefya-blue">
              <CalendarDays size={14} />
              Telefya booking
            </span>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-navy-900 sm:text-4xl">
              Meet with {profile.displayName}
            </h1>

            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-navy-500">
              {profile.welcomeMessage ||
                "Choose a time that works for you. You will receive a secure Telefya meeting link and calendar invitation by email."}
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-navy-900">
                  Select a time
                </p>

                <p className="mt-1 text-xs font-bold text-navy-400">
                  All times are shown in {profile.timeZone}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRangeStart((current) =>
                      addDays(current, -7),
                    )
                  }
                  disabled={
                    rangeStart <= dateKeyInTimeZone(profile.timeZone)
                  }
                  aria-label="Previous week"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-white text-navy-500 transition hover:border-telefya-blue hover:text-telefya-blue disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronLeft size={18} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setRangeStart((current) =>
                      addDays(current, 7),
                    )
                  }
                  aria-label="Next week"
                  className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-white text-navy-500 transition hover:border-telefya-blue hover:text-telefya-blue"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {loadingSlots ? (
              <div className="mt-6 grid min-h-60 place-items-center rounded-2xl border border-border bg-navy-50/50">
                <div className="flex items-center gap-3 text-sm font-black text-navy-500">
                  <Loader2
                    size={18}
                    className="animate-spin text-telefya-blue"
                  />
                  Finding available times…
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {days.map((day) => {
                  const daySlots = slotsByDay.get(day) || [];

                  return (
                    <section
                      key={day}
                      className="rounded-2xl border border-border bg-navy-50/50 p-3"
                    >
                      <h2 className="px-1 text-sm font-black text-navy-800">
                        {formatDay(day, profile.timeZone)}
                      </h2>

                      <div className="mt-3 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto pr-1">
                        {daySlots.length ? (
                          daySlots.map((slot) => {
                            const selected =
                              selectedSlot?.startsAt === slot.startsAt;

                            return (
                              <button
                                key={slot.startsAt}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                className={[
                                  "h-10 rounded-xl border px-2 text-xs font-black transition",
                                  selected
                                    ? "border-telefya-blue bg-telefya-blue text-white shadow-soft"
                                    : "border-border bg-white text-navy-700 hover:border-telefya-blue hover:text-telefya-blue",
                                ].join(" ")}
                              >
                                {formatTime(
                                  slot.startsAt,
                                  profile.timeZone,
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <p className="col-span-2 px-1 py-4 text-xs font-bold leading-5 text-navy-400">
                            No times available.
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {error ? (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
              >
                {error}
              </p>
            ) : null}
          </div>

          <aside className="border-t border-border bg-navy-50/60 p-5 lg:border-l lg:border-t-0 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-telefya-violet shadow-soft">
                <Video size={19} />
              </span>

              <div>
                <p className="text-sm font-black text-navy-900">
                  {profile.durationMinutes} minute meeting
                </p>

                <p className="text-xs font-bold text-navy-400">
                  Secure Telefya video call
                </p>
              </div>
            </div>

            {selectedSlot ? (
              <form
                onSubmit={(event) => void handleSubmit(event)}
                className="mt-7 grid gap-4"
              >
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <Clock3
                      size={19}
                      className="mt-0.5 shrink-0 text-telefya-blue"
                    />

                    <div>
                      <p className="text-sm font-black text-navy-900">
                        {formatDateTime(
                          selectedSlot.startsAt,
                          profile.timeZone,
                        )}
                      </p>

                      <p className="mt-1 text-xs font-bold text-navy-500">
                        {profile.timeZone}
                      </p>
                    </div>
                  </div>
                </div>

                <label className="grid gap-2">
                  <span className="text-xs font-black text-navy-700">
                    Your name
                  </span>

                  <input
                    required
                    value={guestName}
                    onChange={(event) => setGuestName(event.target.value)}
                    maxLength={120}
                    autoComplete="name"
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none transition focus:border-telefya-blue"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black text-navy-700">
                    Email address
                  </span>

                  <input
                    required
                    type="email"
                    value={guestEmail}
                    onChange={(event) => setGuestEmail(event.target.value)}
                    maxLength={100}
                    autoComplete="email"
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none transition focus:border-telefya-blue"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-black text-navy-700">
                    Meeting title <span className="text-navy-400">(optional)</span>
                  </span>

                  <input
                    value={meetingTitle}
                    onChange={(event) =>
                      setMeetingTitle(event.target.value)
                    }
                    maxLength={220}
                    placeholder={`Meeting with ${profile.displayName}`}
                    className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-bold text-navy-900 outline-none transition focus:border-telefya-blue"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-telefya-blue px-4 text-sm font-black text-white shadow-soft transition hover:bg-telefya-violet hover:shadow-enterprise disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={17} className="animate-spin" />
                      Booking…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={17} />
                      Confirm booking
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="mt-7 rounded-2xl border border-dashed border-border bg-white p-5 text-center">
                <CalendarDays
                  size={22}
                  className="mx-auto text-navy-300"
                />

                <p className="mt-3 text-sm font-black text-navy-700">
                  Select a time to continue
                </p>

                <p className="mt-2 text-xs font-semibold leading-5 text-navy-400">
                  Your confirmation email includes the secure meeting link
                  and calendar invite.
                </p>
              </div>
            )}

            <div className="mt-7 flex gap-2 border-t border-border pt-5 text-xs font-semibold leading-5 text-navy-400">
              <ShieldCheck
                size={15}
                className="mt-0.5 shrink-0 text-emerald-500"
              />
              Your meeting link is private and sent only to your email.
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}