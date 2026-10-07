"use client";

import Script from "next/script";

interface Props {
  trackingId: string;
}

// Tenants sometimes paste the whole gtag <script> snippet into the "Google
// Analytics ID" field instead of just the measurement ID. Injecting that raw
// value into an inline script produces malformed JS that breaks page
// hydration, so extract a clean measurement ID before use.
function extractMeasurementId(raw: string): string | null {
  const match = String(raw || "").match(/\b(G-[A-Z0-9]+|AW-[A-Z0-9]+|GT-[A-Z0-9]+|GTM-[A-Z0-9]+|UA-\d+-\d+)\b/i);
  return match ? match[1] : null;
}

export default function GoogleAnalytics({ trackingId }: Props) {
  const measurementId = extractMeasurementId(trackingId);
  if (!measurementId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', { page_path: window.location.pathname });
        `}
      </Script>
    </>
  );
}
