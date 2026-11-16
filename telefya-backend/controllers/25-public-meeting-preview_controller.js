const { query } = require("../config/db");

function getRoomId(value) {
  const roomId = String(value || "").trim();

  if (!/^[a-zA-Z0-9_-]{3,120}$/.test(roomId)) {
    throw new Error("Invalid meeting room.");
  }

  return roomId;
}

async function get_public_meeting_preview_controller(req, res) {
  try {
    const roomId = getRoomId(req.params.roomId);

    const rows = await query(
      `
        SELECT
          room_id,
          COALESCE(NULLIF(des, ''), 'Telefya meeting') AS title,
          scheduled_for,
          duration_minutes,
          time_zone,
          status
        FROM meeting_schedules
        WHERE room_id = ?
        LIMIT 1
      `,
      [roomId],
    );

    const meeting = rows?.[0];

    if (!meeting) {
      return res.status(404).json({
        success: false,
        error: true,
        status: 404,
        message: "Meeting not found.",
      });
    }

    return res.status(200).json({
      success: true,
      error: false,
      status: 200,
      data: {
        roomId: meeting.room_id,
        title: meeting.title,
        scheduledFor: meeting.scheduled_for,
        durationMinutes: meeting.duration_minutes,
        timeZone: meeting.time_zone,
        status: meeting.status,
      },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: true,
      status: 400,
      message: error?.message || "Unable to load meeting preview.",
    });
  }
}

module.exports = {
  get_public_meeting_preview_controller,
};