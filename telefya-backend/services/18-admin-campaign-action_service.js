function cleanString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

/*
 * Campaign schedules are stored in UTC. The delivery worker must also use
 * UTC_TIMESTAMP() when checking scheduled_for.
 */
function toMysqlUtcDateTime(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseScheduledFor(value) {
  const input = cleanString(value);

  if (!input) {
    throw new Error("A scheduled delivery time is required.");
  }

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Use a valid scheduled delivery time.");
  }

  if (date.getTime() < Date.now() - 60_000) {
    throw new Error("A campaign cannot be scheduled in the past.");
  }

  return date;
}

async function writeAuditLog(
  db_query,
  adminUserId,
  action,
  {
    targetType = null,
    targetId = null,
    metadata = {},
    ipAddress = null,
  } = {},
) {
  await db_query(
    `
      INSERT INTO admin_audit_logs
      (
        admin_user_id,
        action,
        target_type,
        target_id,
        metadata,
        ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      adminUserId,
      action,
      targetType,
      targetId ? String(targetId) : null,
      JSON.stringify(metadata),
      ipAddress,
    ],
  );
}

async function getCampaign(db_query, campaignId) {
  const rows = await db_query(
    `
      SELECT
        id,
        name,
        subject,
        status,
        scheduled_for,
        total_recipients,
        sent_count,
        failed_count
      FROM admin_mail_campaigns
      WHERE id = ?
      LIMIT 1
    `,
    [campaignId],
  );

  const campaign = rows?.[0];

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  return campaign;
}

async function getRecipientSummary(db_query, campaignId) {
  const rows = await db_query(
    `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(delivery_status = 'queued'), 0) AS queued,
        COALESCE(SUM(delivery_status = 'sent'), 0) AS sent,
        COALESCE(SUM(delivery_status = 'failed'), 0) AS failed
      FROM admin_mail_recipients
      WHERE campaign_id = ?
    `,
    [campaignId],
  );

  return rows?.[0] || {};
}

const queue_admin_campaign_delivery_service = async (
  db_query,
  admin,
  campaignId,
  payload = {},
  context = {},
) => {
  const campaign = await getCampaign(db_query, campaignId);

  if (!["draft", "scheduled"].includes(campaign.status)) {
    throw new Error(
      "Only draft or scheduled campaigns can be prepared for delivery.",
    );
  }

  const deliveryMode = cleanString(
    payload.delivery_mode || "now",
  ).toLowerCase();

  if (!["now", "scheduled"].includes(deliveryMode)) {
    throw new Error("Choose either immediate or scheduled delivery.");
  }

  const recipients = await getRecipientSummary(db_query, campaignId);

  if (!Number(recipients.total)) {
    throw new Error("This campaign has no recipients.");
  }

  if (!Number(recipients.queued)) {
    throw new Error(
      "This campaign has no queued recipients available for delivery.",
    );
  }

  const scheduledFor =
    deliveryMode === "scheduled"
      ? parseScheduledFor(payload.scheduled_for)
      : new Date();

  const scheduledForUtc = toMysqlUtcDateTime(scheduledFor);

  await db_query(
    `
      UPDATE admin_mail_campaigns
      SET
        status = 'scheduled',
        scheduled_for = ?,
        started_at = NULL,
        sent_at = NULL,
        last_error = NULL,
        cancelled_at = NULL
      WHERE id = ?
    `,
    [scheduledForUtc, campaignId],
  );

  await writeAuditLog(
    db_query,
    admin.userId,
    "mail_campaign.delivery_scheduled",
    {
      targetType: "mail_campaign",
      targetId: campaignId,
      metadata: {
        campaign_name: campaign.name,
        delivery_mode: deliveryMode,
        scheduled_for_utc: scheduledForUtc,
        queued_recipients: Number(recipients.queued),
        total_recipients: Number(recipients.total),
      },
      ipAddress: context.ipAddress,
    },
  );

  return {
    success: true,
    message:
      deliveryMode === "now"
        ? "Campaign queued for delivery."
        : "Campaign delivery scheduled.",
    data: {
      id: campaignId,
      status: "scheduled",
      scheduled_for: scheduledForUtc,
      total_recipients: Number(recipients.total),
      queued_recipients: Number(recipients.queued),
    },
  };
};

const cancel_admin_campaign_delivery_service = async (
  db_query,
  admin,
  campaignId,
  context = {},
) => {
  const campaign = await getCampaign(db_query, campaignId);

  if (!["draft", "scheduled"].includes(campaign.status)) {
    throw new Error(
      "Only draft or scheduled campaigns can be cancelled.",
    );
  }

  await db_query(
    `
      UPDATE admin_mail_campaigns
      SET
        status = 'cancelled',
        cancelled_at = UTC_TIMESTAMP(),
        last_error = NULL
      WHERE id = ?
    `,
    [campaignId],
  );

  await writeAuditLog(
    db_query,
    admin.userId,
    "mail_campaign.cancelled",
    {
      targetType: "mail_campaign",
      targetId: campaignId,
      metadata: {
        campaign_name: campaign.name,
        previous_status: campaign.status,
      },
      ipAddress: context.ipAddress,
    },
  );

  return {
    success: true,
    message: "Campaign cancelled.",
    data: {
      id: campaignId,
      status: "cancelled",
    },
  };
};

module.exports = {
  queue_admin_campaign_delivery_service,
  cancel_admin_campaign_delivery_service,
};