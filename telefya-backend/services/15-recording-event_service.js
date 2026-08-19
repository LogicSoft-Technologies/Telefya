function cleanString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;

  return String(value).trim();
}

function cleanMetadata(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value;
}

async function getActiveRecordingForRoom(db_query, roomId) {
  const rows = await db_query(
    `
      SELECT recording_id, started_at
      FROM meeting_recordings
      WHERE room_id = ?
        AND status = 'recording'
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [roomId],
  );

  return rows?.[0] || null;
}

async function record_meeting_recording_event_service(
  db_query,
  {
    roomId,
    eventType,
    actorUserId = null,
    actorName = null,
    message = null,
    metadata = {},
  },
) {
  const safeRoomId = cleanString(roomId);
  const safeEventType = cleanString(eventType);

  if (!safeRoomId || !safeEventType) {
    return null;
  }

  const recording = await getActiveRecordingForRoom(db_query, safeRoomId);

  if (!recording?.recording_id) {
    return null;
  }

  const safeActorUserId = cleanString(actorUserId) || null;
  const safeActorName = cleanString(actorName).slice(0, 160) || null;
  const safeMessage = cleanString(message).slice(0, 4000) || null;
  const safeMetadata = JSON.stringify(cleanMetadata(metadata));

  await db_query(
    `
      INSERT INTO meeting_recording_events (
        recording_id,
        room_id,
        event_type,
        actor_user_id,
        actor_name,
        message,
        metadata,
        occurred_at
      )
      VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), NOW())
    `,
    [
      recording.recording_id,
      safeRoomId,
      safeEventType.slice(0, 80),
      safeActorUserId,
      safeActorName,
      safeMessage,
      safeMetadata,
    ],
  );

  return {
    recordingId: recording.recording_id,
    roomId: safeRoomId,
    eventType: safeEventType,
  };
}

async function list_meeting_recording_events_service(
  db_query,
  recordingId,
  limit = 100,
) {
  const safeRecordingId = cleanString(recordingId);
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

  if (!safeRecordingId) {
    return [];
  }

  return db_query(
    `
      SELECT
        id,
        recording_id,
        room_id,
        event_type,
        actor_user_id,
        actor_name,
        message,
        metadata,
        occurred_at
      FROM meeting_recording_events
      WHERE recording_id = ?
      ORDER BY occurred_at ASC, id ASC
      LIMIT ?
    `,
    [safeRecordingId, safeLimit],
  );
}

async function get_latest_recording_chat_events_service(
  db_query,
  recordingId,
  limit = 5,
) {
  const safeRecordingId = cleanString(recordingId);
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);

  if (!safeRecordingId) {
    return [];
  }

  const rows = await db_query(
    `
      SELECT
        event_type,
        actor_name,
        message,
        occurred_at
      FROM meeting_recording_events
      WHERE recording_id = ?
        AND event_type IN ('chat_message', 'participant_joined', 'participant_left')
      ORDER BY occurred_at DESC, id DESC
      LIMIT ?
    `,
    [safeRecordingId, safeLimit],
  );

  return [...rows].reverse();
}

module.exports = {
  record_meeting_recording_event_service,
  list_meeting_recording_events_service,
  get_latest_recording_chat_events_service,
};