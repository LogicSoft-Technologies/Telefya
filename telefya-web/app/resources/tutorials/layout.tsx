import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Video Collaboration Tutorials",
  description:
    "Learn how to use Telefya meetings, events, recordings, collaboration tools, and workspace features through practical tutorials.",
  path: "/resources/tutorials",
});

export default function TutorialsSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
