import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Security Center",
  description:
    "Learn how Telefya approaches identity, access controls, data protection, administrative permissions, and reliable video infrastructure.",
  path: "/resources/security",
});

export default function SecuritySeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
