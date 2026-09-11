const { query } = require("../config/db");

function getAuthenticatedUserId(req) {
  const embeddedUser = req.user?.user;

  const candidates = [
    embeddedUser?.user_id,
    embeddedUser?.id,
    embeddedUser?.userId,
    typeof embeddedUser === "string" ||
    typeof embeddedUser === "number"
      ? embeddedUser
      : null,
    req.user?.user_id,
    req.user?.id,
    req.user?.userId,
  ];

  const userId = candidates.find(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).trim(),
  );

  return userId ? String(userId).trim() : "";
}

function toBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

async function get_notification_preferences_controller(
  req,
  res,
) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    await query(
      `
        INSERT IGNORE INTO user_notification_preferences (
          user_id
        )
        VALUES (?)
      `,
      [userId],
    );

    const rows = await query(
      `
        SELECT
          meeting_reminders,
          meeting_invitations,
          waiting_room_requests,
          recording_ready
        FROM user_notification_preferences
        WHERE user_id = ?
        LIMIT 1
      `,
      [userId],
    );

    const preferences = rows?.[0];

    return res.status(200).json({
      success: true,
      data: {
        reminders:
          Boolean(preferences?.meeting_reminders),
        invitations:
          Boolean(preferences?.meeting_invitations),
        waitingRoom:
          Boolean(preferences?.waiting_room_requests),
        recordings:
          Boolean(preferences?.recording_ready),
      },
    });
  } catch (error) {
    console.error(
      "[notification-preferences] Read failed:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve notification preferences.",
    });
  }
}

async function update_notification_preferences_controller(
  req,
  res,
) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user.",
      });
    }

    const currentRows = await query(
      `
        SELECT
          meeting_reminders,
          meeting_invitations,
          waiting_room_requests,
          recording_ready
        FROM user_notification_preferences
        WHERE user_id = ?
        LIMIT 1
      `,
      [userId],
    );

    const current = currentRows?.[0] ?? {
      meeting_reminders: true,
      meeting_invitations: true,
      waiting_room_requests: true,
      recording_ready: true,
    };

    const next = {
      reminders: toBoolean(
        req.body?.reminders,
        Boolean(current.meeting_reminders),
      ),
      invitations: toBoolean(
        req.body?.invitations,
        Boolean(current.meeting_invitations),
      ),
      waitingRoom: toBoolean(
        req.body?.waitingRoom,
        Boolean(current.waiting_room_requests),
      ),
      recordings: toBoolean(
        req.body?.recordings,
        Boolean(current.recording_ready),
      ),
    };

    await query(
      `
        INSERT INTO user_notification_preferences (
          user_id,
          meeting_reminders,
          meeting_invitations,
          waiting_room_requests,
          recording_ready
        )
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          meeting_reminders = VALUES(meeting_reminders),
          meeting_invitations = VALUES(meeting_invitations),
          waiting_room_requests = VALUES(waiting_room_requests),
          recording_ready = VALUES(recording_ready)
      `,
      [
        userId,
        next.reminders,
        next.invitations,
        next.waitingRoom,
        next.recordings,
      ],
    );

    return res.status(200).json({
      success: true,
      message: "Notification preferences saved.",
      data: next,
    });
  } catch (error) {
    console.error(
      "[notification-preferences] Update failed:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Unable to save notification preferences.",
    });
  }
}

module.exports = {
  get_notification_preferences_controller,
  update_notification_preferences_controller,
};