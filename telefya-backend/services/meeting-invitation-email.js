const nodemailer = require("nodemailer");
const {
  createMeetingCalendarInvite,
} = require("./meeting-calendar_service");

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

async function sendMeetingInvitationEmail({
  meetingId,
  email,
  hostName,
  meetingUrl,
  meetingTitle,
  scheduledFor,
  durationMinutes,
}) {
  const transporter = await getTransporter();

  const brandName = process.env.SMTP_FROM_NAME || "Telefya";
  const fromEmail =
    process.env.SMTP_FROM_EMAIL || required("SMTP_USER");

  const appUrl =
    process.env.MOBILE_APP_URL ||
    "https://play.google.com/store/apps/details?id=com.telefya.app";

  const calendarAttachment =
    meetingId && scheduledFor
      ? {
          filename: "telefya-meeting.ics",
          content: createMeetingCalendarInvite({
            meeting: {
              id: meetingId,
              des: meetingTitle || "Telefya meeting",
              meeting_url: meetingUrl,
              scheduled_for: scheduledFor,
              duration_minutes: durationMinutes,
            },
            hostName,
            attendeeEmail: email,
          }),
          contentType: "text/calendar; charset=utf-8; method=REQUEST",
        }
      : null;

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

When: ${meetingTime}
Join meeting: ${meetingUrl}

A calendar invitation is attached to this email.

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
              <strong>${escapeHtml(hostName || "A Telefya host")}</strong>
              invited you to
              <strong>${escapeHtml(meetingTitle || "a Telefya meeting")}</strong>.
            </p>
            <p style="padding:16px;background:#f7f9fe;border-radius:12px;color:#475569;">
              ${escapeHtml(meetingTime)}
            </p>
            <a href="${escapeHtml(meetingUrl)}" style="display:block;padding:15px;background:#0F6BFF;border-radius:12px;color:#fff;text-align:center;font-weight:800;text-decoration:none;">
              Join meeting
            </a>
            ${
              calendarAttachment
                ? `<p style="margin:18px 0 0;color:#475569;line-height:1.5;">
                    A calendar invitation is attached. Open it to add the meeting to Google Calendar, Outlook, or Apple Calendar.
                  </p>`
                : ""
            }
            <a href="${escapeHtml(appUrl)}" style="display:block;margin-top:12px;padding:14px;border:1px solid #cbdcf8;border-radius:12px;color:#0F6BFF;text-align:center;font-weight:700;text-decoration:none;">
              Download the Telefya app
            </a>
          </div>
        </div>
      </div>
    `,
    attachments: calendarAttachment ? [calendarAttachment] : [],
  });
}

async function sendMeetingUpdateEmail({
  meetingId,
  email,
  hostName,
  meetingUrl,
  meetingTitle,
  scheduledFor,
  durationMinutes,
  calendarSequence = 1,
}) {
  const transporter = await getTransporter();

  const brandName = process.env.SMTP_FROM_NAME || "Telefya";
  const fromEmail =
    process.env.SMTP_FROM_EMAIL || required("SMTP_USER");

  const calendarAttachment = {
    filename: "telefya-meeting-update.ics",
    content: createMeetingCalendarInvite({
      meeting: {
        id: meetingId,
        des: meetingTitle || "Telefya meeting",
        meeting_url: meetingUrl,
        scheduled_for: scheduledFor,
        duration_minutes: durationMinutes,
      },
      hostName,
      attendeeEmail: email,
      method: "REQUEST",
      sequence: calendarSequence,
    }),
    contentType: "text/calendar; charset=utf-8; method=REQUEST",
  };

  const meetingTime = new Date(scheduledFor).toLocaleString();

  return transporter.sendMail({
    from: `"${brandName}" <${fromEmail}>`,
    to: email,
    subject: `Updated: ${meetingTitle || "Telefya meeting"}`,
    text: `${hostName || "The host"} updated ${
      meetingTitle || "a Telefya meeting"
    }.\n\nNew time: ${meetingTime}\nDuration: ${durationMinutes || 60} minutes\nJoin meeting: ${meetingUrl}\n\nAn updated calendar invitation is attached.`,
    html: `
      <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,sans-serif;color:#071633;">
        <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e2e8f3;border-radius:18px;overflow:hidden;">
          <div style="height:6px;background:linear-gradient(90deg,#7B1CFF,#0F6BFF,#12D8B0);"></div>
          <div style="padding:32px;">
            <div style="font-size:23px;font-weight:800;color:#0F6BFF;">Telefya</div>
            <div style="margin-top:24px;font-size:11px;font-weight:800;letter-spacing:.12em;color:#0F6BFF;">MEETING UPDATED</div>
            <h1 style="margin:10px 0;font-size:28px;">Your meeting details changed</h1>
            <p style="line-height:1.6;color:#475569;">
              <strong>${escapeHtml(hostName || "The host")}</strong>
              updated
              <strong>${escapeHtml(meetingTitle || "this Telefya meeting")}</strong>.
            </p>
            <p style="padding:16px;background:#f7f9fe;border-radius:12px;color:#475569;">
              <strong>New time:</strong> ${escapeHtml(meetingTime)}<br />
              <strong>Duration:</strong> ${escapeHtml(
                `${durationMinutes || 60} minutes`,
              )}
            </p>
            <a href="${escapeHtml(meetingUrl)}" style="display:block;padding:15px;background:#0F6BFF;border-radius:12px;color:#fff;text-align:center;font-weight:800;text-decoration:none;">
              Join meeting
            </a>
            <p style="margin:18px 0 0;color:#475569;line-height:1.5;">
              An updated calendar invitation is attached. Open it to update the event in Google Calendar, Outlook, or Apple Calendar.
            </p>
          </div>
        </div>
      </div>
    `,
    attachments: [calendarAttachment],
  });
}

async function sendMeetingCancellationEmail({
  meetingId,
  email,
  hostName,
  meetingUrl,
  meetingTitle,
  scheduledFor,
  calendarSequence = 0,
}) {
  const transporter = await getTransporter();

  const brandName = process.env.SMTP_FROM_NAME || "Telefya";
  const fromEmail =
    process.env.SMTP_FROM_EMAIL || required("SMTP_USER");

  const calendarAttachment = {
    filename: "telefya-meeting-cancelled.ics",
    content: createMeetingCalendarInvite({
      meeting: {
        id: meetingId,
        des: meetingTitle || "Telefya meeting",
        meeting_url: meetingUrl,
        scheduled_for: scheduledFor,
      },
      hostName,
      attendeeEmail: email,
      method: "CANCEL",
      sequence: calendarSequence,
    }),
    contentType: "text/calendar; charset=utf-8; method=CANCEL",
  };

  return transporter.sendMail({
    from: `"${brandName}" <${fromEmail}>`,
    to: email,
    subject: `Cancelled: ${meetingTitle || "Telefya meeting"}`,
    text: `${hostName || "The host"} cancelled ${
      meetingTitle || "a Telefya meeting"
    }.\n\nThe attached calendar cancellation will remove the event from compatible calendar apps.`,
    html: `
      <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,sans-serif;color:#071633;">
        <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e2e8f3;border-radius:18px;overflow:hidden;">
          <div style="height:6px;background:#ef4444;"></div>
          <div style="padding:32px;">
            <div style="font-size:23px;font-weight:800;color:#0F6BFF;">Telefya</div>
            <div style="margin-top:24px;font-size:11px;font-weight:800;letter-spacing:.12em;color:#dc2626;">MEETING CANCELLED</div>
            <h1 style="margin:10px 0;font-size:28px;">This meeting was cancelled</h1>
            <p style="line-height:1.6;color:#475569;">
              <strong>${escapeHtml(hostName || "The host")}</strong> cancelled
              <strong>${escapeHtml(meetingTitle || "this Telefya meeting")}</strong>.
            </p>
            <p style="line-height:1.6;color:#475569;">
              The attached calendar update removes the event from compatible calendar apps.
            </p>
          </div>
        </div>
      </div>
    `,
    attachments: [calendarAttachment],
  });
}

module.exports = {
  sendMeetingInvitationEmail,
  sendMeetingUpdateEmail,
  sendMeetingCancellationEmail,
  sendGuestMeetingInvitation: sendMeetingInvitationEmail,
};