const { query } = require("../config/db");

const EXPO_PUSH_URL =
  "https://exp.host/--/api/v2/push/send";

const MAX_MESSAGES_PER_BATCH = 100;

const PREFERENCE_COLUMNS = {
  reminders: "meeting_reminders",
  invitations: "meeting_invitations",
  waitingRoom: "waiting_room_requests",
  recordings: "recording_ready",
};

function chunk(items, size) {
  const result = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function isExpoPushToken(value) {
  return /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/.test(
    String(value ?? "").trim(),
  );
}

async function disableInvalidTokens(tokens) {
  const safeTokens = [...new Set(tokens)].filter(
    isExpoPushToken,
  );

  if (!safeTokens.length) {
    return;
  }

  await query(
    `
      UPDATE user_push_devices
      SET enabled = FALSE
      WHERE expo_push_token IN (
        ${safeTokens.map(() => "?").join(", ")}
      )
    `,
    safeTokens,
  );
}

async function savePushTickets(ticketPairs) {
  for (const ticket of ticketPairs) {
    if (!ticket?.ticketId || !ticket?.token || !ticket?.userId) {
      continue;
    }

    await query(
      `
        INSERT IGNORE INTO push_notification_tickets (
          expo_ticket_id,
          expo_push_token,
          user_id,
          status,
          next_check_at
        )
        VALUES (
          ?,
          ?,
          ?,
          'accepted',
          DATE_ADD(NOW(), INTERVAL 15 MINUTE)
        )
      `,
      [
        ticket.ticketId,
        ticket.token,
        ticket.userId,
      ],
    );
  }
}

async function send_push_notifications_to_users({
  userIds,
  title,
  body,
  data = {},
  channelId = "meetings",
  preferenceKey = null,
}) {
  const safeUserIds = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((userId) => String(userId ?? "").trim())
        .filter(Boolean),
    ),
  ];

  if (!safeUserIds.length) {
    return {
      accepted: 0,
      failed: 0,
      skipped: 0,
    };
  }

  const preferenceColumn =
    PREFERENCE_COLUMNS[preferenceKey] ?? null;

  const devices = await query(
    `
      SELECT
        devices.user_id,
        devices.expo_push_token
      FROM user_push_devices devices
      LEFT JOIN user_notification_preferences preferences
        ON preferences.user_id = devices.user_id
      WHERE devices.enabled = TRUE
        AND devices.user_id IN (
          ${safeUserIds.map(() => "?").join(", ")}
        )
        ${
          preferenceColumn
            ? `AND COALESCE(
                preferences.${preferenceColumn},
                TRUE
              ) = TRUE`
            : ""
        }
    `,
    safeUserIds,
  );

  const recipients = devices
    .map((device) => ({
      userId: String(device.user_id ?? "").trim(),
      token: String(device.expo_push_token ?? "").trim(),
    }))
    .filter(
      (device) =>
        device.userId &&
        isExpoPushToken(device.token),
    );

  if (!recipients.length) {
    return {
      accepted: 0,
      failed: 0,
      skipped: safeUserIds.length,
    };
  }

  const messages = recipients.map((recipient) => ({
    ...recipient,
    payload: {
      to: recipient.token,
      sound: "default",
      title: String(title ?? "Telefya").slice(0, 120),
      body: String(body ?? "").slice(0, 500),
      data,
      channelId,
      priority: "high",
    },
  }));

  let accepted = 0;
  let failed = 0;
  const invalidTokens = [];
  const ticketPairs = [];

  for (const batch of chunk(messages, MAX_MESSAGES_PER_BATCH)) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          batch.map((item) => item.payload),
        ),
      });

      const payload = await response.json();

      if (!response.ok || !Array.isArray(payload?.data)) {
        throw new Error(
          payload?.errors?.[0]?.message ||
            "Expo Push Service rejected the request.",
        );
      }

      payload.data.forEach((ticket, index) => {
        const recipient = batch[index];

        if (
          ticket?.status === "ok" &&
          typeof ticket?.id === "string"
        ) {
          accepted += 1;

          ticketPairs.push({
            ticketId: ticket.id,
            token: recipient.token,
            userId: recipient.userId,
          });

          return;
        }

        failed += 1;

        if (
          ticket?.details?.error === "DeviceNotRegistered"
        ) {
          invalidTokens.push(recipient.token);
        }

        console.warn(
          "[push] Expo ticket failed:",
          ticket?.message || ticket,
        );
      });
    } catch (error) {
      failed += batch.length;

      console.error(
        "[push] Unable to send notification batch:",
        error?.message || error,
      );
    }
  }

  await Promise.all([
    disableInvalidTokens(invalidTokens),
    savePushTickets(ticketPairs),
  ]);

  return {
    accepted,
    failed,
    skipped: 0,
  };
}

async function notify_meeting_invitation({
  meeting,
  invitedUserId,
  memberRole,
}) {
  if (!meeting?.room_id || !invitedUserId) {
    return;
  }

  return send_push_notifications_to_users({
    userIds: [invitedUserId],
    title: "Meeting invitation",
    body: `You were invited as a ${memberRole} to ${
      meeting.des || "a Telefya meeting"
    }.`,
    preferenceKey: "invitations",
    data: {
      type: "meeting_invitation",
      meetingId: String(meeting.id),
      roomId: meeting.room_id,
      url: `/meeting/${meeting.room_id}`,
    },
  });
}

async function notify_waiting_room_request({
  hostUserId,
  roomId,
  requesterName,
}) {
  if (!hostUserId || !roomId) {
    return;
  }

  return send_push_notifications_to_users({
    userIds: [hostUserId],
    title: "Waiting room request",
    body: `${requesterName || "A participant"} is waiting to join.`,
    preferenceKey: "waitingRoom",
    data: {
      type: "waiting_room_request",
      roomId,
      url: `/meeting/${roomId}`,
    },
  });
}

async function notify_recording_ready({
  hostUserId,
  recordingId,
  roomId,
  title,
}) {
  if (!hostUserId || !recordingId) {
    return;
  }

  return send_push_notifications_to_users({
    userIds: [hostUserId],
    title: "Recording ready",
    body: `${title || "Your meeting recording"} is ready to view.`,
    preferenceKey: "recordings",
    data: {
      type: "recording_ready",
      recordingId,
      roomId,
      url: `/recordings/${recordingId}`,
    },
  });
}

async function notify_meeting_reminder({
  userIds,
  meeting,
  minutesUntil,
}) {
  if (!meeting?.room_id || !Array.isArray(userIds) || !userIds.length) {
    return;
  }

  const hours = Math.round(minutesUntil / 60);

  const label =
    minutesUntil >= 60
      ? `${hours} hour${hours === 1 ? "" : "s"}`
      : `${minutesUntil} minutes`;

  return send_push_notifications_to_users({
    userIds,
    title: "Meeting reminder",
    body: `${meeting.des || "Your Telefya meeting"} starts in ${label}.`,
    preferenceKey: "reminders",
    data: {
      type: "meeting_reminder",
      roomId: meeting.room_id,
      url: `/meeting/${meeting.room_id}`,
    },
  });
}

module.exports = {
  send_push_notifications_to_users,
  notify_meeting_invitation,
  notify_waiting_room_request,
  notify_recording_ready,
  notify_meeting_reminder,
};