import type { Metadata } from "next";
import { siteName } from "@/lib/site";

type PageSeo = {
  title: string;
  description: string;
  path: string;
};

export function createPageMetadata({
  title,
  description,
  path,
}: PageSeo): Metadata {
  return {
    title,
    description,

    alternates: {
      canonical: path,
    },

    openGraph: {
      type: "website",
      url: path,
      siteName,
      title,
      description,
      images: [
        {
          url: "/images/seo/telefya-og.png",
          width: 1200,
          height: 630,
          alt: "Telefya — secure video meetings, events, and collaboration",
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/images/seo/telefya-og.png"],
    },
  };
}