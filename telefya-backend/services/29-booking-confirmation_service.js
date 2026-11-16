const crypto = require("crypto");
const { DateTime, IANAZone } = require("luxon");

const {
  getPublicBookingSlotsService,
} = require("./28-public-booking_service");

const {
  sendMeetingInvitationEmail,
} = require("./meeting-invitation-email");

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toMysqlUtc(value) {
  return value
    .toUTC()
    .toFormat("yyyy-LL-dd HH:mm:ss");
}

function slotUnavailableError() {
  const error = new Error(
    "That time is no longer available. Please choose another time.",
  );

  error.code = "SLOT_UNAVAILABLE";
  return error;
}

function normalizeSlug(value) {
  const slug = cleanText(value).toLowerCase();

  if (!/^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$/.test(slug)) {
    throw new Error("Booking page not found.");
  }

  return slug;
}

function normalizeEmail(value) {
  const email = cleanText(value).toLowerCase();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) ||
    email.length > 100
  ) {
    throw new Error("Enter a valid email address.");
  }

  return email;
}

function normalizeName(value) {
  const name = cleanText(value);

  if (!name || name.length > 120) {
    throw new Error(
      "Your name is required and must not exceed 120 characters.",
    );
  }

  return name;
}

function normalizeTitle(value, hostName) {
  const title = cleanText(
    value,
    `Meeting with ${hostName || "Telefya host"}`,
  );

  if (title.length > 220) {
    throw new Error("Meeting title must not exceed 220 characters.");
  }

  return title;
}

function normalizeTimeZone(value) {
  const timeZone = cleanText(value, "UTC");

  if (!IANAZone.isValidZone(timeZone)) {
    throw new Error("guestTimeZone must be a valid IANA time zone.");
  }

  return timeZone;
}

function parseRequestedStart(value) {
  const raw = cleanText(value);

  if (!raw) {
    throw new Error("startsAt is required.");
  }

  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(raw)) {
    throw new Error(
      "startsAt must be an ISO date-time with a UTC offset.",
    );
  }

  const startsAt = DateTime.fromISO(raw, { setZone: true }).toUTC();

  if (!startsAt.isValid) {
    throw new Error("startsAt must be a valid ISO date-time.");
  }

  return startsAt;
}

function getWebAppUrl() {
  const configured = cleanText(process.env.FRONTEND_URL)
    .split(",")[0]
    .trim()
    .replace(/\/+$/, "");

  return configured || "https://telefya.com";
}

function buildRoomId() {
  return `telefya-${crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 20)}`;
}

async function getLockedProfile(transactionQuery, slug) {
  const rows = await transactionQuery(
    `
      SELECT
        booking.user_id,
        booking.booking_slug,
        booking.display_name,
        booking.default_duration_minutes,
        booking.time_zone,
        booking.is_active,
        user.email AS host_email
      FROM user_booking_profiles booking
      INNER JOIN users user
        ON user.user_id = booking.user_id
      WHERE booking.booking_slug = ?
      LIMIT 1
      FOR UPDATE
    `,
    [slug],
  );

  return rows?.[0] || null;
}

async function createPublicBookingService(
  withTransaction,
  dbQuery,
  rawSlug,
  payload = {},
) {
  const slug = normalizeSlug(rawSlug);
  const guestName = normalizeName(payload.guestName);
  const guestEmail = normalizeEmail(payload.guestEmail);
  const guestTimeZone = normalizeTimeZone(payload.guestTimeZone);
  const requestedStart = parseRequestedStart(payload.startsAt);

  const booking = await withTransaction(async (transactionQuery) => {
    /*
     * Uses the same slot engine as the public page, but on this
     * transaction connection. This rechecks availability immediately
     * before a meeting is inserted.
     */
    const lockedProfile = await getLockedProfile(
      transactionQuery,
      slug,
    );

    if (!lockedProfile || !Boolean(lockedProfile.is_active)) {
      throw new Error("Booking page not found.");
    }

    const localDate = requestedStart
      .setZone(lockedProfile.time_zone)
      .toISODate();

    const availability = await getPublicBookingSlotsService(
      transactionQuery,
      slug,
      {
        from: localDate,
        to: localDate,
      },
    );

    const selectedSlot = availability.data.slots.find(
      (slot) =>
        DateTime.fromISO(slot.startsAt).toUTC().toMillis() ===
        requestedStart.toMillis(),
    );

    if (!selectedSlot) {
      throw slotUnavailableError();
    }

    if (
      String(lockedProfile.host_email).toLowerCase() === guestEmail
    ) {
      throw new Error(
        "Use a different email address from the host to book this meeting.",
      );
    }

    const meetingDuration = Number(
      lockedProfile.default_duration_minutes,
    );

    const startsAt = requestedStart;
    const endsAt = startsAt.plus({
      minutes: meetingDuration,
    });

    /*
     * Locks matching booking rows. The database unique index on
     * (host_user_id, starts_at) is the final protection against two
     * people submitting the same slot at once.
     */
    const bookingConflicts = await transactionQuery(
      `
        SELECT id
        FROM meeting_bookings
        WHERE host_user_id = ?
          AND status = 'confirmed'
          AND starts_at < ?
          AND ends_at > ?
        FOR UPDATE
      `,
      [
        lockedProfile.user_id,
        toMysqlUtc(endsAt),
        toMysqlUtc(startsAt),
      ],
    );

    if (bookingConflicts.length) {
      throw slotUnavailableError();
    }

    const meetingConflicts = await transactionQuery(
      `
        SELECT id
        FROM meeting_schedules
        WHERE shedular_user_id = ?
          AND status IN ('upcoming', 'live')
          AND scheduled_for < ?
          AND DATE_ADD(
            scheduled_for,
            INTERVAL COALESCE(duration_minutes, 60) MINUTE
          ) > ?
        FOR UPDATE
      `,
      [
        lockedProfile.user_id,
        toMysqlUtc(endsAt),
        toMysqlUtc(startsAt),
      ],
    );

    if (meetingConflicts.length) {
      throw slotUnavailableError();
    }

    const meetingTitle = normalizeTitle(
      payload.meetingTitle,
      lockedProfile.display_name,
    );

    const roomId = buildRoomId();
    const meetingUrl = `${getWebAppUrl()}/live/${roomId}`;

    const meetingResult = await transactionQuery(
      `
        INSERT INTO meeting_schedules
        (
          meeting_url,
          room_id,
          time_zone,
          scheduled_for,
          duration_minutes,
          shedular_user_id,
          des,
          status,
          calendar_sequence,
          updated_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'upcoming', 0, ?)
      `,
      [
        meetingUrl,
        roomId,
        lockedProfile.time_zone,
        toMysqlUtc(startsAt),
        meetingDuration,
        lockedProfile.user_id,
        meetingTitle,
        lockedProfile.user_id,
      ],
    );

    const meetingId = meetingResult.insertId;

    const bookingResult = await transactionQuery(
      `
        INSERT INTO meeting_bookings
        (
          host_user_id,
          meeting_id,
          guest_name,
          guest_email,
          guest_time_zone,
          starts_at,
          ends_at,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')
      `,
      [
        lockedProfile.user_id,
        meetingId,
        guestName,
        guestEmail,
        guestTimeZone,
        toMysqlUtc(startsAt),
        toMysqlUtc(endsAt),
      ],
    );

    const existingGuest = await transactionQuery(
      `
        SELECT user_id, email
        FROM users
        WHERE LOWER(email) = ?
        LIMIT 1
      `,
      [guestEmail],
    );

    const guestUser = existingGuest?.[0] || null;

    if (guestUser) {
      await transactionQuery(
        `
          INSERT INTO meeting_members
          (
            meeting_id,
            user_id,
            member_role,
            status,
            invited_by_user_id,
            invited_at,
            responded_at
          )
          VALUES (?, ?, 'attendee', 'invited', ?, NOW(), NULL)
          ON DUPLICATE KEY UPDATE
            member_role = 'attendee',
            status = 'invited',
            invited_by_user_id = VALUES(invited_by_user_id),
            invited_at = NOW(),
            responded_at = NULL
        `,
        [
          meetingId,
          guestUser.user_id,
          lockedProfile.user_id,
        ],
      );
    } else {
      await transactionQuery(
        `
          INSERT INTO meeting_guest_invitations
          (
            meeting_id,
            email,
            member_role,
            invited_by_user_id,
            delivery_status,
            invited_at
          )
          VALUES (?, ?, 'attendee', ?, 'sent', NOW())
          ON DUPLICATE KEY UPDATE
            member_role = 'attendee',
            invited_by_user_id = VALUES(invited_by_user_id),
            delivery_status = 'sent',
            invited_at = NOW()
        `,
        [
          meetingId,
          guestEmail,
          lockedProfile.user_id,
        ],
      );
    }

    return {
      bookingId: bookingResult.insertId,
      meetingId,
      roomId,
      meetingUrl,
      hostUserId: lockedProfile.user_id,
      hostName: lockedProfile.display_name,
      guestEmail,
      guestUserExists: Boolean(guestUser),
      meetingTitle,
      startsAt,
      endsAt,
      durationMinutes: meetingDuration,
      timeZone: lockedProfile.time_zone,
    };
  });

  /*
   * Email occurs after the transaction. A mail-provider outage must never
   * undo a confirmed booking or create a duplicate time slot.
   */
  void sendMeetingInvitationEmail({
    meetingId: booking.meetingId,
    email: booking.guestEmail,
    hostName: booking.hostName,
    meetingUrl: booking.meetingUrl,
    meetingTitle: booking.meetingTitle,
    scheduledFor: booking.startsAt.toISO(),
    durationMinutes: booking.durationMinutes,
  }).catch(async (error) => {
    console.warn(
      "[public-booking] Invitation email failed:",
      error?.message || error,
    );

    if (!booking.guestUserExists) {
      try {
        await dbQuery(
          `
            UPDATE meeting_guest_invitations
            SET delivery_status = 'failed'
            WHERE meeting_id = ?
              AND email = ?
          `,
          [booking.meetingId, booking.guestEmail],
        );
      } catch (updateError) {
        console.warn(
          "[public-booking] Could not mark failed email delivery:",
          updateError?.message || updateError,
        );
      }
    }
  });

  return {
    success: true,
    message: "Your meeting has been booked.",
    data: {
      bookingId: booking.bookingId,
      meetingId: booking.meetingId,
      bookingSlug: slug,
      hostName: booking.hostName,
      meetingTitle: booking.meetingTitle,
      startsAt: booking.startsAt.toISO(),
      endsAt: booking.endsAt.toISO(),
      timeZone: booking.timeZone,
    },
  };
}

module.exports = {
  createPublicBookingService,
};