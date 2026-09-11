import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Release Notes",
  description:
    "Stay up to date with Telefya product improvements, new collaboration capabilities, platform updates, and released features.",
  path: "/resources/release-notes",
});

export default function ReleaseNotesSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
