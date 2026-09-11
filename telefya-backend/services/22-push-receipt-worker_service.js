const { query } = require("../config/db");

const EXPO_RECEIPTS_URL =
  "https://exp.host/--/api/v2/push/getReceipts";

const MAX_RECEIPTS_PER_BATCH = 1000;
const WORKER_INTERVAL_MS = 5 * 60 * 1000;
const MAX_RECEIPT_ATTEMPTS = 4;

let workerTimer = null;
let workerRunning = false;
let cycleRunning = false;

function chunk(items, size) {
  const result = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

async function markTicketDelivered(ticketId) {
  await query(
    `
      UPDATE push_notification_tickets
      SET
        status = 'delivered',
        checked_at = NOW(),
        delivered_at = NOW(),
        error_code = NULL,
        error_message = NULL
      WHERE expo_ticket_id = ?
    `,
    [ticketId],
  );
}

async function markTicketFailed(
  ticketId,
  errorCode,
  errorMessage,
) {
  await query(
    `
      UPDATE push_notification_tickets
      SET
        status = 'failed',
        checked_at = NOW(),
        error_code = ?,
        error_message = ?
      WHERE expo_ticket_id = ?
    `,
    [
      String(errorCode ?? "UNKNOWN").slice(0, 120),
      String(errorMessage ?? "Push receipt failed.").slice(
        0,
        500,
      ),
      ticketId,
    ],
  );
}

async function postponeTicket(ticketId) {
  await query(
    `
      UPDATE push_notification_tickets
      SET
        attempt_count = attempt_count + 1,
        checked_at = NOW(),
        next_check_at = DATE_ADD(
          NOW(),
          INTERVAL 15 MINUTE
        )
      WHERE expo_ticket_id = ?
        AND attempt_count < ?
    `,
    [ticketId, MAX_RECEIPT_ATTEMPTS],
  );

  await query(
    `
      UPDATE push_notification_tickets
      SET
        status = 'failed',
        checked_at = NOW(),
        error_code = 'RECEIPT_TIMEOUT',
        error_message =
          'Expo did not provide a delivery receipt in time.'
      WHERE expo_ticket_id = ?
        AND attempt_count >= ?
    `,
    [ticketId, MAX_RECEIPT_ATTEMPTS],
  );
}

async function disablePushToken(token) {
  await query(
    `
      UPDATE user_push_devices
      SET enabled = FALSE
      WHERE expo_push_token = ?
    `,
    [token],
  );
}

async function getPendingTickets() {
  return query(
    `
      SELECT
        expo_ticket_id,
        expo_push_token
      FROM push_notification_tickets
      WHERE status = 'accepted'
        AND next_check_at <= NOW()
      ORDER BY next_check_at ASC
      LIMIT 1000
    `,
  );
}

async function processReceiptBatch(batch) {
  const ids = batch.map(
    (ticket) => ticket.expo_ticket_id,
  );

  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });

  const payload = await response.json();

  if (!response.ok || !payload?.data) {
    throw new Error(
      payload?.errors?.[0]?.message ||
        "Expo Push Service rejected the receipt request.",
    );
  }

  for (const ticket of batch) {
    const receipt = payload.data[ticket.expo_ticket_id];

    if (!receipt) {
      await postponeTicket(ticket.expo_ticket_id);
      continue;
    }

    if (receipt.status === "ok") {
      await markTicketDelivered(ticket.expo_ticket_id);
      continue;
    }

    const errorCode =
      receipt?.details?.error || "EXPO_RECEIPT_ERROR";

    await markTicketFailed(
      ticket.expo_ticket_id,
      errorCode,
      receipt?.message,
    );

    if (errorCode === "DeviceNotRegistered") {
      await disablePushToken(ticket.expo_push_token);
    }

    console.warn("[push-receipts] Delivery failed:", {
      ticketId: ticket.expo_ticket_id,
      errorCode,
      message: receipt?.message,
    });
  }
}

async function runPushReceiptCycle() {
  if (cycleRunning) {
    return;
  }

  cycleRunning = true;

  try {
    const tickets = await getPendingTickets();

    for (const batch of chunk(
      tickets,
      MAX_RECEIPTS_PER_BATCH,
    )) {
      try {
        await processReceiptBatch(batch);
      } catch (error) {
        console.error(
          "[push-receipts] Batch processing failed:",
          error?.message || error,
        );
      }
    }
  } finally {
    cycleRunning = false;
  }
}

function startPushReceiptWorker() {
  if (workerRunning) {
    return;
  }

  workerRunning = true;

  void runPushReceiptCycle();

  workerTimer = setInterval(() => {
    void runPushReceiptCycle();
  }, WORKER_INTERVAL_MS);

  console.log("[push-receipts] Worker started.");
}

function stopPushReceiptWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }

  workerRunning = false;
  cycleRunning = false;

  console.log("[push-receipts] Worker stopped.");
}

module.exports = {
  startPushReceiptWorker,
  stopPushReceiptWorker,
  runPushReceiptCycle,
};