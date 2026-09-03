import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { getStoredConsent, setStoredConsent, isMarketingSitePath, type CookieConsent } from "@/lib/cookie-consent";

export function CookieConsentBanner() {
  const [location] = useLocation();
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConsent(getStoredConsent());
    setHydrated(true);
  }, []);

  if (!hydrated || consent !== null || !isMarketingSitePath(location)) return null;

  function choose(value: CookieConsent) {
    setStoredConsent(value);
    setConsent(value);
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] border-t border-slate-200 bg-white/95 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          We use essential cookies to run this site, plus anonymous analytics to understand traffic.
          Essential cookies are always on — you can accept or decline analytics. See our{" "}
          <a href="/privacy-policy" className="underline text-primary">Privacy Policy</a>.
        </p>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => choose("denied")}>Decline</Button>
          <Button size="sm" onClick={() => choose("granted")}>Accept</Button>
        </div>
      </div>
    </div>
  );
}
