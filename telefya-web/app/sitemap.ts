import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    {
      url: `${siteUrl}/contact-sales`,
      changeFrequency: "monthly",
      priority: 0.9,
    },

    {
      url: `${siteUrl}/solutions/enterprise`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/solutions/education`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/solutions/healthcare`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/solutions/government`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/solutions/communities`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/solutions/retail-ecommerce`,
      changeFrequency: "monthly",
      priority: 0.8,
    },

    {
      url: `${siteUrl}/resources/security`,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/resources/api-docs`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/resources/help-center`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/resources/implementation-guides`,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${siteUrl}/resources/tutorials`,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${siteUrl}/resources/release-notes`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];
}