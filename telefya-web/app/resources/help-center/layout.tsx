import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Help Center",
  description:
    "Find practical support, product guidance, troubleshooting resources, and answers for using Telefya effectively.",
  path: "/resources/help-center",
});

export default function HelpCenterSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
