import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Retail & Ecommerce Video Collaboration",
  description:
    "Connect retail teams with video meetings, training, live product sessions, internal communication, and customer collaboration tools.",
  path: "/solutions/retail-ecommerce",
});

export default function RetailSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
