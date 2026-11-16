let calendarNamespace = null;

function getUserRoom(userId) {
  return `calendar:user:${String(userId).trim()}`;
}

function setCalendarNamespace(namespace) {
  calendarNamespace = namespace;
}

async function getAffectedUserIds(dbQuery, meetingId) {
  const id = Number(meetingId);

  if (!Number.isInteger(id) || id <= 0) {
    return [];
  }

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
    [id, id],
  );

  return [
    ...new Set(
      (rows || [])
        .map((row) => String(row.user_id || "").trim())
        .filter(Boolean),
    ),
  ];
}

function emitToUsers(userIds, eventName, payload) {
  if (!calendarNamespace || !Array.isArray(userIds)) {
    return;
  }

  for (const userId of userIds) {
    calendarNamespace
      .to(getUserRoom(userId))
      .emit(eventName, payload);
  }
}

/*
 * Calendar delivery is intentionally best-effort. A socket outage must
 * never reverse a completed scheduling, cancellation, or booking action.
 */
function publishCalendarChange(
  dbQuery,
  {
    meetingId,
    eventType,
    additionalUserIds = [],
  },
) {
  void getAffectedUserIds(dbQuery, meetingId)
    .then((affectedUserIds) => {
      const userIds = [
        ...new Set([
          ...affectedUserIds,
          ...additionalUserIds
            .map((value) => String(value || "").trim())
            .filter(Boolean),
        ]),
      ];

      emitToUsers(userIds, "calendar:changed", {
        meetingId: Number(meetingId),
        eventType: String(eventType || "updated"),
        occurredAt: new Date().toISOString(),
      });
    })
    .catch((error) => {
      console.warn(
        "[calendar-realtime] Unable to publish calendar change:",
        error?.message || error,
      );
    });
}

module.exports = {
  getUserRoom,
  setCalendarNamespace,
  publishCalendarChange,
};