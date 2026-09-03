"use client";

import { useEffect, useState } from "react";
import GoogleAnalytics from "./GoogleAnalytics";

const CONSENT_STORAGE_KEY = "twd_site_cookie_consent";

type Consent = "granted" | "denied" | null;

function getStoredConsent(): Consent {
  const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

interface Props {
  analyticsId?: string | null;
}

export default function CookieConsentBanner({ analyticsId }: Props) {
  const [consent, setConsent] = useState<Consent>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConsent(getStoredConsent());
    setHydrated(true);
  }, []);

  function choose(value: "granted" | "denied") {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
    setConsent(value);
  }

  return (
    <>
      {analyticsId && consent === "granted" && <GoogleAnalytics trackingId={analyticsId} />}
      {hydrated && consent === null && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: "rgba(15, 23, 42, 0.97)",
            color: "#fff",
            padding: "16px 20px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            fontSize: "14px",
          }}
        >
          <span style={{ maxWidth: "640px" }}>
            This site uses essential cookies to run{analyticsId ? ", plus analytics cookies to understand traffic. You can accept or decline analytics cookies." : "."}
          </span>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => choose("denied")}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.4)",
                background: "transparent",
                color: "#fff",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              {analyticsId ? "Decline" : "Dismiss"}
            </button>
            {analyticsId && (
              <button
                type="button"
                onClick={() => choose("granted")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#fff",
                  color: "#0f172a",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Accept
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
