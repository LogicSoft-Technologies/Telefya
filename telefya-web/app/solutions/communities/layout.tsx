import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Community Video Events & Collaboration",
  description:
    "Bring communities together with live video events, moderated sessions, collaboration tools, recordings, and accessible online engagement.",
  path: "/solutions/communities",
});

export default function CommunitiesSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
