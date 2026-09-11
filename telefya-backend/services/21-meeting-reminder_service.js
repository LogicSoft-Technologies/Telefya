const {
  notify_meeting_reminder,
} = require("./20-push-notification_service");

const REMINDER_DEFINITIONS = [
  {
    type: "meeting_reminder_24h",
    minutesUntil: 24 * 60,
  },
  {
    type: "meeting_reminder_1h",
    minutesUntil: 60,
  },
  {
    type: "meeting_reminder_10m",
    minutesUntil: 10,
  },
];

const REMINDER_GRACE_MINUTES = 3;
const WORKER_INTERVAL_MS = 60_000;

let workerTimer = null;
let workerRunning = false;
let cycleRunning = false;

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();

  return text || fallback;
}

async function getReminderMeetings(
  dbQuery,
  minutesUntil,
) {
  return dbQuery(
    `
      SELECT
        id,
        room_id,
        des,
        scheduled_for,
        shedular_user_id
      FROM meeting_schedules
      WHERE status = 'upcoming'
        AND scheduled_for > NOW()
        AND TIMESTAMPDIFF(
          MINUTE,
          NOW(),
          scheduled_for
        ) BETWEEN ? AND ?
      ORDER BY scheduled_for ASC
      LIMIT 100
    `,
    [
      Math.max(0, minutesUntil - REMINDER_GRACE_MINUTES),
      minutesUntil,
    ],
  );
}

async function getMeetingRecipientUserIds(
  dbQuery,
  meetingId,
  hostUserId,
) {
  const rows = await dbQuery(
    `
      SELECT DISTINCT user_id
      FROM (
        SELECT ? AS user_id

        UNION

        SELECT user_id
        FROM meeting_members
        WHERE meeting_id = ?
          AND status IN ('invited', 'accepted')
      ) recipients
      WHERE user_id IS NOT NULL
        AND TRIM(user_id) <> ''
    `,
    [hostUserId, meetingId],
  );

  return rows
    .map((row) => cleanText(row.user_id))
    .filter(Boolean);
}

async function reserveReminderDelivery(
  dbQuery,
  {
    notificationType,
    meetingId,
    targetUserId,
  },
) {
  const referenceKey = [
    notificationType,
    meetingId,
    targetUserId,
  ].join(":");

  const result = await dbQuery(
    `
      INSERT IGNORE INTO meeting_notification_deliveries (
        notification_type,
        meeting_id,
        target_user_id,
        reference_key,
        status
      )
      VALUES (?, ?, ?, ?, 'processing')
    `,
    [
      notificationType,
      meetingId,
      targetUserId,
      referenceKey,
    ],
  );

  return {
    reserved: result.affectedRows === 1,
    referenceKey,
  };
}

async function markReminderDelivery(
  dbQuery,
  referenceKey,
  status,
  errorMessage = null,
) {
  await dbQuery(
    `
      UPDATE meeting_notification_deliveries
      SET
        status = ?,
        error_message = ?,
        sent_at = CASE
          WHEN ? = 'sent' THEN NOW()
          ELSE sent_at
        END
      WHERE reference_key = ?
    `,
    [
      status,
      errorMessage
        ? String(errorMessage).slice(0, 500)
        : null,
      status,
      referenceKey,
    ],
  );
}

async function processReminderDefinition(
  dbQuery,
  definition,
) {
  const meetings = await getReminderMeetings(
    dbQuery,
    definition.minutesUntil,
  );

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const meeting of meetings) {
    const recipients = await getMeetingRecipientUserIds(
      dbQuery,
      meeting.id,
      meeting.shedular_user_id,
    );

    for (const targetUserId of recipients) {
      const reservation = await reserveReminderDelivery(
        dbQuery,
        {
          notificationType: definition.type,
          meetingId: meeting.id,
          targetUserId,
        },
      );

      if (!reservation.reserved) {
        skipped += 1;
        continue;
      }

      try {
        await notify_meeting_reminder({
          userIds: [targetUserId],
          meeting,
          minutesUntil: definition.minutesUntil,
        });

        await markReminderDelivery(
          dbQuery,
          reservation.referenceKey,
          "sent",
        );

        sent += 1;
      } catch (error) {
        await markReminderDelivery(
          dbQuery,
          reservation.referenceKey,
          "failed",
          error?.message || "Push notification delivery failed.",
        );

        failed += 1;

        console.warn(
          "[meeting-reminders] Delivery failed:",
          {
            meetingId: meeting.id,
            targetUserId,
            notificationType: definition.type,
            error: error?.message,
          },
        );
      }
    }
  }

  return {
    notificationType: definition.type,
    sent,
    failed,
    skipped,
  };
}

async function runMeetingReminderCycle(dbQuery) {
  if (cycleRunning) {
    return [];
  }

  cycleRunning = true;

  try {
    const results = [];

    for (const definition of REMINDER_DEFINITIONS) {
      results.push(
        await processReminderDefinition(
          dbQuery,
          definition,
        ),
      );
    }

    return results;
  } catch (error) {
    console.error(
      "[meeting-reminders] Worker cycle failed:",
      error?.message || error,
    );

    return [];
  } finally {
    cycleRunning = false;
  }
}

function startMeetingReminderWorker(dbQuery) {
  if (workerRunning) {
    return;
  }

  workerRunning = true;

  void runMeetingReminderCycle(dbQuery);

  workerTimer = setInterval(() => {
    void runMeetingReminderCycle(dbQuery);
  }, WORKER_INTERVAL_MS);

  console.log(
    "[meeting-reminders] Worker started.",
  );
}

function stopMeetingReminderWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }

  workerRunning = false;
  cycleRunning = false;

  console.log(
    "[meeting-reminders] Worker stopped.",
  );
}

module.exports = {
  startMeetingReminderWorker,
  stopMeetingReminderWorker,
  runMeetingReminderCycle,
};