const nodemailer = require("nodemailer");

let transporterPromise = null;

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is missing from .env`);
  }

  return value;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: required("SMTP_HOST"),
        port: Number(process.env.SMTP_PORT || 465),
        secure:
          String(process.env.SMTP_SECURE || "true").toLowerCase() ===
          "true",
        auth: {
          user: required("SMTP_USER"),
          pass: required("SMTP_PASS"),
        },
      }),
    );
  }

  return transporterPromise;
}

async function sendGuestMeetingInvitation({
  email,
  hostName,
  meetingUrl,
  meetingTitle,
  scheduledFor,
}) {
  const transporter = await getTransporter();
  const brandName = process.env.SMTP_FROM_NAME || "Telefya";
  const fromEmail =
    process.env.SMTP_FROM_EMAIL || required("SMTP_USER");

  const appUrl =
    process.env.MOBILE_APP_URL ||
    "https://play.google.com/store/apps/details?id=com.telefya.app";

  const safeHostName = escapeHtml(hostName || "A Telefya host");
  const safeTitle = escapeHtml(
    meetingTitle || "a Telefya meeting",
  );
  const safeMeetingUrl = escapeHtml(meetingUrl);
  const safeAppUrl = escapeHtml(appUrl);
  const meetingTime = scheduledFor
    ? new Date(scheduledFor).toLocaleString()
    : "Starting soon";

  return transporter.sendMail({
    from: `"${brandName}" <${fromEmail}>`,
    to: email,
    subject: `${hostName || "Someone"} invited you to a Telefya meeting`,
    text: `${hostName || "A Telefya host"} invited you to ${
      meetingTitle || "a Telefya meeting"
    }.

Join meeting: ${meetingUrl}

Download Telefya: ${appUrl}`,
    html: `
      <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,sans-serif;color:#071633;">
        <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e2e8f3;border-radius:18px;overflow:hidden;">
          <div style="height:6px;background:linear-gradient(90deg,#7B1CFF,#0F6BFF,#12D8B0);"></div>
          <div style="padding:32px;">
            <div style="font-size:23px;font-weight:800;color:#0F6BFF;">Telefya</div>
            <div style="margin-top:24px;font-size:11px;font-weight:800;letter-spacing:.12em;color:#0F6BFF;">MEETING INVITATION</div>
            <h1 style="margin:10px 0;font-size:28px;">You’re invited to a meeting</h1>
            <p style="line-height:1.6;color:#475569;">
              <strong>${safeHostName}</strong> invited you to
              <strong>${safeTitle}</strong>.
            </p>
            <p style="padding:16px;background:#f7f9fe;border-radius:12px;color:#475569;">
              ${escapeHtml(meetingTime)}
            </p>
            <a href="${safeMeetingUrl}" style="display:block;padding:15px;background:#0F6BFF;border-radius:12px;color:#fff;text-align:center;font-weight:800;text-decoration:none;">
              Join meeting
            </a>
            <a href="${safeAppUrl}" style="display:block;margin-top:12px;padding:14px;border:1px solid #cbdcf8;border-radius:12px;color:#0F6BFF;text-align:center;font-weight:700;text-decoration:none;">
              Download the Telefya app
            </a>
          </div>
        </div>
      </div>
    `,
  });
}

module.exports = {
  sendGuestMeetingInvitation,
};