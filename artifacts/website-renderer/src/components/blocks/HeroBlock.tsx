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
    backgroundImageUrl?: string;
    background_color?: string;
    backgroundColor?: string;
    text_color?: string;
    textColor?: string;
    align?: "left" | "center" | "right";
    layout?: "full" | "centered" | "split";
    variant?: "default" | "modern" | "classic";
    heroStyle?: "default" | "modern" | "classic";
    tone?: "default" | "navy" | "light";
    density?: "compact" | "normal" | "comfortable";
    ctaStyle?: "default" | "rounded" | "soft" | "outline";
    hero_image_url?: string;
    heroImageUrl?: string;
    accent_color?: string;
    badges?: Badge[];
    trust_items?: TrustItem[];
    stats?: Stat[];
    emergency_text?: string;
    emergency_phone?: string;
    min_height?: string;
    overlay_opacity?: number;
    overlay_color?: string;
    font_family?: string;
    heading_font_family?: string;
    body_font_family?: string;
    cta_font_family?: string;
    heading_font_size?: string;
    subheading_font_size?: string;
    eyebrow_font_size?: string;
    cta_font_size?: string;
    stats_value_font_size?: string;
    stats_label_font_size?: string;
    heading_font_weight?: string | number;
    subheading_font_weight?: string | number;
    cta_font_weight?: string | number;
    border_radius?: string;
    section_border_width?: string;
    section_border_color?: string;
    section_shadow?: string;
    content_max_width?: string;
    content_gap?: string;
    section_padding_top?: string;
    section_padding_bottom?: string;
    heading_color?: string;
    subheading_color?: string;
    eyebrow_color?: string;
    primary_button_bg_color?: string;
    primary_button_text_color?: string;
    primary_button_border_color?: string;
    secondary_button_bg_color?: string;
    secondary_button_text_color?: string;
    secondary_button_border_color?: string;
    badge_bg_color?: string;
    badge_text_color?: string;
    badge_border_color?: string;
    trust_icon_color?: string;
    trust_text_color?: string;
    card_background_color?: string;
    card_border_color?: string;
    card_shadow?: string;
  } & Record<string, unknown>;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getSize(value: unknown, fallback: string): string {
  if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
  const asString = getString(value);
  return asString || fallback;
}

function getWeight(value: unknown, fallback: number): number | string {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const asString = getString(value);
  return asString || fallback;
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

  const backgroundImageUrl = typeof background_image_url === "string"
    ? background_image_url
    : (typeof content.backgroundImageUrl === "string" ? content.backgroundImageUrl : undefined);
  const heroImageUrl = typeof hero_image_url === "string"
    ? hero_image_url
    : (typeof content.heroImageUrl === "string" ? content.heroImageUrl : undefined);
  const modernHeroImageUrl = heroImageUrl || backgroundImageUrl;
  const accentColor = typeof accent_color === "string" ? accent_color : "#f97316";
  const primaryColorToken = typeof primary_color === "string" ? primary_color : "#1c2942";
  const primaryTextColorToken = typeof primary_text_color === "string" ? primary_text_color : "#ffffff";
  const mutedBackgroundColorToken = typeof muted_background_color === "string" ? muted_background_color : "#f8fafc";
  const safeBackgroundColor = typeof background_color === "string"
    ? background_color
    : (typeof content.backgroundColor === "string" ? content.backgroundColor : undefined);
  const safeTextColor = typeof text_color === "string"
    ? text_color
    : (typeof content.textColor === "string" ? content.textColor : undefined);
  const defaultTopPadding = density === "compact" ? "56px" : density === "comfortable" ? "96px" : "80px";
  const defaultBottomPadding = density === "compact" ? "48px" : density === "comfortable" ? "72px" : "64px";
  const sectionPaddingTop = getSize(content.section_padding_top, defaultTopPadding);
  const sectionPaddingBottom = getSize(content.section_padding_bottom, defaultBottomPadding);
  const sectionPadding = `${sectionPaddingTop} 24px ${sectionPaddingBottom}`;
  const isClassic = variant === "classic" || heroStyle === "classic";
  const isNavyTone = tone === "navy" || (tone === "default" && isClassic);
  const resolvedDarkBg = safeBackgroundColor || (isNavyTone ? primaryColorToken : "#020617");
  const resolvedDarkText = safeTextColor || primaryTextColorToken;
  const resolvedSubtleText = isNavyTone ? "rgba(255,255,255,0.82)" : "#cbd5e1";
  const primaryRadiusDefault = ctaStyle === "rounded" ? "999px" : ctaStyle === "soft" ? "10px" : "6px";
  const primaryRadius = getSize(content.border_radius, primaryRadiusDefault);
  const primaryBg = ctaStyle === "outline" ? "transparent" : accentColor;
  const primaryBorder = ctaStyle === "outline" ? `2px solid ${accentColor}` : "none";
  const primaryColor = ctaStyle === "outline" ? accentColor : "#fff";
  const secondaryRadius = getSize(content.border_radius, primaryRadiusDefault);
  const sectionBorderWidth = getSize(content.section_border_width, "0px");
  const sectionBorderColor = getString(content.section_border_color) || "transparent";
  const sectionShadow = getString(content.section_shadow);
  const contentMaxWidth = getSize(content.content_max_width, "1200px");
  const contentGap = getSize(content.content_gap, "40px");
  const headingColor = getString(content.heading_color) || resolvedDarkText;
  const eyebrowColor = getString(content.eyebrow_color) || accentColor;
  const subheadingColor = getString(content.subheading_color) || resolvedSubtleText;
  const headingFontSize = getSize(content.heading_font_size, "clamp(2rem, 4.8vw, 3.5rem)");
  const subheadingFontSize = getSize(content.subheading_font_size, "1.125rem");
  const eyebrowFontSize = getSize(content.eyebrow_font_size, "0.875rem");
  const ctaFontSize = getSize(content.cta_font_size, "0.9375rem");
  const statsValueFontSize = getSize(content.stats_value_font_size, "1.75rem");
  const statsLabelFontSize = getSize(content.stats_label_font_size, "0.8125rem");
  const headingWeight = getWeight(content.heading_font_weight, 800);
  const subheadingWeight = getWeight(content.subheading_font_weight, 400);
  const ctaWeight = getWeight(content.cta_font_weight, 700);
  const baseFontFamily = getString(content.font_family);
  const headingFontFamily = getString(content.heading_font_family) || baseFontFamily;
  const bodyFontFamily = getString(content.body_font_family) || baseFontFamily;
  const ctaFontFamily = getString(content.cta_font_family) || baseFontFamily;
  const primaryButtonBg = getString(content.primary_button_bg_color) || primaryBg;
  const primaryButtonText = getString(content.primary_button_text_color) || primaryColor;
  const primaryButtonBorderColor = getString(content.primary_button_border_color) || accentColor;
  const secondaryButtonBg = getString(content.secondary_button_bg_color) || "transparent";
  const secondaryButtonText = getString(content.secondary_button_text_color) || resolvedDarkText;
  const secondaryButtonBorder = getString(content.secondary_button_border_color) || "rgba(255,255,255,0.35)";
  const badgeBgColor = getString(content.badge_bg_color);
  const badgeTextColor = getString(content.badge_text_color);
  const badgeBorderColor = getString(content.badge_border_color);
  const trustIconColor = getString(content.trust_icon_color) || accentColor;
  const trustTextColor = getString(content.trust_text_color);
  const cardBackgroundColor = getString(content.card_background_color) || "rgba(255,255,255,0.08)";
  const cardBorderColor = getString(content.card_border_color) || "transparent";
  const cardShadow = getString(content.card_shadow) || "0 20px 45px rgba(2,6,23,0.35)";
  const sectionBorderRadius = getSize(content.border_radius, "0px");
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
      <section style={{ backgroundColor: resolvedDarkBg, color: resolvedDarkText, borderRadius: sectionBorderRadius, border: `${sectionBorderWidth} solid ${sectionBorderColor}`, boxShadow: sectionShadow, fontFamily: bodyFontFamily }}>
        <div style={{ maxWidth: contentMaxWidth, margin: "0 auto", padding: sectionPadding, display: "grid", gap: contentGap, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "center" }}>
          <div>
            {content.eyebrow && (
              <p style={{ margin: "0 0 16px", fontSize: eyebrowFontSize, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: eyebrowColor, fontFamily: bodyFontFamily }}>
                {content.eyebrow}
              </p>
            )}
            {heading && (
              <h1 style={{ margin: "0 0 20px", fontSize: headingFontSize, lineHeight: 1.08, fontWeight: headingWeight, color: headingColor, fontFamily: headingFontFamily }}>
                {heading}
              </h1>
            )}
            {subheading && (
              <p style={{ margin: "0 0 28px", maxWidth: 640, fontSize: subheadingFontSize, color: subheadingColor, lineHeight: 1.7, fontWeight: subheadingWeight, fontFamily: bodyFontFamily }}>
                {subheading}
              </p>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <a href={primaryHref} style={{ display: "inline-block", backgroundColor: primaryButtonBg, color: primaryButtonText, border: ctaStyle === "outline" ? `2px solid ${primaryButtonBorderColor}` : primaryBorder, borderRadius: primaryRadius, padding: "12px 20px", textDecoration: "none", fontWeight: ctaWeight, fontSize: ctaFontSize, fontFamily: ctaFontFamily }}>
                {primaryLabel}
              </a>
              {secondaryCtaText && (
                <a href={secondaryCtaUrl || ctaUrl || "#"} style={{ display: "inline-block", border: `1px solid ${secondaryButtonBorder}`, backgroundColor: secondaryButtonBg, color: secondaryButtonText, borderRadius: secondaryRadius, padding: "12px 20px", textDecoration: "none", fontWeight: ctaWeight, fontSize: ctaFontSize, fontFamily: ctaFontFamily }}>
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
          <div style={{ borderRadius: isClassic ? 10 : 16, backgroundColor: cardBackgroundColor, border: `1px solid ${cardBorderColor}`, padding: 24, boxShadow: cardShadow }}>
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

  const overlayBase = getString(content.overlay_color) || "0,0,0";
  const overlayColor = overlayBase.startsWith("rgb") || overlayBase.startsWith("#")
    ? overlayBase
    : `rgba(${overlayBase},${overlay_opacity})`;
  const bgStyle: React.CSSProperties = !isSplit && backgroundImageUrl
    ? { background: `linear-gradient(${overlayColor}, ${overlayColor}), url(${backgroundImageUrl}) center/cover no-repeat` }
    : { backgroundColor: bgColor };

  const textAlign = isSplit || isCentered || align === "center" ? "center" : "left";
  const isDark = !isSplit;

  // Render heading with optional accent word highlighted
  function renderHeading() {
    if (!heading) return null;
    const fontSize = headingFontSize || "clamp(1.9rem, 4.5vw, 3rem)";
    const style: React.CSSProperties = { fontSize, fontWeight: headingWeight, margin: "0 0 16px", lineHeight: 1.15, color: headingColor || txtColor, fontFamily: headingFontFamily };
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

  const badgeBg = badgeBgColor || (isDark ? "rgba(255,255,255,0.15)" : `${accentColor}18`);
  const badgeBorder = `1px solid ${badgeBorderColor || (isDark ? "rgba(255,255,255,0.25)" : `${accentColor}44`)}`;
  const badgeTxt = badgeTextColor || (isDark ? txtColor : accentColor);
  const secondaryBorderColor = getString(content.secondary_button_border_color) || (isDark ? "rgba(255,255,255,0.65)" : "#d1d5db");

  const contentBlock = (
    <div style={{ flex: 1, minWidth: 0, maxWidth: isCentered ? 760 : undefined, margin: isCentered ? "0 auto" : undefined, textAlign }}>
      {/* Badges */}
      {content.eyebrow && (
        <p style={{ color: eyebrowColor, fontWeight: 700, fontSize: eyebrowFontSize, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFontFamily }}>
          {content.eyebrow}
        </p>
      )}
      {(badges as Badge[]).length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22, justifyContent: isSplit || (!isCentered && align !== "center") ? "flex-start" : "center" }}>
          {(badges as Badge[]).map((badge, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: badgeBg, border: badgeBorder, borderRadius: 20, padding: "4px 14px", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: badgeTxt, fontFamily: bodyFontFamily }}>
              {badge.icon && <span>{badge.icon}</span>}{badge.label}
            </span>
          ))}
        </div>
      )}

      {renderHeading()}

      {subheading && (
        <p style={{ fontSize: subheadingFontSize, color: subheadingColor || (isDark ? "rgba(255,255,255,0.85)" : "#4b5563"), margin: "0 0 32px", maxWidth: 540, lineHeight: 1.7, fontWeight: subheadingWeight, fontFamily: bodyFontFamily }}>
          {subheading}
        </p>
      )}

      {/* CTA buttons */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: textAlign === "center" ? "center" : "flex-start", marginBottom: (trust_items as TrustItem[]).length || (stats as Stat[]).length ? 36 : 0 }}>
        <a href={primaryHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", backgroundColor: primaryButtonBg, color: primaryButtonText, borderRadius: primaryRadius, border: `1px solid ${primaryButtonBorderColor}`, textDecoration: "none", fontWeight: ctaWeight, fontSize: ctaFontSize, fontFamily: ctaFontFamily }}>
          {primaryLabel}
        </a>
        {secondaryCtaText && (secondaryCtaUrl || ctaUrl) && (
          <a href={secondaryCtaUrl || ctaUrl || "#"} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", backgroundColor: secondaryButtonBg, color: secondaryButtonText || txtColor, border: `2px solid ${secondaryBorderColor}`, borderRadius: secondaryRadius, textDecoration: "none", fontWeight: ctaWeight, fontSize: ctaFontSize, fontFamily: ctaFontFamily }}>
            {secondaryCtaText}
          </a>
        )}
      </div>

      {/* Stats row */}
      {(stats as Stat[]).length > 0 && (
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap", justifyContent: textAlign === "center" ? "center" : "flex-start", marginBottom: (trust_items as TrustItem[]).length ? 24 : 0 }}>
          {(stats as Stat[]).map((s, i) => (
            <div key={i} style={{ paddingRight: 28, marginRight: 28, borderRight: i < (stats as Stat[]).length - 1 ? `2px solid ${isDark ? "rgba(255,255,255,0.2)" : "#e5e7eb"}` : "none" }}>
              <div style={{ fontSize: statsValueFontSize, fontWeight: headingWeight, color: isDark ? "#fff" : "#111827", lineHeight: 1, fontFamily: headingFontFamily }}>{s.value}</div>
              {s.label && <div style={{ fontSize: statsLabelFontSize, color: isDark ? "rgba(255,255,255,0.65)" : "#6b7280", marginTop: 4, fontFamily: bodyFontFamily }}>{s.label}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Trust items */}
      {(trust_items as TrustItem[]).length > 0 && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: textAlign === "center" ? "center" : "flex-start" }}>
          {(trust_items as TrustItem[]).map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.875rem", color: trustTextColor || (isDark ? "rgba(255,255,255,0.8)" : "#4b5563"), fontFamily: bodyFontFamily }}>
              <span style={{ color: trustIconColor }}>{item.icon || "✓"}</span> {item.text}
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

      <section style={{ ...bgStyle, color: txtColor, padding: isSplit ? sectionPadding : sectionPadding, minHeight: isSplit ? undefined : min_height, display: "flex", alignItems: "center", borderRadius: sectionBorderRadius, border: `${sectionBorderWidth} solid ${sectionBorderColor}`, boxShadow: sectionShadow, fontFamily: bodyFontFamily }}>
        <div style={{ maxWidth: contentMaxWidth, margin: "0 auto", width: "100%" }}>
          {isSplit ? (
            <div className="hero-split">
              {contentBlock}
              {heroImageUrl && (
                <div style={{ flex: "0 0 auto", width: "100%", maxWidth: 520 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroImageUrl} alt="" className="hero-split-img" loading="eager" decoding="async" fetchPriority="high" />
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
