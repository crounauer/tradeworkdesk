"use client";

import { useEffect, useState } from "react";
import { isModernTemplateContent } from "@/lib/siteTheme";

const API_BASE =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE_URL || "https://tradeworkdesk-api.fly.dev"
    : "https://tradeworkdesk-api.fly.dev";

type AreaItem = string | { href?: string; name?: string; label?: string };

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    areas?: AreaItem[];
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
  const [postcode, setPostcode] = useState("");
  const [checking, setChecking] = useState(false);
  const [coverage, setCoverage] = useState<{ covered: boolean | null; reason?: string | null; distance_miles?: number; radius_miles?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingAvailable, setBookingAvailable] = useState(false);

  const isModernTradePayload = isModernTemplateContent(content);

  const heading = String(content.heading || content.title || "Areas We Cover");
  const subheading = String(content.subheading || content.subtitle || "");
  const label = String(content.label || content.eyebrow || "");
  const bodyText = String(content.body_text || "");
  const ctaText = String(content.cta_text || content.primaryCtaLabel || content.primaryButtonText || "Contact us");
  const ctaUrl = String(content.cta_url || content.primaryCtaHref || content.primaryButtonUrl || "#contact");

  const sectionBg = String(content.section_bg || content.outer_background || (isModernTradePayload ? "#f8fafc" : "#f9fafb"));
  const cardBg = String(content.card_bg || content.background_color || (isModernTradePayload ? "#ffffff" : "#0d9488"));
  const accentColor = String(content.accent_color || "#0d9488");
  const borderColor = String(content.border_color || (isModernTradePayload ? "#e2e8f0" : "rgba(255,255,255,0.2)"));
  const headingColor = String(content.heading_color || (cardBg.startsWith("#0") || cardBg.startsWith("#1") ? "#ffffff" : "#111827"));
  const bodyColor = String(content.body_color || (cardBg.startsWith("#0") || cardBg.startsWith("#1") ? "rgba(255,255,255,0.82)" : "#6b7280"));
  const chipBg = String(content.chip_bg || (cardBg.startsWith("#0") || cardBg.startsWith("#1") ? "rgba(255,255,255,0.18)" : "#f3f4f6"));
  const chipText = String(content.chip_text_color || (cardBg.startsWith("#0") || cardBg.startsWith("#1") ? "#ffffff" : "#374151"));

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const buttonFont = String(content.button_font_family || content.global_button_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.75rem, 3vw, 2.25rem)");
  const bodySize = String(content.body_size || "1rem");

  const layout = String(content.layout_variant || content.layout || "pill-cloud").toLowerCase();
  const radius = String(content.card_radius || "16px");
  const paddingY = String(content.padding_y || "72px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "960px");

  const areaItems = (Array.isArray(content.areas) ? content.areas : []) as AreaItem[];
  const phone = String(content.phone || "");
  const email = String(content.email || "");
  const tenantId = String(content.tenant_id || "");
  const bookingUrl = String(content.booking_url || "/booking");
  const contactUrl = String(content.contact_url || ctaUrl || "#contact");
  const websiteId = String(content.website_id || "");

  const canShowCoveredActions = Boolean(coverage?.covered);

  useEffect(() => {
    if (!canShowCoveredActions || !tenantId) {
      setBookingAvailable(false);
      return;
    }

    let active = true;
    fetch(`${API_BASE}/api/public/booking/${tenantId}/services`)
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
  }, [canShowCoveredActions, tenantId]);

  const checkPostcode = async () => {
    const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, "");
    if (!cleaned) {
      setError("Enter a postcode to check coverage.");
      setCoverage(null);
      return;
    }

    if (!websiteId) {
      setError("Coverage check is unavailable for this site.");
      return;
    }

    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/postcode-coverage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId, postcode: cleaned }),
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

  const renderArea = (area: AreaItem, i: number) => {
    const areaLabel = typeof area === "string" ? area : area.name || area.label || "";
    const areaHref = typeof area === "string" ? undefined : area.href;

    if (layout === "card-grid") {
      const tile = (
        <span style={{ display: "block", borderRadius: 10, border: `1px solid ${borderColor}`, backgroundColor: cardBg, padding: "12px 14px", color: headingColor, fontWeight: 700, fontSize: "0.95rem", fontFamily: bodyFont }}>
          {areaLabel}
        </span>
      );
      return areaHref ? (
        <a key={i} href={areaHref} style={{ textDecoration: "none" }}>
          {tile}
        </a>
      ) : (
        <div key={i}>{tile}</div>
      );
    }

    if (layout === "minimal-list") {
      return (
        <li key={i} style={{ borderBottom: `1px solid ${borderColor}`, padding: "10px 0", color: bodyColor, fontFamily: bodyFont }}>
          {areaHref ? (
            <a href={areaHref} style={{ color: bodyColor, textDecoration: "none" }}>
              {areaLabel}
            </a>
          ) : (
            areaLabel
          )}
        </li>
      );
    }

    const chip = (
      <span style={{ display: "inline-block", backgroundColor: chipBg, borderRadius: 20, padding: "6px 18px", fontSize: "0.9rem", color: chipText, fontWeight: 500, fontFamily: bodyFont }}>
        {areaLabel}
      </span>
    );
    return areaHref ? (
      <a key={i} href={areaHref} style={{ textDecoration: "none" }}>
        {chip}
      </a>
    ) : (
      <span key={i}>{chip}</span>
    );
  };

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, backgroundColor: sectionBg }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        <div style={{ backgroundColor: cardBg, borderRadius: radius, padding: "44px 34px", border: `1px solid ${borderColor}` }}>
          <div style={{ textAlign: layout === "split-columns" ? "left" : "center", marginBottom: 22 }}>
            {label ? (
              <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: bodyFont }}>
                {label}
              </p>
            ) : null}
            <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 12px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
            {subheading ? <p style={{ color: bodyColor, fontSize: bodySize, margin: "0 0 8px", fontFamily: bodyFont }}>{subheading}</p> : null}
            {bodyText ? <p style={{ color: bodyColor, lineHeight: 1.7, fontSize: "0.95rem", margin: "0", fontFamily: bodyFont }}>{bodyText}</p> : null}
          </div>

          {areaItems.length > 0 && layout === "split-columns" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
              <div>
                <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: "1rem", fontWeight: 700, fontFamily: headingFont }}>Primary Coverage</h3>
                <div style={{ display: "grid", gap: 8 }}>{areaItems.filter((_, idx) => idx % 2 === 0).map((a, i) => renderArea(a, i))}</div>
              </div>
              <div>
                <h3 style={{ margin: "0 0 8px", color: headingColor, fontSize: "1rem", fontWeight: 700, fontFamily: headingFont }}>Nearby Locations</h3>
                <div style={{ display: "grid", gap: 8 }}>{areaItems.filter((_, idx) => idx % 2 === 1).map((a, i) => renderArea(a, i + 1000))}</div>
              </div>
            </div>
          ) : null}

          {areaItems.length > 0 && layout === "card-grid" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 24 }}>
              {areaItems.map((a, i) => renderArea(a, i))}
            </div>
          ) : null}

          {areaItems.length > 0 && layout === "minimal-list" ? (
            <ul style={{ listStyle: "none", margin: "0 0 24px", padding: 0 }}>{areaItems.map((a, i) => renderArea(a, i))}</ul>
          ) : null}

          {areaItems.length > 0 && (layout === "pill-cloud" || (!layout || !["split-columns", "card-grid", "minimal-list"].includes(layout))) ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 24 }}>
              {areaItems.map((a, i) => renderArea(a, i))}
            </div>
          ) : null}

          <div id="postcode-checker" style={{ marginTop: 10, paddingTop: 18, borderTop: `1px solid ${borderColor}` }}>
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
                  border: `1px solid ${borderColor}`,
                  background: "#ffffff",
                  color: headingColor,
                  padding: "12px 14px",
                  outline: "none",
                  fontFamily: bodyFont,
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
                  backgroundColor: accentColor,
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor: checking ? "wait" : "pointer",
                  fontFamily: buttonFont,
                }}
              >
                {checking ? "Checking..." : "Check postcode"}
              </button>
            </div>

            {error ? <p style={{ marginTop: 12, color: "#ef4444", fontSize: "0.9375rem", fontFamily: bodyFont }}>{error}</p> : null}

            {coverage && coverage.covered !== null ? (
              <p style={{ marginTop: 12, color: bodyColor, fontSize: "0.9375rem", fontFamily: bodyFont }}>
                {coverage.covered ? "This postcode looks covered." : "This postcode is outside the current service area."}
                {typeof coverage.distance_miles === "number" && typeof coverage.radius_miles === "number" ? (
                  <span> {coverage.distance_miles} miles away from the centre, with a {coverage.radius_miles} mile radius.</span>
                ) : null}
              </p>
            ) : null}

            {canShowCoveredActions ? (
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 10,
                  padding: "14px 16px",
                  background: "#ecfdf5",
                  border: "1px solid #86efac",
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, color: headingColor, fontSize: "0.95rem", fontFamily: headingFont }}>
                  Great news, we can help in your area.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 10 }}>
                  {phone ? (
                    <a
                      href={`tel:${phone.replace(/\s/g, "")}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "0.86rem",
                        background: accentColor,
                        color: "#ffffff",
                        fontFamily: buttonFont,
                      }}
                    >
                      Call {phone}
                    </a>
                  ) : null}
                  {email ? (
                    <a
                      href={`mailto:${email}`}
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "0.86rem",
                        background: accentColor,
                        color: "#ffffff",
                        fontFamily: buttonFont,
                      }}
                    >
                      Email us
                    </a>
                  ) : null}
                  {bookingAvailable ? (
                    <a
                      href={bookingUrl}
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "0.86rem",
                        background: accentColor,
                        color: "#ffffff",
                        fontFamily: buttonFont,
                      }}
                    >
                      Book online
                    </a>
                  ) : (
                    <a
                      href={contactUrl}
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "0.86rem",
                        background: accentColor,
                        color: "#ffffff",
                        fontFamily: buttonFont,
                      }}
                    >
                      {ctaText}
                    </a>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
