"use client";

import Script from "next/script";

interface Props {
  trackingId: string;
}

export default function GoogleAnalytics({ trackingId }: Props) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${trackingId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${trackingId}', { page_path: window.location.pathname });
        `}
      </Script>
    </>
  );
}
