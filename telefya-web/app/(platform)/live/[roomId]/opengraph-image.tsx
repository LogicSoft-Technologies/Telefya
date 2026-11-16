import { ImageResponse } from "next/og";

import {
  formatMeetingTime,
  getPublicMeetingPreview,
} from "@/lib/server/meeting-preview";
import { siteUrl } from "@/lib/site";

export const alt = "Telefya meeting invitation";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export const revalidate = 60;

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const preview = await getPublicMeetingPreview(roomId);

  const title = preview?.title || "You’re invited to a meeting";
  const meetingTime = preview
    ? formatMeetingTime(
        preview.scheduledFor,
        preview.timeZone,
      )
    : "Open Telefya to view meeting details";

  const status =
    preview?.status === "cancelled"
      ? "MEETING CANCELLED"
      : preview?.status === "live"
        ? "LIVE NOW"
        : "SECURE MEETING INVITATION";

  const statusColor =
    preview?.status === "cancelled"
      ? "#fca5a5"
      : preview?.status === "live"
        ? "#6ee7b7"
        : "#93c5fd";

  const logoUrl = `${siteUrl}/images/telefya-logo.png`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(125deg, #071633 0%, #0F6BFF 52%, #12D8B0 100%)",
          color: "#FFFFFF",
          padding: "64px 72px",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 650,
            height: 650,
            right: -220,
            top: -250,
            borderRadius: 9999,
            background: "rgba(255,255,255,0.10)",
          }}
        />

        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            left: -220,
            bottom: -300,
            borderRadius: 9999,
            background: "rgba(123,28,255,0.48)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 178,
              height: 58,
              alignItems: "center",
            }}
          >
            <img
              src={logoUrl}
              width="178"
              height="58"
              style={{
                objectFit: "contain",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderRadius: 9999,
              padding: "10px 16px",
              background: "rgba(5, 18, 49, 0.40)",
              border: `1px solid ${statusColor}`,
              color: statusColor,
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: 1.3,
            }}
          >
            {status}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 88,
            maxWidth: 900,
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 800,
              color: "#DCEBFF",
              letterSpacing: 2,
            }}
          >
            TELEFYA VIDEO MEETING
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: 62,
              lineHeight: 1.08,
              fontWeight: 900,
              letterSpacing: -2,
            }}
          >
            {title.length > 68
              ? `${title.slice(0, 65)}…`
              : title}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 30,
              padding: "18px 22px",
              borderRadius: 18,
              background: "rgba(5, 18, 49, 0.36)",
              border: "1px solid rgba(255,255,255,0.22)",
              fontSize: 25,
              fontWeight: 700,
              color: "#FFFFFF",
            }}
          >
            {preview?.status === "cancelled"
              ? "This meeting has been cancelled."
              : meetingTime}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "auto",
            zIndex: 1,
            fontSize: 22,
            fontWeight: 800,
            color: "#E6F4FE",
          }}
        >
          Secure video meetings · telefya.com
        </div>
      </div>
    ),
    size,
  );
}