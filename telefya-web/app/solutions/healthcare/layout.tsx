import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Secure Healthcare Video Meetings",
  description:
    "Support secure virtual consultations, team meetings, training, and healthcare collaboration with Telefya’s flexible video platform.",
  path: "/solutions/healthcare",
});

export default function HealthcareSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
