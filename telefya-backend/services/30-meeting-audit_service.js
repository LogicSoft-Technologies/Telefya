const crypto = require("crypto");

const ACTOR_TYPES = new Set([
  "host",
  "member",
  "guest",
  "system",
]);

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeOptionalId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Audit IDs must be positive integers.");
  }

  return id;
}

function normalizeActorType(value) {
  const actorType = cleanText(value, "system").toLowerCase();

  if (!ACTOR_TYPES.has(actorType)) {
    throw new Error("Invalid audit actor type.");
  }

  return actorType;
}

function normalizeEventType(value) {
  const eventType = cleanText(value).toUpperCase();

  if (!/^[A-Z][A-Z0-9_]{2,79}$/.test(eventType)) {
    throw new Error(
      "Audit event type must contain uppercase letters, numbers, and underscores.",
    );
  }

  return eventType;
}

function scrubMetadata(value, depth = 0) {
  if (depth > 5) {
    return "[truncated]";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) =>
      scrubMetadata(item, depth + 1),
    );
  }

  if (typeof value === "object") {
    const output = {};

    for (const [key, item] of Object.entries(value)) {
      if (
        /password|token|authorization|cookie|secret|email/i.test(
          key,
        )
      ) {
        output[key] = "[redacted]";
        continue;
      }

      output[key] = scrubMetadata(item, depth + 1);
    }

    return output;
  }

  return String(value);
}

function getRequestIp(req) {
  if (!req) return "";

  const forwarded = cleanText(req.headers?.["x-forwarded-for"]);

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return cleanText(
    req.ip ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress,
  );
}

function hashIp(ipAddress) {
  const secret = cleanText(process.env.AUDIT_IP_HASH_SECRET);

  if (!ipAddress || !secret) {
    return null;
  }

  return crypto
    .createHmac("sha256", secret)
    .update(ipAddress)
    .digest("hex");
}

async function writeMeetingAuditLog(dbQuery, event = {}) {
  const meetingId = normalizeOptionalId(event.meetingId);
  const bookingId = normalizeOptionalId(event.bookingId);
  const actorUserId = cleanText(event.actorUserId) || null;
  const actorType = normalizeActorType(event.actorType);
  const eventType = normalizeEventType(event.eventType);

  const metadata = scrubMetadata(event.metadata || {});
  const metadataJson = JSON.stringify(metadata);

  if (Buffer.byteLength(metadataJson, "utf8") > 16_000) {
    throw new Error("Audit metadata is too large.");
  }

  const result = await dbQuery(
    `
      INSERT INTO meeting_audit_logs
      (
        meeting_id,
        booking_id,
        actor_user_id,
        actor_type,
        event_type,
        metadata,
        ip_hash
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      meetingId,
      bookingId,
      actorUserId,
      actorType,
      eventType,
      metadataJson,
      hashIp(event.ipAddress),
    ],
  );

  return {
    id: result.insertId,
    meetingId,
    bookingId,
    eventType,
  };
}

/*
 * Business actions must not fail just because audit storage is temporarily
 * unavailable. The error is logged for operations to investigate.
 */
function recordMeetingAudit(dbQuery, event = {}) {
  void writeMeetingAuditLog(dbQuery, event).catch((error) => {
    console.warn(
      "[meeting-audit] Failed to record audit event:",
      error?.message || error,
    );
  });
}

async function getMeetingAuditHistory(
  dbQuery,
  meetingId,
  userId,
  options = {},
) {
  const id = normalizeOptionalId(meetingId);

  if (!id) {
    throw new Error("A meeting ID is required.");
  }

  const limit = Math.min(
    Math.max(Number(options.limit || 100), 1),
    250,
  );

  const ownership = await dbQuery(
    `
      SELECT id
      FROM meeting_schedules
      WHERE id = ?
        AND shedular_user_id = ?
      LIMIT 1
    `,
    [id, userId],
  );

  if (!ownership?.[0]) {
    throw new Error("Meeting not found or access denied.");
  }

  const rows = await dbQuery(
    `
      SELECT
        id,
        meeting_id,
        booking_id,
        actor_user_id,
        actor_type,
        event_type,
        metadata,
        occurred_at
      FROM meeting_audit_logs
      WHERE meeting_id = ?
      ORDER BY occurred_at DESC, id DESC
      LIMIT ?
    `,
    [id, limit],
  );

  return {
    success: true,
    data: (rows || []).map((row) => ({
      ...row,
      id: Number(row.id),
      meeting_id: row.meeting_id ? Number(row.meeting_id) : null,
      booking_id: row.booking_id ? Number(row.booking_id) : null,
      metadata:
        typeof row.metadata === "string"
          ? JSON.parse(row.metadata)
          : row.metadata || {},
    })),
  };
}

module.exports = {
  getRequestIp,
  recordMeetingAudit,
  writeMeetingAuditLog,
  getMeetingAuditHistory,
};