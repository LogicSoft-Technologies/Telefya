import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Telefya",
    short_name: "Telefya",
    description:
      "Secure video meetings, live events, recordings, collaboration, and enterprise communication by Telefya.",

    start_url: "/",
    display: "standalone",
    background_color: "#020618",
    theme_color: "#0F6BFF",

    icons: [
      {
        src: "/icons/telefya-og.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/telefya-og.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}