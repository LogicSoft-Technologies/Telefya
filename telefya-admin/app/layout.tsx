import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";

import { AppProviders } from "@/providers/AppProviders";

import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Telefya Admin",
    template: "%s | Telefya Admin",
  },
  description: "Telefya platform administration.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={dmSans.variable}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}