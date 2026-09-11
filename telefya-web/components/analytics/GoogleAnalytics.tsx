"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

type AnalyticsValue = string | number | boolean;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(
  eventName: string,
  parameters: Record<string, AnalyticsValue> = {},
) {
  if (!measurementId || typeof window === "undefined") {
    return;
  }

  window.gtag?.("event", eventName, parameters);
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitialPage = useRef(true);

  const query = searchParams.toString();
  const pagePath = query ? `${pathname}?${query}` : pathname;

  useEffect(() => {
    if (!measurementId || isInitialPage.current) {
      isInitialPage.current = false;
      return;
    }

    trackEvent("page_view", {
      page_path: pagePath,
      page_title: document.title,
    });
  }, [pagePath]);

  if (!measurementId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />

      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag("js", new Date());
          gtag("config", "${measurementId}", {
            send_page_view: true
          });
        `}
      </Script>
    </>
  );
}