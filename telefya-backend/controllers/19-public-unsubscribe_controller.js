const crypto = require("crypto");
const { query } = require("../config/db");

function getUnsubscribeSecret() {
  return (
    process.env.CAMPAIGN_UNSUBSCRIBE_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    ""
  );
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getLogoUrl() {
  return (
    process.env.EMAIL_LOGO_URL ||
    "https://telefya.com/images/telefya-logo.png"
  );
}

function getWebsiteUrl() {
  return (process.env.APP_BASE_URL || "https://telefya.com").replace(
    /\/+$/,
    "",
  );
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 64);
  }

  return String(req.ip || req.socket?.remoteAddress || "")
    .trim()
    .slice(0, 64);
}

function renderPage({ title, message, success }) {
  const logoUrl = escapeHtml(getLogoUrl());
  const websiteUrl = escapeHtml(getWebsiteUrl());
  const accent = success ? "#16a36a" : "#dc2626";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | Telefya</title>
  </head>
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#071633;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;min-height:100vh;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f3;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="height:6px;background:${accent};"></td>
            </tr>
            <tr>
              <td style="padding:34px 34px 18px;">
                <a href="${websiteUrl}" style="display:inline-block;">
                  <img src="${logoUrl}" alt="Telefya" width="146" style="display:block;width:146px;height:auto;border:0;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 34px 38px;">
                <h1 style="margin:0;font-size:25px;line-height:1.25;color:#071633;">
                  ${escapeHtml(title)}
                </h1>
                <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#475569;">
                  ${escapeHtml(message)}
                </p>
                <a href="${websiteUrl}" style="display:inline-block;margin-top:25px;padding:12px 18px;border-radius:10px;background:#0f6bff;color:#fff;text-decoration:none;font-size:14px;font-weight:700;">
                  Go to Telefya
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function readUnsubscribeToken(token) {
  const secret = getUnsubscribeSecret();

  if (!secret) {
    throw new Error(
      "Campaign unsubscribe signing is not configured.",
    );
  }

  if (typeof token !== "string") {
    throw new Error("This unsubscribe link is invalid.");
  }

  const parts = token.split(".");

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("This unsubscribe link is invalid.");
  }

  const [payload, signature] = parts;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");

  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw new Error("This unsubscribe link is invalid.");
  }

  let data;

  try {
    data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
  } catch {
    throw new Error("This unsubscribe link is invalid.");
  }

  const userId = String(data?.userId || "").trim();
  const email = String(data?.email || "")
    .trim()
    .toLowerCase();
  const expiresAt = Number(data?.expiresAt);

  if (
    !userId ||
    !email ||
    !Number.isFinite(expiresAt) ||
    expiresAt < Date.now()
  ) {
    throw new Error("This unsubscribe link has expired.");
  }

  return { userId, email };
}

async function unsubscribe_controller(req, res) {
  const token = String(
    req.query?.token || req.body?.token || "",
  ).trim();

  let subscriber;

  try {
    subscriber = readUnsubscribeToken(token);
  } catch (error) {
    return res.status(400).type("html").send(
      renderPage({
        success: false,
        title: "We could not unsubscribe you",
        message:
          error?.message ||
          "This link is invalid or has expired.",
      }),
    );
  }

  try {
    /*
     * The condition makes this idempotent:
     * a repeated click does not create duplicate consent events.
     */
    const updateResult = await query(
      `
        UPDATE users
        SET
          marketing_opt_in = FALSE,
          marketing_opt_in_at = NULL
        WHERE user_id = ?
          AND LOWER(email) = LOWER(?)
          AND marketing_opt_in = TRUE
      `,
      [subscriber.userId, subscriber.email],
    );

    if (updateResult?.affectedRows > 0) {
      try {
        await query(
          `
            INSERT INTO marketing_consent_events
            (
              user_id,
              email,
              action,
              source,
              ip_address,
              user_agent
            )
            VALUES (?, ?, 'opted_out', ?, ?, ?)
          `,
          [
            subscriber.userId,
            subscriber.email,
            "campaign_unsubscribe",
            getClientIp(req),
            String(req.get("user-agent") || "").slice(0, 512),
          ],
        );
      } catch (auditError) {
        /*
         * Consent has already been safely withdrawn. Audit failure must never
         * cause the user to remain subscribed.
         */
        console.error(
          "[unsubscribe] Consent audit write failed:",
          auditError?.message || auditError,
        );
      }
    }

    return res.status(200).type("html").send(
      renderPage({
        success: true,
        title: "You have been unsubscribed",
        message:
          "You will no longer receive Telefya marketing emails. Transactional emails such as security and account messages are unaffected.",
      }),
    );
  } catch (error) {
    console.error(
      "[unsubscribe] Failed to remove marketing consent:",
      error?.message || error,
    );

    return res.status(500).type("html").send(
      renderPage({
        success: false,
        title: "We could not unsubscribe you",
        message:
          "Please try again shortly. If the problem continues, contact Telefya support.",
      }),
    );
  }
}

module.exports = {
  unsubscribe_controller,
};