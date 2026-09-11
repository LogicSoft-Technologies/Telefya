import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Enterprise Video Collaboration Platform",
  description:
    "Run secure meetings, live events, recordings, collaboration, and organization-wide communication from one enterprise-ready Telefya workspace.",
  path: "/solutions/enterprise",
});

export default function EnterpriseSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
