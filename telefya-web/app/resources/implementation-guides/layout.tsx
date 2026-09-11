import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Implementation Guides",
  description:
    "Plan, deploy, configure, and scale Telefya with practical implementation guidance for teams and enterprise workspaces.",
  path: "/resources/implementation-guides",
});

export default function ImplementationGuidesSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
