const nodemailer = require("nodemailer");

let transporterPromise = null;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing from .env`);
  }

  return value;
}

function getRecipientName(nameInput) {
  if (!nameInput) return "there";

  if (typeof nameInput === "string") {
    return nameInput.trim() || "there";
  }

  if (typeof nameInput === "object") {
    return (
      [nameInput.firstName, nameInput.lastName]
        .filter(Boolean)
        .join(" ") ||
      nameInput.name ||
      nameInput.email ||
      "there"
    );
  }

  return "there";
}

function getBrandName() {
  return process.env.SMTP_FROM_NAME || "Telefya";
}

function getBrandLogoUrl() {
  /*
   * Email clients cannot access /public or localhost paths.
   * This must be a deployed, public HTTPS image URL.
   */
  return (
    process.env.EMAIL_LOGO_URL ||
    "https://telefya.com/images/telefya-logo.png"
  );
}

function getBrandWebsiteUrl() {
  return (
    process.env.APP_BASE_URL ||
    "https://telefya.com"
  ).replace(/\/+$/, "");
}

async function getTransporter() {
  if (!transporterPromise) {
    const host = required("SMTP_HOST");
    const port = Number(process.env.SMTP_PORT || 465);
    const secure =
      String(process.env.SMTP_SECURE || "true").toLowerCase() ===
      "true";
    const user = required("SMTP_USER");
    const pass = required("SMTP_PASS");

    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
        pool: true,
        maxConnections: 3,
        maxMessages: 50,
      }),
    );
  }

  return transporterPromise;
}

function buildOtpEmail({ otp, recipientName, brandName }) {
  const safeName = escapeHtml(recipientName);
  const safeOtp = escapeHtml(otp);
  const safeBrand = escapeHtml(brandName);
  const safeLogoUrl = escapeHtml(getBrandLogoUrl());
  const safeWebsiteUrl = escapeHtml(getBrandWebsiteUrl());

  const text = `Hello ${recipientName},

Your ${brandName} verification code is ${otp}.

This code expires soon. If you did not request this, you can ignore this email.`;

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>Verify your ${safeBrand} email</title>
  </head>

  <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#071633;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">
      Your ${safeBrand} verification code is ${safeOtp}.
    </span>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #e2e8f3;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="height:6px;background:#0f6bff;background:linear-gradient(90deg,#0f6bff 0%,#6426ff 50%,#22d386 100%);"></td>
            </tr>

            <tr>
              <td style="padding:30px 32px 10px;">
                <a href="${safeWebsiteUrl}" target="_blank" style="display:inline-block;text-decoration:none;">
                  <img
                    src="${safeLogoUrl}"
                    width="146"
                    alt="${safeBrand}"
                    border="0"
                    style="display:block;width:146px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;"
                  />
                </a>

                <div style="margin-top:14px;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#6f7f9d;">
                  Email verification
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 32px 0;">
                <h1 style="margin:0;font-size:28px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;color:#071633;">
                  Verify your email address
                </h1>

                <p style="margin:16px 0 0;font-size:15px;line-height:1.75;color:#475569;">
                  Hello <strong style="color:#071633;">${safeName}</strong>, use the verification code below to finish creating your ${safeBrand} account.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f9fe;border:1px solid #e2e8f3;border-radius:16px;">
                  <tr>
                    <td align="center" style="padding:24px;">
                      <div style="font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#6f7f9d;">
                        Verification code
                      </div>

                      <div style="margin-top:13px;font-size:38px;line-height:1;font-weight:800;letter-spacing:0.20em;color:#0f6bff;">
                        ${safeOtp}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;font-size:14px;line-height:1.8;color:#64748b;">
                  This code expires soon. If you did not create a ${safeBrand} account, you can safely ignore this email.
                </p>

                <div style="margin-top:24px;border-top:1px solid #e2e8f3;padding-top:18px;font-size:12px;line-height:1.7;color:#94a3b8;">
                  Sent by ${safeBrand}. Please do not reply to this automated email.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

async function sendEmailWithOTP(email, otp, nameInput = "there") {
  const transporter = await getTransporter();
  const smtpUser = required("SMTP_USER");

  const brandName = getBrandName();
  const fromEmail = process.env.SMTP_FROM_EMAIL || smtpUser;
  const recipientName = getRecipientName(nameInput);

  const { text, html } = buildOtpEmail({
    otp,
    recipientName,
    brandName,
  });

  const info = await transporter.sendMail({
    from: `"${brandName}" <${fromEmail}>`,
    to: email,
    subject: `Verify your ${brandName} email`,
    text,
    html,
  });

  console.log("[Email] OTP email sent", {
    to: email,
    messageId: info.messageId,
  });

  return info;
}

module.exports = sendEmailWithOTP;