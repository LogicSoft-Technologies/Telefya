const { query } = require("../config/db");

const ALLOWED_EVENT_TYPES = new Set([
  "poor_network",
  "meeting_join_failed",
  "meeting_reconnected",
]);

const ALLOWED_QUALITY_LEVELS = new Set([
  "unknown",
  "good",
  "fair",
  "poor",
]);

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

function toNullableNumber(value, max) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return Math.min(Math.round(number), max);
}

async function report_meeting_telemetry_controller(req, res) {
  try {
    const userId = getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        error: true,
        message: "Authenticated user could not be identified.",
      });
    }

    const roomId = String(req.body?.roomId ?? "").trim();
    const eventType = String(req.body?.eventType ?? "").trim();
    const qualityLevel = String(
      req.body?.qualityLevel ?? "unknown",
    ).trim();

    if (!roomId || roomId.length > 120) {
      return res.status(400).json({
        error: true,
        message: "A valid meeting room ID is required.",
      });
    }

    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return res.status(400).json({
        error: true,
        message: "Unsupported telemetry event type.",
      });
    }

    if (!ALLOWED_QUALITY_LEVELS.has(qualityLevel)) {
      return res.status(400).json({
        error: true,
        message: "Unsupported network quality level.",
      });
    }

    const roundTripTimeMs = toNullableNumber(
      req.body?.roundTripTimeMs,
      60000,
    );
    const jitterMs = toNullableNumber(req.body?.jitterMs, 60000);

    const rawPacketLoss = Number(req.body?.packetLossPercent);
    const packetLossPercent =
      Number.isFinite(rawPacketLoss) && rawPacketLoss >= 0
        ? Math.min(Math.round(rawPacketLoss * 100) / 100, 100)
        : null;

    const bitrateKbps = toNullableNumber(
      req.body?.bitrateKbps,
      1000000,
    );

    const metadata =
      req.body?.metadata &&
      typeof req.body.metadata === "object" &&
      !Array.isArray(req.body.metadata)
        ? JSON.stringify(req.body.metadata)
        : null;

    await query(
      `
        INSERT INTO meeting_telemetry_events (
          user_id,
          room_id,
          event_type,
          quality_level,
          round_trip_time_ms,
          jitter_ms,
          packet_loss_percent,
          bitrate_kbps,
          metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        roomId,
        eventType,
        qualityLevel,
        roundTripTimeMs,
        jitterMs,
        packetLossPercent,
        bitrateKbps,
        metadata,
      ],
    );

    return res.status(201).json({
      success: true,
    });
  } catch (error) {
    console.error("Meeting telemetry report error:", error);

    return res.status(500).json({
      error: true,
      message: "Unable to save meeting telemetry.",
    });
  }
}

module.exports = {
  report_meeting_telemetry_controller,
};