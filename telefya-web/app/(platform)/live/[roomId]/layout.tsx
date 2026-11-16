import type { Metadata } from "next";

import {
  formatMeetingTime,
  getPublicMeetingPreview,
} from "@/lib/server/meeting-preview";
import { siteName } from "@/lib/site";

type MeetingLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    roomId: string;
  }>;
};

export const revalidate = 60;

export async function generateMetadata({
  params,
}: MeetingLayoutProps): Promise<Metadata> {
  const { roomId } = await params;
  const safeRoomId = encodeURIComponent(roomId);
  const meetingPath = `/live/${safeRoomId}`;
  const preview = await getPublicMeetingPreview(roomId);

  const title =
    preview?.title
      ? `${preview.title} | Telefya meeting`
      : "Join a Telefya meeting";

  const meetingTime = preview
    ? formatMeetingTime(
        preview.scheduledFor,
        preview.timeZone,
      )
    : "";

  const description =
    preview?.status === "cancelled"
      ? "This Telefya meeting has been cancelled."
      : preview?.status === "live"
        ? `${preview.title} is live now. Join the secure Telefya meeting.`
        : preview
          ? `${preview.title} is scheduled for ${meetingTime}. Join securely with Telefya.`
          : "You have been invited to join a secure Telefya video meeting.";

  return {
    title,
    description,

    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },

    alternates: {
      canonical: meetingPath,
    },

    openGraph: {
      type: "website",
      url: meetingPath,
      siteName,
      title,
      description,
      images: [
        {
          url: `${meetingPath}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: preview
            ? `${preview.title} — Telefya meeting`
            : "Telefya meeting invitation",
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${meetingPath}/opengraph-image`],
    },
  };
}

export default function MeetingMetadataLayout({
  children,
}: MeetingLayoutProps) {
  return children;
}