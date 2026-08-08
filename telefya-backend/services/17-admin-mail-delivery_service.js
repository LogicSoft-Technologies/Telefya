const crypto = require("crypto");
const nodemailer = require("nodemailer");
const os = require("os");

let transporterPromise = null;
let workerTimer = null;
let workerRunning = false;
let cycleRunning = false;

function cleanString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.min(Math.max(Math.floor(number), min), max);
}

function isDeliveryEnabled() {
  return (
    String(process.env.CAMPAIGN_DELIVERY_ENABLED || "false").toLowerCase() ===
    "true"
  );
}

function getBrandName() {
  return process.env.SMTP_FROM_NAME || "Telefya";
}

function getBrandWebsiteUrl() {
  return (
    process.env.APP_BASE_URL ||
    "https://telefya.com"
  ).replace(/\/+$/, "");
}

function getBrandLogoUrl() {
  /*
   * This is a public web URL, so email clients can load the actual
   * Telefya logo. Do not use localhost or a /public filesystem path.
   */
  return (
    process.env.EMAIL_LOGO_URL ||
    "https://telefya.com/images/telefya-logo.png"
  );
}

function getPublicApiUrl() {
  return (
    process.env.PUBLIC_API_BASE_URL ||
    process.env.BACKEND_URL ||
    "https://api.telefya.com"
  ).replace(/\/+$/, "");
}

function getUnsubscribeSecret() {
  return (
    process.env.CAMPAIGN_UNSUBSCRIBE_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    ""
  );
}

function createUnsubscribeToken({ userId, email }) {
  const secret = getUnsubscribeSecret();

  if (!secret) {
    throw new Error(
      "CAMPAIGN_UNSUBSCRIBE_SECRET or ACCESS_TOKEN_SECRET is required.",
    );
  }

  const payload = Buffer.from(
    JSON.stringify({
      userId: String(userId),
      email: String(email).toLowerCase(),
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    }),
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

function getUnsubscribeUrl(recipient) {
  const token = createUnsubscribeToken({
    userId: recipient.user_id,
    email: recipient.email,
  });

  return `${getPublicApiUrl()}/api/v2/public/unsubscribe?token=${encodeURIComponent(
    token,
  )}`;
}

function getRecipientName(recipient) {
  return (
    [recipient.first_name, recipient.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || recipient.email
  );
}

function replaceTemplateTokens(content, recipient, escapeValues) {
  const firstName = cleanString(recipient.first_name, "there");
  const lastName = cleanString(recipient.last_name);
  const fullName = getRecipientName(recipient);
  const email = cleanString(recipient.email);

  const values = {
    "{{first_name}}": firstName,
    "{{last_name}}": lastName,
    "{{full_name}}": fullName,
    "{{email}}": email,
  };

  return Object.entries(values).reduce((output, [token, value]) => {
    const replacement = escapeValues ? escapeHtml(value) : value;

    return output.split(token).join(replacement);
  }, String(content || ""));
}

function buildCampaignEmail({ campaign, recipient }) {
  const brandName = getBrandName();
  const brandWebsiteUrl = getBrandWebsiteUrl();
  const logoUrl = getBrandLogoUrl();
  const unsubscribeUrl = getUnsubscribeUrl(recipient);

  const bodyHtml = replaceTemplateTokens(
    campaign.html_content,
    recipient,
    true,
  );

  const textContent = replaceTemplateTokens(
    campaign.text_content ||
      `${campaign.subject}\n\n${campaign.html_content.replace(/<[^>]*>/g, " ")}`,
    recipient,
    false,
  );

  const safeBrandName = escapeHtml(brandName);
  const safeWebsiteUrl = escapeHtml(brandWebsiteUrl);
  const safeLogoUrl = escapeHtml(logoUrl);
  const safeSubject = escapeHtml(campaign.subject);
  const safePreheader = escapeHtml(
    campaign.preheader || campaign.subject,
  );
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${safeSubject}</title>
  </head>

  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#071633;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">
      ${safePreheader}
    </span>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e2e8f3;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="height:6px;background:#0f6bff;background:linear-gradient(90deg,#0f6bff 0%,#6426ff 50%,#22d386 100%);"></td>
            </tr>

            <tr>
              <td style="padding:30px 32px 16px;">
                <a href="${safeWebsiteUrl}" target="_blank" style="display:inline-block;text-decoration:none;">
                  <img
                    src="${safeLogoUrl}"
                    width="146"
                    alt="${safeBrandName}"
                    border="0"
                    style="display:block;width:146px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;"
                  />
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:4px 32px 32px;font-size:15px;line-height:1.75;color:#475569;">
                ${bodyHtml}
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px 30px;">
                <div style="border-top:1px solid #e2e8f3;padding-top:18px;font-size:12px;line-height:1.7;color:#94a3b8;">
                  <p style="margin:0;">
                    You are receiving this because you opted in to Telefya product updates and news.
                  </p>

                  <p style="margin:10px 0 0;">
                    <a href="${safeUnsubscribeUrl}" target="_blank" style="color:#0f6bff;font-weight:700;text-decoration:underline;">
                      Unsubscribe from marketing emails
                    </a>
                  </p>

                  <p style="margin:10px 0 0;">
                    &copy; ${new Date().getFullYear()} ${safeBrandName}.
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${textContent}

---
You are receiving this because you opted in to Telefya product updates and news.
Unsubscribe: ${unsubscribeUrl}`;

  return {
    html,
    text,
    unsubscribeUrl,
  };
}

async function getTransporter() {
  if (!transporterPromise) {
    const host = cleanString(process.env.SMTP_HOST);
    const user = cleanString(process.env.SMTP_USER);
    const pass = cleanString(process.env.SMTP_PASS);

    if (!host || !user || !pass) {
      throw new Error(
        "SMTP_HOST, SMTP_USER, and SMTP_PASS are required for campaign delivery.",
      );
    }

    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host,
        port: clampNumber(process.env.SMTP_PORT, 465, 1, 65535),
        secure:
          String(process.env.SMTP_SECURE || "true").toLowerCase() === "true",
        auth: { user, pass },
        pool: true,
        maxConnections: clampNumber(
          process.env.CAMPAIGN_SMTP_CONNECTIONS,
          2,
          1,
          5,
        ),
        maxMessages: 50,
      }),
    );
  }

  return transporterPromise;
}

async function updateCampaignCounts(db_query, campaignId) {
  const rows = await db_query(
    `
      SELECT
        COUNT(*) AS total_recipients,
        COALESCE(SUM(delivery_status = 'sent'), 0) AS sent_count,
        COALESCE(SUM(delivery_status = 'failed'), 0) AS failed_count,
        COALESCE(SUM(delivery_status IN ('queued', 'sending')), 0)
          AS pending_count
      FROM admin_mail_recipients
      WHERE campaign_id = ?
    `,
    [campaignId],
  );

  const counts = rows?.[0] || {};
  const totalRecipients = Number(counts.total_recipients || 0);
  const sentCount = Number(counts.sent_count || 0);
  const failedCount = Number(counts.failed_count || 0);
  const pendingCount = Number(counts.pending_count || 0);

  let status = "sending";

  if (pendingCount === 0) {
    status = sentCount > 0 ? "sent" : "failed";
  }

  await db_query(
    `
      UPDATE admin_mail_campaigns
      SET
        total_recipients = ?,
        sent_count = ?,
        failed_count = ?,
        status = ?,
        sent_at = CASE
          WHEN ? IN ('sent', 'failed') THEN COALESCE(sent_at, UTC_TIMESTAMP())
          ELSE sent_at
        END
      WHERE id = ?
    `,
    [
      totalRecipients,
      sentCount,
      failedCount,
      status,
      status,
      campaignId,
    ],
  );
}

async function recoverStaleRecipientLocks(db_query) {
  await db_query(`
    UPDATE admin_mail_recipients r
    INNER JOIN admin_mail_campaigns c
      ON c.id = r.campaign_id
    SET
      r.delivery_status = 'queued',
      r.locked_at = NULL,
      r.locked_by = NULL,
      r.next_attempt_at = UTC_TIMESTAMP()
    WHERE c.status IN ('scheduled', 'sending')
      AND r.delivery_status = 'sending'
      AND r.locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)
  `);
}

async function activateDueCampaigns(db_query) {
  await db_query(`
    UPDATE admin_mail_campaigns
    SET
      status = 'sending',
      started_at = COALESCE(started_at, UTC_TIMESTAMP()),
      last_error = NULL
    WHERE status = 'scheduled'
      AND scheduled_for IS NOT NULL
      AND scheduled_for <= UTC_TIMESTAMP()
  `);
}

async function claimRecipient(db_query, recipientId, workerId) {
  const result = await db_query(
    `
      UPDATE admin_mail_recipients
      SET
        delivery_status = 'sending',
        locked_at = UTC_TIMESTAMP(),
        locked_by = ?,
        last_attempt_at = UTC_TIMESTAMP(),
        attempt_count = attempt_count + 1
      WHERE id = ?
        AND delivery_status = 'queued'
        AND (
          next_attempt_at IS NULL
          OR next_attempt_at <= UTC_TIMESTAMP()
        )
    `,
    [workerId, recipientId],
  );

  return Boolean(result?.affectedRows);
}

async function deliverRecipient(db_query, campaign, recipient, workerId) {
  const claimed = await claimRecipient(
    db_query,
    recipient.id,
    workerId,
  );

  if (!claimed) return;

  const maxAttempts = clampNumber(
    process.env.CAMPAIGN_MAX_ATTEMPTS,
    3,
    1,
    10,
  );

  const retryDelayMinutes = clampNumber(
    process.env.CAMPAIGN_RETRY_DELAY_MINUTES,
    5,
    1,
    120,
  );

  try {
    const transporter = await getTransporter();
    const smtpUser = cleanString(process.env.SMTP_USER);
    const fromEmail =
      cleanString(process.env.SMTP_FROM_EMAIL) || smtpUser;
    const brandName = getBrandName();

    const email = buildCampaignEmail({
      campaign,
      recipient,
    });

    const info = await transporter.sendMail({
      from: `"${brandName}" <${fromEmail}>`,
      to: recipient.email,
      subject: campaign.subject,
      text: email.text,
      html: email.html,
      headers: {
        "X-Telefya-Campaign": String(campaign.id),
        "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
      },
    });

    await db_query(
      `
        UPDATE admin_mail_recipients
        SET
          delivery_status = 'sent',
          provider_message_id = ?,
          failure_reason = NULL,
          sent_at = UTC_TIMESTAMP(),
          locked_at = NULL,
          locked_by = NULL,
          next_attempt_at = NULL
        WHERE id = ?
          AND locked_by = ?
      `,
      [info.messageId || null, recipient.id, workerId],
    );
  } catch (error) {
    const reason = cleanString(
      error?.message || "SMTP delivery failed.",
    ).slice(0, 500);

    const shouldFailPermanently =
      Number(recipient.attempt_count || 0) + 1 >= maxAttempts;

    await db_query(
      `
        UPDATE admin_mail_recipients
        SET
          delivery_status = ?,
          failure_reason = ?,
          locked_at = NULL,
          locked_by = NULL,
          next_attempt_at = ${
            shouldFailPermanently
              ? "NULL"
              : `DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${retryDelayMinutes} MINUTE)`
          }
        WHERE id = ?
          AND locked_by = ?
      `,
      [
        shouldFailPermanently ? "failed" : "queued",
        reason,
        recipient.id,
        workerId,
      ],
    );

    throw error;
  }
}

async function processCampaign(db_query, campaign, workerId) {
  const batchSize = clampNumber(
    process.env.CAMPAIGN_WORKER_BATCH_SIZE,
    10,
    1,
    50,
  );

  /*
   * Re-check consent at delivery time, not just when the campaign was drafted.
   * A later opt-out is respected immediately.
   */
  const recipients = await db_query(
    `
      SELECT
        r.id,
        r.campaign_id,
        r.user_id,
        r.email,
        r.attempt_count,
        u.first_name,
        u.last_name
      FROM admin_mail_recipients r
      INNER JOIN users u
        ON u.user_id = r.user_id
      WHERE r.campaign_id = ?
        AND r.delivery_status = 'queued'
        AND (
          r.next_attempt_at IS NULL
          OR r.next_attempt_at <= UTC_TIMESTAMP()
        )
        AND u.account_status = 'active'
        AND u.marketing_opt_in = TRUE
      ORDER BY r.id ASC
      LIMIT ?
    `,
    [campaign.id, batchSize],
  );

  for (const recipient of recipients || []) {
    try {
      await deliverRecipient(
        db_query,
        campaign,
        recipient,
        workerId,
      );
    } catch (error) {
      console.error("[campaign-delivery] Recipient failed", {
        campaignId: campaign.id,
        recipientId: recipient.id,
        message: error?.message || error,
      });
    }
  }

  /*
   * Recipients who opted out after the campaign was created must be skipped.
   */
  await db_query(
    `
      UPDATE admin_mail_recipients r
      LEFT JOIN users u
        ON u.user_id = r.user_id
      SET
        r.delivery_status = 'skipped',
        r.failure_reason = 'Recipient is no longer opted in to marketing.',
        r.locked_at = NULL,
        r.locked_by = NULL
      WHERE r.campaign_id = ?
        AND r.delivery_status = 'queued'
        AND (
          u.user_id IS NULL
          OR u.account_status <> 'active'
          OR u.marketing_opt_in <> TRUE
        )
    `,
    [campaign.id],
  );

  await updateCampaignCounts(db_query, campaign.id);
}

async function runAdminMailDeliveryCycle(db_query) {
  if (!isDeliveryEnabled() || cycleRunning) return;

  cycleRunning = true;

  try {
    await recoverStaleRecipientLocks(db_query);
    await activateDueCampaigns(db_query);

    const campaigns = await db_query(`
      SELECT
        id,
        name,
        subject,
        preheader,
        html_content,
        text_content,
        status
      FROM admin_mail_campaigns
      WHERE status = 'sending'
      ORDER BY started_at ASC, id ASC
      LIMIT 5
    `);

    const workerId = `${os.hostname()}:${process.pid}`;

    for (const campaign of campaigns || []) {
      await processCampaign(db_query, campaign, workerId);
    }
  } catch (error) {
    console.error(
      "[campaign-delivery] Worker cycle failed:",
      error?.message || error,
    );
  } finally {
    cycleRunning = false;
  }
}

function startAdminMailDeliveryWorker(db_query) {
  if (workerRunning) return;

  if (!isDeliveryEnabled()) {
    console.log(
      "[campaign-delivery] Disabled. Set CAMPAIGN_DELIVERY_ENABLED=true to enable delivery.",
    );
    return;
  }

  workerRunning = true;

  const intervalMs = clampNumber(
    process.env.CAMPAIGN_WORKER_INTERVAL_MS,
    15_000,
    10_000,
    300_000,
  );

  console.log(
    `[campaign-delivery] Worker started. Checking campaigns every ${intervalMs / 1000}s.`,
  );

  void runAdminMailDeliveryCycle(db_query);

  workerTimer = setInterval(() => {
    void runAdminMailDeliveryCycle(db_query);
  }, intervalMs);
}

function stopAdminMailDeliveryWorker() {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }

  workerRunning = false;
}

module.exports = {
  startAdminMailDeliveryWorker,
  stopAdminMailDeliveryWorker,
  runAdminMailDeliveryCycle,
};