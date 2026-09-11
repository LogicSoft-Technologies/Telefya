import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "API Documentation",
  description:
    "Explore Telefya API documentation, integration guidance, platform capabilities, and resources for building connected video experiences.",
  path: "/resources/api-docs",
});

export default function ApiDocsSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
