"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE_URL || "https://tradeworkdesk-api.fly.dev"
    : "https://tradeworkdesk-api.fly.dev";

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    areas?: string[];
    body_text?: string;
    phone?: string;
    email?: string;
    tenant_id?: string;
    booking_url?: string;
    contact_url?: string;
    cta_text?: string;
    cta_url?: string;
    website_id?: string;
    accent_color?: string;
    background_color?: string;
    outer_background?: string;
  } & Record<string, unknown>;
}

export default function AreasBlock({ content }: Props) {
  const {
    heading = "Areas We Cover",
    subheading,
    label,
    areas = [],
    body_text,
    phone,
    email,
    tenant_id,
    booking_url,
    contact_url,
    cta_text,
    cta_url,
    website_id,
    accent_color = "#0d9488",
    background_color = "#0d9488",
    outer_background = "#f9fafb",
  } = content;

  const [postcode, setPostcode] = useState("");
  const [checking, setChecking] = useState(false);
  const [coverage, setCoverage] = useState<{ covered: boolean | null; reason?: string | null; distance_miles?: number; radius_miles?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingAvailable, setBookingAvailable] = useState(false);

  const isTealCard = background_color.startsWith("#0") || background_color.startsWith("#1") || background_color === "#0d9488";
  const cardText = isTealCard ? "#ffffff" : "#111827";
  const cardSubText = isTealCard ? "rgba(255,255,255,0.82)" : "#6b7280";
  const pillBg = isTealCard ? "rgba(255,255,255,0.18)" : "#f3f4f6";
  const pillText = isTealCard ? "#ffffff" : "#374151";
  const ctaBg = isTealCard ? "#ffffff" : accent_color;
  const ctaColor = isTealCard ? accent_color : "#ffffff";

  const hasChecker = useMemo(() => Boolean(website_id), [website_id]);
  const canShowCoveredActions = Boolean(coverage?.covered);
  const contactHref = contact_url || cta_url || "#contact";
  const bookingHref = booking_url || "/booking";

  useEffect(() => {
    if (!canShowCoveredActions || !tenant_id) {
      setBookingAvailable(false);
      return;
    }

    let active = true;
    fetch(`${API_BASE}/api/public/booking/${tenant_id}/services`)
      .then(async (r) => {
        if (!r.ok) return [] as Array<Record<string, unknown>>;
        return (await r.json()) as Array<Record<string, unknown>>;
      })
      .then((services) => {
        if (active) setBookingAvailable(Array.isArray(services) && services.length > 0);
      })
      .catch(() => {
        if (active) setBookingAvailable(false);
      });

    return () => {
      active = false;
    };
  }, [canShowCoveredActions, tenant_id]);

  const checkPostcode = async () => {
    const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, "");
    if (!cleaned) {
      setError("Enter a postcode to check coverage.");
      setCoverage(null);
      return;
    }

    if (!website_id) {
      setError("Coverage check is unavailable for this site.");
      return;
    }

    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/postcode-coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: website_id, postcode: cleaned }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error((data as { error?: string }).error || "Failed to check postcode.");
      }
      setCoverage(data as typeof coverage);
    } catch (err) {
      setCoverage(null);
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <section style={{ padding: "72px 24px", backgroundColor: outer_background }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ backgroundColor: background_color, borderRadius: 16, padding: "52px 48px", textAlign: "center" }}>
          {label && (
            <p style={{ color: isTealCard ? "rgba(255,255,255,0.7)" : accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              {label}
            </p>
          )}
          <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, margin: "0 0 12px", color: cardText }}>{heading}</h2>
          {subheading && <p style={{ color: cardSubText, fontSize: "1.0625rem", marginBottom: 8, maxWidth: 560, margin: "0 auto 16px" }}>{subheading}</p>}
          {body_text && <p style={{ color: cardSubText, lineHeight: 1.7, fontSize: "0.9375rem", marginBottom: 28, maxWidth: 560, margin: "0 auto 28px" }}>{body_text}</p>}

          {(areas as string[]).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 32 }}>
              {(areas as string[]).map((area, i) => (
                <span key={i} style={{ display: "inline-block", backgroundColor: pillBg, borderRadius: 20, padding: "6px 18px", fontSize: "0.9rem", color: pillText, fontWeight: 500 }}>
                  {area}
                </span>
              ))}
            </div>
          )}

          {phone && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} style={{ display: "inline-block", color: cardText, fontWeight: 700, textDecoration: "none", fontSize: "1rem", marginBottom: 20 }}>
              📞 {phone}
            </a>
          )}

          <div id="postcode-checker" style={{ marginTop: 28, paddingTop: 24, borderTop: isTealCard ? "1px solid rgba(255,255,255,0.14)" : "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <input
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="Enter your postcode"
                aria-label="Postcode"
                style={{
                  minWidth: 220,
                  flex: "1 1 240px",
                  maxWidth: 320,
                  borderRadius: 10,
                  border: `1px solid ${isTealCard ? "rgba(255,255,255,0.22)" : "#d1d5db"}`,
                  background: isTealCard ? "rgba(255,255,255,0.08)" : "#ffffff",
                  color: cardText,
                  padding: "12px 14px",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={checkPostcode}
                disabled={checking}
                style={{
                  border: 0,
                  borderRadius: 10,
                  padding: "12px 18px",
                  backgroundColor: ctaBg,
                  color: ctaColor,
                  fontWeight: 700,
                  cursor: checking ? "wait" : "pointer",
                }}
              >
                {checking ? "Checking…" : "Check postcode"}
              </button>
            </div>

            {error && <p style={{ marginTop: 12, color: "#ef4444", fontSize: "0.9375rem" }}>{error}</p>}

            {coverage && coverage.covered !== null && (
              <p style={{ marginTop: 12, color: cardSubText, fontSize: "0.9375rem" }}>
                {coverage.covered ? "This postcode looks covered." : "This postcode is outside the current service area."}
                {typeof coverage.distance_miles === "number" && typeof coverage.radius_miles === "number" && (
                  <span> {coverage.distance_miles} miles away from the centre, with a {coverage.radius_miles} mile radius.</span>
                )}
              </p>
            )}

            {canShowCoveredActions && (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 10,
                  padding: "14px 16px",
                  background: isTealCard ? "rgba(16,185,129,0.18)" : "#ecfdf5",
                  border: isTealCard ? "1px solid rgba(16,185,129,0.35)" : "1px solid #86efac",
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, color: cardText, fontSize: "0.95rem" }}>
                  Great news, we can help in your area.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
                  {phone && (
                    <a
                      href={`tel:${phone.replace(/\s/g, "")}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "0.86rem",
                        background: ctaBg,
                        color: ctaColor,
                      }}
                    >
                      Call {phone}
                    </a>
                  )}
                  {email && (
                    <a
                      href={`mailto:${email}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "0.86rem",
                        background: ctaBg,
                        color: ctaColor,
                      }}
                    >
                      Email us
                    </a>
                  )}
                  <a
                    href={contactHref}
                    style={{
                      display: "inline-block",
                      padding: "8px 12px",
                      borderRadius: 8,
                      textDecoration: "none",
                      fontWeight: 700,
                      fontSize: "0.86rem",
                      background: ctaBg,
                      color: ctaColor,
                    }}
                  >
                    Contact form
                  </a>
                  {bookingAvailable && (
                    <a
                      href={bookingHref}
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "0.86rem",
                        background: ctaBg,
                        color: ctaColor,
                      }}
                    >
                      Book online
                    </a>
                  )}
                </div>
              </div>
            )}

            {coverage && coverage.covered === null && coverage.reason && (
              <p style={{ marginTop: 12, color: cardSubText, fontSize: "0.9375rem" }}>{coverage.reason}</p>
            )}

            {!hasChecker && !coverage && (
              <p style={{ marginTop: 12, color: cardSubText, fontSize: "0.9375rem" }}>Add a postcode radius in admin to enable live postcode checks.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
