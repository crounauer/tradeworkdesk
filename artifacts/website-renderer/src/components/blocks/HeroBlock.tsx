"use client";

import { isModernTemplateContent } from "@/lib/siteTheme";

interface Stat {
  value: string;
  label: string;
}

interface Badge {
  label: string;
  icon?: string;
}

interface TrustItem {
  text: string;
  icon?: string;
}

interface Props {
  content: {
    heading?: string;
    title?: string;
    eyebrow?: string;
    heading_accent?: string;
    subheading?: string;
    subtitle?: string;
    cta_text?: string;
    primaryCtaLabel?: string;
    primaryCtaHref?: string;
    cta_url?: string;
    cta_phone?: string;
    secondary_cta_text?: string;
    secondaryCtaLabel?: string;
    secondaryCtaHref?: string;
    secondary_cta_url?: string;
    background_image_url?: string;
    background_color?: string;
    text_color?: string;
    align?: "left" | "center" | "right";
    layout?: "full" | "centered" | "split";
    variant?: "default" | "modern" | "classic";
    heroStyle?: "default" | "modern" | "classic";
    tone?: "default" | "navy" | "light";
    density?: "compact" | "normal" | "comfortable";
    ctaStyle?: "default" | "rounded" | "soft" | "outline";
    hero_image_url?: string;
    accent_color?: string;
    badges?: Badge[];
    trust_items?: TrustItem[];
    stats?: Stat[];
    emergency_text?: string;
    emergency_phone?: string;
    min_height?: string;
    overlay_opacity?: number;
  } & Record<string, unknown>;
}

export default function HeroBlock({ content }: Props) {
  const isModernTradePayload = isModernTemplateContent(content)
    || content.variant === "modern"
    || content.heroStyle === "modern";
  const heading = (content.heading || content.title) as string | undefined;
  const subheading = (content.subheading || content.subtitle) as string | undefined;
  const ctaText = (content.cta_text || content.primaryCtaLabel) as string | undefined;
  const ctaUrl = (content.cta_url || content.primaryCtaHref) as string | undefined;
  const secondaryCtaText = (content.secondary_cta_text || content.secondaryCtaLabel) as string | undefined;
  const secondaryCtaUrl = (content.secondary_cta_url || content.secondaryCtaHref) as string | undefined;

  const {
    heading_accent,
    cta_phone,
    background_image_url,
    background_color,
    text_color,
    align = "left",
    layout = "full",
    variant = "default",
    heroStyle = "default",
    tone = "default",
    density = "normal",
    ctaStyle = "default",
    hero_image_url,
    accent_color = "#f97316",
    primary_color = "#1c2942",
    primary_text_color = "#ffffff",
    muted_background_color = "#f8fafc",
    border_color = "#d1d5db",
    muted_text_color = "#64748b",
    badges = [],
    trust_items = [],
    stats = [],
    emergency_text,
    emergency_phone,
    min_height = "500px",
    overlay_opacity = 0.55,
  } = content;

  const isPostcodeCta = (ctaText || "").toLowerCase().includes("postcode");
  const primaryHref = cta_phone
    ? `tel:${cta_phone.replace(/\s/g, "")}`
    : (isPostcodeCta ? "#postcode-checker" : (ctaUrl || "#contact"));
  const primaryLabel = ctaText || (cta_phone ? `Call Now: ${cta_phone}` : "Get a Quote");

  const modernHeroImageUrl = hero_image_url || background_image_url;
  const accentColor = typeof accent_color === "string" ? accent_color : "#f97316";
  const primaryColorToken = typeof primary_color === "string" ? primary_color : "#1c2942";
  const primaryTextColorToken = typeof primary_text_color === "string" ? primary_text_color : "#ffffff";
  const mutedBackgroundColorToken = typeof muted_background_color === "string" ? muted_background_color : "#f8fafc";
  const safeBackgroundColor = typeof background_color === "string" ? background_color : undefined;
  const safeTextColor = typeof text_color === "string" ? text_color : undefined;
  const sectionPadding = density === "compact" ? "56px 24px 48px" : density === "comfortable" ? "96px 24px 72px" : "80px 24px 64px";
  const isClassic = variant === "classic" || heroStyle === "classic";
  const isNavyTone = tone === "navy" || (tone === "default" && isClassic);
  const resolvedDarkBg = safeBackgroundColor || (isNavyTone ? primaryColorToken : "#020617");
  const resolvedDarkText = safeTextColor || primaryTextColorToken;
  const resolvedSubtleText = isNavyTone ? "rgba(255,255,255,0.82)" : "#cbd5e1";
  const primaryRadius = ctaStyle === "rounded" ? 999 : ctaStyle === "soft" ? 10 : 6;
  const primaryBg = ctaStyle === "outline" ? "transparent" : accentColor;
  const primaryBorder = ctaStyle === "outline" ? `2px solid ${accentColor}` : "none";
  const primaryColor = ctaStyle === "outline" ? accentColor : "#fff";
  const secondaryRadius = ctaStyle === "rounded" ? 999 : ctaStyle === "soft" ? 10 : 6;
  const modernImageStyle: React.CSSProperties | undefined = modernHeroImageUrl
    ? {
        backgroundImage: `linear-gradient(rgba(2, 6, 23, 0.18), rgba(2, 6, 23, 0.18)), url(${modernHeroImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : undefined;

  if (isModernTradePayload) {
    return (
      <section style={{ backgroundColor: resolvedDarkBg, color: resolvedDarkText }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: sectionPadding, display: "grid", gap: 40, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "center" }}>
          <div>
            {content.eyebrow && (
              <p style={{ margin: "0 0 16px", fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: accentColor }}>
                {content.eyebrow}
              </p>
            )}
            {heading && (
              <h1 style={{ margin: "0 0 20px", fontSize: "clamp(2rem, 4.8vw, 3.5rem)", lineHeight: 1.08, fontWeight: 800 }}>
                {heading}
              </h1>
            )}
            {subheading && (
              <p style={{ margin: "0 0 28px", maxWidth: 640, fontSize: "1.125rem", color: resolvedSubtleText, lineHeight: 1.7 }}>
                {subheading}
              </p>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a href={primaryHref} style={{ display: "inline-block", backgroundColor: primaryBg, color: primaryColor, border: primaryBorder, borderRadius: primaryRadius, padding: "12px 20px", textDecoration: "none", fontWeight: 700 }}>
                {primaryLabel}
              </a>
              {secondaryCtaText && (
                <a href={secondaryCtaUrl || ctaUrl || "#"} style={{ display: "inline-block", border: "1px solid rgba(255,255,255,0.35)", color: resolvedDarkText, borderRadius: secondaryRadius, padding: "12px 20px", textDecoration: "none", fontWeight: 700 }}>
                  {secondaryCtaText}
                </a>
              )}
            </div>
            {cta_phone && (
              <p style={{ marginTop: 20, color: resolvedSubtleText, fontSize: "0.95rem" }}>
                Prefer to call? <strong style={{ color: resolvedDarkText }}>{cta_phone}</strong>
              </p>
            )}
          </div>
          <div style={{ borderRadius: isClassic ? 10 : 16, backgroundColor: "rgba(255,255,255,0.08)", padding: 24, boxShadow: "0 20px 45px rgba(2,6,23,0.35)" }}>
            <div style={{ borderRadius: isClassic ? 8 : 12, backgroundColor: "rgba(255,255,255,0.1)", minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: resolvedSubtleText, fontSize: "0.95rem", padding: modernHeroImageUrl ? 0 : 20, overflow: "hidden" }}>
              {modernHeroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={modernHeroImageUrl}
                  alt={typeof content.imageAlt === "string" ? content.imageAlt : ""}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  style={{ width: "100%", minHeight: 280, display: "block", objectFit: "cover", ...modernImageStyle }}
                />
              ) : (
                typeof content.imageAlt === "string" ? content.imageAlt : "Trade business image placeholder"
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const isSplit = layout === "split";
  const isCentered = layout === "centered";

  // Split layout defaults to light background
  const bgColor = safeBackgroundColor ?? (isSplit ? (tone === "light" ? mutedBackgroundColorToken : "#ffffff") : primaryColorToken);
  const txtColor = safeTextColor ?? (isSplit ? "#111827" : primaryTextColorToken);

  const overlayColor = `rgba(0,0,0,${overlay_opacity})`;
  const bgStyle: React.CSSProperties = !isSplit && background_image_url
    ? { background: `linear-gradient(${overlayColor}, ${overlayColor}), url(${background_image_url}) center/cover no-repeat` }
    : { backgroundColor: bgColor };

  const textAlign = isSplit || isCentered || align === "center" ? "center" : "left";
  const isDark = !isSplit;

  // Render heading with optional accent word highlighted
  function renderHeading() {
    if (!heading) return null;
    const fontSize = "clamp(1.9rem, 4.5vw, 3rem)";
    const style: React.CSSProperties = { fontSize, fontWeight: 800, margin: "0 0 16px", lineHeight: 1.15, color: txtColor };
    if (heading_accent && heading.includes(heading_accent)) {
      const parts = heading.split(heading_accent);
      return (
        <h1 style={style}>
          {parts[0]}<span style={{ color: accentColor }}>{heading_accent}</span>{parts.slice(1).join(heading_accent)}
        </h1>
      );
    }
    return <h1 style={style}>{heading}</h1>;
  }

  const badgeBg = isDark ? "rgba(255,255,255,0.15)" : `${accentColor}18`;
  const badgeBorder = isDark ? "1px solid rgba(255,255,255,0.25)" : `1px solid ${accentColor}44`;
  const badgeTxt = isDark ? txtColor : accentColor;
  const secondaryBorderColor = isDark ? "rgba(255,255,255,0.65)" : "#d1d5db";

  const contentBlock = (
    <div style={{ flex: 1, minWidth: 0, maxWidth: isCentered ? 760 : undefined, margin: isCentered ? "0 auto" : undefined, textAlign }}>
      {/* Badges */}
      {content.eyebrow && (
        <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          {content.eyebrow}
        </p>
      )}
      {(badges as Badge[]).length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22, justifyContent: isSplit || (!isCentered && align !== "center") ? "flex-start" : "center" }}>
          {(badges as Badge[]).map((badge, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: badgeBg, border: badgeBorder, borderRadius: 20, padding: "4px 14px", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: badgeTxt }}>
              {badge.icon && <span>{badge.icon}</span>}{badge.label}
            </span>
          ))}
        </div>
      )}

      {renderHeading()}

      {subheading && (
        <p style={{ fontSize: "1.0625rem", color: isDark ? "rgba(255,255,255,0.85)" : "#4b5563", margin: "0 0 32px", maxWidth: 540, lineHeight: 1.7 }}>
          {subheading}
        </p>
      )}

      {/* CTA buttons */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: textAlign === "center" ? "center" : "flex-start", marginBottom: (trust_items as TrustItem[]).length || (stats as Stat[]).length ? 36 : 0 }}>
        <a href={primaryHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", backgroundColor: accentColor, color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "0.9375rem" }}>
          {primaryLabel}
        </a>
        {secondaryCtaText && (secondaryCtaUrl || ctaUrl) && (
          <a href={secondaryCtaUrl || ctaUrl || "#"} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", backgroundColor: "transparent", color: txtColor, border: `2px solid ${secondaryBorderColor}`, borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "0.9375rem" }}>
            {secondaryCtaText}
          </a>
        )}
      </div>

      {/* Stats row */}
      {(stats as Stat[]).length > 0 && (
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap", justifyContent: textAlign === "center" ? "center" : "flex-start", marginBottom: (trust_items as TrustItem[]).length ? 24 : 0 }}>
          {(stats as Stat[]).map((s, i) => (
            <div key={i} style={{ paddingRight: 28, marginRight: 28, borderRight: i < (stats as Stat[]).length - 1 ? `2px solid ${isDark ? "rgba(255,255,255,0.2)" : "#e5e7eb"}` : "none" }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: isDark ? "#fff" : "#111827", lineHeight: 1 }}>{s.value}</div>
              {s.label && <div style={{ fontSize: "0.8125rem", color: isDark ? "rgba(255,255,255,0.65)" : "#6b7280", marginTop: 4 }}>{s.label}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Trust items */}
      {(trust_items as TrustItem[]).length > 0 && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: textAlign === "center" ? "center" : "flex-start" }}>
          {(trust_items as TrustItem[]).map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.875rem", color: isDark ? "rgba(255,255,255,0.8)" : "#4b5563" }}>
              <span style={{ color: accentColor }}>{item.icon || "✓"}</span> {item.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        .hero-split { display: flex; flex-direction: column; gap: 40px; align-items: center; }
        @media (min-width: 860px) { .hero-split { flex-direction: row; gap: 60px; } }
        .hero-split-img { width: 100%; max-height: 380px; object-fit: cover; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
        @media (min-width: 860px) { .hero-split-img { max-height: 480px; } }
      `}</style>

      <section style={{ ...bgStyle, color: txtColor, padding: isSplit ? sectionPadding : sectionPadding, minHeight: isSplit ? undefined : min_height, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          {isSplit ? (
            <div className="hero-split">
              {contentBlock}
              {hero_image_url && (
                <div style={{ flex: "0 0 auto", width: "100%", maxWidth: 520 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={hero_image_url} alt="" className="hero-split-img" loading="eager" decoding="async" fetchPriority="high" />
                </div>
              )}
            </div>
          ) : isCentered ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              {contentBlock}
            </div>
          ) : (
            contentBlock
          )}
        </div>
      </section>

      {/* Emergency bar */}
      {(emergency_text || emergency_phone) && (
        <div style={{ backgroundColor: "#dc2626", color: "#fff", padding: "10px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: "0.9375rem" }}>
              <strong>⚠ {emergency_text || "Boiler broken down? Heating failed?"}</strong>
            </span>
            {emergency_phone && (
              <a href={`tel:${emergency_phone.replace(/\s/g, "")}`} style={{ color: "#fff", fontWeight: 700, textDecoration: "none", backgroundColor: "rgba(255,255,255,0.15)", padding: "6px 16px", borderRadius: 4, fontSize: "0.9375rem", whiteSpace: "nowrap" }}>
                📞 Emergency: {emergency_phone}
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
