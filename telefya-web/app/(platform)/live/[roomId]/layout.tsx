import type { Metadata } from "next";
import { siteName } from "@/lib/site";

type MeetingLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    roomId: string;
  }>;
};

export async function generateMetadata({
  params,
}: MeetingLayoutProps): Promise<Metadata> {
  const { roomId } = await params;
  const meetingPath = `/live/${encodeURIComponent(roomId)}`;

  const title = "Join a Telefya meeting";
  const description =
    "You have been invited to join a secure Telefya video meeting. Open this link to join the meeting.";

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
          url: "/images/seo/telefya-meeting-og.png",
          width: 1200,
          height: 630,
          alt: "Telefya meeting invitation",
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/seo/telefya-meeting-og.png"],
    },
  };
}

export default function MeetingMetadataLayout({
  children,
}: MeetingLayoutProps) {
  return children;
}