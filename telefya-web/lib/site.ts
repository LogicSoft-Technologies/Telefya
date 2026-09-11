export const siteName = "Telefya";

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://telefya.com"
).replace(/\/+$/, "");

export const defaultTitle =
  "Telefya | Secure Video Meetings, Events & Collaboration";

export const defaultDescription =
  "Telefya gives modern teams secure video meetings, live events, collaboration, recordings, chat, and enterprise controls in one platform.";