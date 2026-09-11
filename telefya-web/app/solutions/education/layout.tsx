import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Video Learning & Virtual Classrooms",
  description:
    "Deliver virtual classrooms, lectures, live sessions, recordings, and collaborative learning experiences with Telefya’s video platform.",
  path: "/solutions/education",
});

export default function EducationSeoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
