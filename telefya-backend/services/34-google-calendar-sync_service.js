const {
  getGoogleAccessTokenService,
} = require("./33-google-calendar-oauth_service");

const GOOGLE_EVENTS_BASE =
  "https://www.googleapis.com/calendar/v3/calendars";

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function toUtcDate(value) {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  const raw = String(value || "").trim();

  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
      ? `${raw.replace(" ", "T")}Z`
      : raw;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Meeting has an invalid scheduled time.");
  }

  return date;
}

function getEndTime(meeting) {
  const startsAt = toUtcDate(meeting.scheduled_for);

  return new Date(
    startsAt.getTime() +
      Math.max(15, Number(meeting.duration_minutes || 60)) *
        60 *
        1000,
  );
}

async function parseGoogleResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      body?.error?.message ||
      body?.error_description ||
      body?.error ||
      "Google Calendar request failed.";

    const error = new Error(String(message).slice(0, 500));
    error.status = response.status;
    throw error;
  }

  return body;
}

function buildGoogleEventBody(meeting) {
  const startsAt = toUtcDate(meeting.scheduled_for);
  const endsAt = getEndTime(meeting);
  const timeZone = cleanText(meeting.time_zone, "UTC");
  const title = cleanText(meeting.des, "Telefya meeting");
  const hostName = cleanText(meeting.host_name, "Telefya host");

  return {
    summary: title,
    description: [
      `Telefya meeting hosted by ${hostName}.`,
      "",
      `Join securely: ${meeting.meeting_url}`,
    ].join("\n"),
    location: meeting.meeting_url,
    start: {
      dateTime: startsAt.toISOString(),
      timeZone,
    },
    end: {
      dateTime: endsAt.toISOString(),
      timeZone,
    },
    reminders: {
      useDefault: true,
    },
    extendedProperties: {
      private: {
        telefyaMeetingId: String(meeting.id),
        telefyaRoomId: String(meeting.room_id),
      },
    },
    source: {
      title: "Telefya",
      url: meeting.meeting_url,
    },
  };
}

async function getVisibleMeetingForUser(dbQuery, meetingId, userId) {
  const rows = await dbQuery(
    `
      SELECT DISTINCT
        meeting.id,
        meeting.room_id,
        meeting.meeting_url,
        meeting.des,
        meeting.scheduled_for,
        meeting.duration_minutes,
        meeting.time_zone,
        meeting.status,
        meeting.calendar_sequence,
        meeting.shedular_user_id,
        CONCAT_WS(
          ' ',
          host.first_name,
          host.last_name
        ) AS host_name
      FROM meeting_schedules meeting
      LEFT JOIN users host
        ON host.user_id = meeting.shedular_user_id
      LEFT JOIN meeting_members member
        ON member.meeting_id = meeting.id
        AND member.user_id = ?
        AND member.status IN ('invited', 'accepted')
      WHERE meeting.id = ?
        AND (
          meeting.shedular_user_id = ?
          OR member.user_id IS NOT NULL
        )
      LIMIT 1
    `,
    [userId, meetingId, userId],
  );

  return rows?.[0] || null;
}

async function getGoogleEventMapping(
  dbQuery,
  connectionId,
  meetingId,
) {
  const rows = await dbQuery(
    `
      SELECT *
      FROM calendar_provider_events
      WHERE connection_id = ?
        AND meeting_id = ?
      LIMIT 1
    `,
    [connectionId, meetingId],
  );

  return rows?.[0] || null;
}

async function markSyncError(
  dbQuery,
  {
    connectionId,
    meetingId,
    providerEventId = null,
    error,
  },
) {
  const message = String(
    error?.message || "Google Calendar sync failed.",
  ).slice(0, 500);

  if (providerEventId) {
    await dbQuery(
      `
        INSERT INTO calendar_provider_events
        (
          connection_id,
          meeting_id,
          provider_event_id,
          sync_status,
          last_error
        )
        VALUES (?, ?, ?, 'error', ?)
        ON DUPLICATE KEY UPDATE
          sync_status = 'error',
          last_error = VALUES(last_error)
      `,
      [connectionId, meetingId, providerEventId, message],
    );
  }

  await dbQuery(
    `
      UPDATE calendar_provider_connections
      SET last_error = ?
      WHERE id = ?
    `,
    [message, connectionId],
  );
}

async function markSynced(
  dbQuery,
  {
    connectionId,
    meetingId,
    providerEventId,
    providerEtag,
  },
) {
  await dbQuery(
    `
      INSERT INTO calendar_provider_events
      (
        connection_id,
        meeting_id,
        provider_event_id,
        provider_etag,
        sync_status,
        last_error,
        synced_at
      )
      VALUES (?, ?, ?, ?, 'synced', NULL, NOW())
      ON DUPLICATE KEY UPDATE
        provider_event_id = VALUES(provider_event_id),
        provider_etag = VALUES(provider_etag),
        sync_status = 'synced',
        last_error = NULL,
        synced_at = NOW()
    `,
    [
      connectionId,
      meetingId,
      providerEventId,
      providerEtag || null,
    ],
  );

  await dbQuery(
    `
      UPDATE calendar_provider_connections
      SET
        status = 'active',
        last_error = NULL,
        last_synced_at = NOW()
      WHERE id = ?
    `,
    [connectionId],
  );
}

async function syncGoogleMeetingForUser(
  dbQuery,
  {
    userId,
    meetingId,
  },
) {
  const tokenState = await getGoogleAccessTokenService(
    dbQuery,
    userId,
  );

  // Google Calendar is optional: no connected account is not an error.
  if (!tokenState) {
    return {
      success: true,
      skipped: true,
      reason: "not_connected",
    };
  }

  const { connection, accessToken } = tokenState;
  const meeting = await getVisibleMeetingForUser(
    dbQuery,
    meetingId,
    userId,
  );

  if (!meeting) {
    return {
      success: true,
      skipped: true,
      reason: "not_visible",
    };
  }

  const mapping = await getGoogleEventMapping(
    dbQuery,
    connection.id,
    meeting.id,
  );

  const calendarId = encodeURIComponent(
    connection.calendar_id || "primary",
  );

  try {
    if (meeting.status === "cancelled") {
      if (mapping?.provider_event_id) {
        const response = await fetch(
          `${GOOGLE_EVENTS_BASE}/${calendarId}/events/${encodeURIComponent(
            mapping.provider_event_id,
          )}?sendUpdates=none`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        /*
         * Google returns 404 when the user removed the event directly.
         * That still means Telefya no longer needs to retain it.
         */
        if (!response.ok && response.status !== 404) {
          await parseGoogleResponse(response);
        }
      }

      if (mapping) {
        await dbQuery(
          `
            UPDATE calendar_provider_events
            SET
              sync_status = 'deleted',
              last_error = NULL,
              synced_at = NOW()
            WHERE id = ?
          `,
          [mapping.id],
        );
      }

      return {
        success: true,
        action: "deleted",
      };
    }

    const eventBody = buildGoogleEventBody(meeting);
    const hasMapping =
      mapping?.provider_event_id &&
      mapping.sync_status !== "deleted";

    const response = await fetch(
      hasMapping
        ? `${GOOGLE_EVENTS_BASE}/${calendarId}/events/${encodeURIComponent(
            mapping.provider_event_id,
          )}?sendUpdates=none`
        : `${GOOGLE_EVENTS_BASE}/${calendarId}/events?sendUpdates=none`,
      {
        method: hasMapping ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      },
    );

    const event = await parseGoogleResponse(response);

    await markSynced(dbQuery, {
      connectionId: connection.id,
      meetingId: meeting.id,
      providerEventId: event.id,
      providerEtag: event.etag,
    });

    return {
      success: true,
      action: hasMapping ? "updated" : "created",
      providerEventId: event.id,
    };
  } catch (error) {
    await markSyncError(dbQuery, {
      connectionId: connection.id,
      meetingId: meeting.id,
      providerEventId: mapping?.provider_event_id || null,
      error,
    });

    throw error;
  }
}

async function getAffectedCalendarUsers(dbQuery, meetingId) {
  const rows = await dbQuery(
    `
      SELECT shedular_user_id AS user_id
      FROM meeting_schedules
      WHERE id = ?

      UNION

      SELECT user_id
      FROM meeting_members
      WHERE meeting_id = ?
        AND status IN ('invited', 'accepted')
    `,
    [meetingId, meetingId],
  );

  return [
    ...new Set(
      (rows || [])
        .map((row) => String(row.user_id || "").trim())
        .filter(Boolean),
    ),
  ];
}

/*
 * All sync is best-effort and asynchronous. A Google outage must never
 * prevent a user from scheduling, changing, or cancelling a Telefya meeting.
 */
function queueGoogleMeetingSync(dbQuery, meetingId) {
  const id = Number(meetingId);

  if (!Number.isInteger(id) || id <= 0) {
    return;
  }

  void getAffectedCalendarUsers(dbQuery, id)
    .then((userIds) =>
      Promise.allSettled(
        userIds.map((userId) =>
          syncGoogleMeetingForUser(dbQuery, {
            userId,
            meetingId: id,
          }),
        ),
      ),
    )
    .then((results) => {
      for (const result of results || []) {
        if (result.status === "rejected") {
          console.warn(
            "[google-calendar] Meeting sync failed:",
            result.reason?.message || result.reason,
          );
        }
      }
    })
    .catch((error) => {
      console.warn(
        "[google-calendar] Unable to prepare meeting sync:",
        error?.message || error,
      );
    });
}

function queueGoogleBackfillForUser(dbQuery, userId) {
  const safeUserId = String(userId || "").trim();

  if (!safeUserId) {
    return;
  }

  void dbQuery(
    `
      SELECT DISTINCT meeting_id
      FROM (
        SELECT id AS meeting_id
        FROM meeting_schedules
        WHERE shedular_user_id = ?
          AND status IN ('upcoming', 'live')

        UNION

        SELECT meeting.id AS meeting_id
        FROM meeting_members member
        INNER JOIN meeting_schedules meeting
          ON meeting.id = member.meeting_id
        WHERE member.user_id = ?
          AND member.status IN ('invited', 'accepted')
          AND meeting.status IN ('upcoming', 'live')
      ) AS visible_meetings
    `,
    [safeUserId, safeUserId],
  )
    .then((rows) =>
      Promise.allSettled(
        (rows || []).map(({ meeting_id }) =>
          syncGoogleMeetingForUser(dbQuery, {
            userId: safeUserId,
            meetingId: Number(meeting_id),
          }),
        ),
      ),
    )
    .then((results) => {
      for (const result of results || []) {
        if (result.status === "rejected") {
          console.warn(
            "[google-calendar] Initial sync failed:",
            result.reason?.message || result.reason,
          );
        }
      }
    })
    .catch((error) => {
      console.warn(
        "[google-calendar] Unable to start initial sync:",
        error?.message || error,
      );
    });
}

module.exports = {
  syncGoogleMeetingForUser,
  queueGoogleMeetingSync,
  queueGoogleBackfillForUser,
};