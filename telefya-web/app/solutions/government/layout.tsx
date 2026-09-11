import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Secure Government Video Conferencing",
  description:
    "Enable secure meetings, public briefings, training, and internal collaboration for government teams and public-sector organizations.",
  path: "/solutions/government",
});

export default function GovernmentSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
