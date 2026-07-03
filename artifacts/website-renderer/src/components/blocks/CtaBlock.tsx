"use client";

import { isModernTemplateContent } from "@/lib/siteTheme";

interface Props {
  content: {
    heading?: string;
    title?: string;
    subheading?: string;
    subtitle?: string;
    cta_text?: string;
    primaryCtaLabel?: string;
    cta_url?: string;
    primaryCtaHref?: string;
    background_color?: string;
    text_color?: string;
  } & Record<string, unknown>;
}

export default function CtaBlock({ content }: Props) {
  const heading = (content.heading || content.title) as string | undefined;
  const subheading = (content.subheading || content.subtitle) as string | undefined;
  const isModernTradePayload = isModernTemplateContent(content);

  const ctaText = (content.cta_text || content.primaryCtaLabel || content.button_text) as string | undefined;
  const ctaUrl = (content.cta_url || content.primaryCtaHref || content.button_url) as string | undefined;
  const secondaryLabel = (content.secondaryCtaLabel || content.secondary_cta_text) as string | undefined;
  const secondaryUrl = (content.secondary_cta_url || content.secondaryCtaHref) as string | undefined;
  const phone = content.phone as string | undefined;

  const layout = String(content.layout_variant || content.layout || "center-banner").toLowerCase();

  const backgroundColor = String(content.background_color || (isModernTradePayload ? "#fbbf24" : content.accent_color || "#f97316"));
  const textColor = String(content.text_color || (isModernTradePayload ? "#0f172a" : content.primary_text_color || "#ffffff"));
  const borderColor = String(content.border_color || "rgba(255,255,255,0.28)");

  const primaryButtonBg = String(content.primary_button_bg || content.primary_color || "#0f172a");
  const primaryButtonText = String(content.primary_button_text || content.primary_text_color || "#ffffff");
  const secondaryButtonBg = String(content.secondary_button_bg || "transparent");
  const secondaryButtonText = String(content.secondary_button_text || textColor);

  const headingFontFamily = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFontFamily = String(content.body_font_family || content.global_body_font_family || "inherit");
  const buttonFontFamily = String(content.button_font_family || content.global_button_font_family || "inherit");

  const headingSize = String(content.heading_size || "clamp(1.7rem, 2.7vw, 2.35rem)");
  const subheadingSize = String(content.subheading_size || "1.0625rem");
  const buttonRadius = String(content.button_radius || "10px");
  const sectionRadius = String(content.section_radius || "14px");

  const sectionPaddingY = String(content.padding_y || "64px");
  const sectionPaddingX = String(content.padding_x || "24px");
  const contentMaxWidth = String(content.max_width || "1200px");

  const primaryHref = ctaUrl || "#contact";
  const secondaryHref = secondaryUrl || (phone ? `tel:${phone.replace(/\s/g, "")}` : "#contact");

  return (
    <section
      style={{
        padding: `${sectionPaddingY} ${sectionPaddingX}`,
        backgroundColor,
        color: textColor,
      }}
    >
      <div style={{ maxWidth: contentMaxWidth, margin: "0 auto" }}>
        {layout === "split-inline" && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
            <div style={{ maxWidth: 760 }}>
              {heading && <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 10px", fontFamily: headingFontFamily }}>{heading}</h2>}
              {subheading && <p style={{ margin: 0, fontSize: subheadingSize, opacity: 0.95, fontFamily: bodyFontFamily }}>{subheading}</p>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {ctaText && (
                <a href={primaryHref} style={{ padding: "11px 18px", borderRadius: buttonRadius, backgroundColor: primaryButtonBg, color: primaryButtonText, textDecoration: "none", fontWeight: 700, border: `1px solid ${borderColor}`, fontFamily: buttonFontFamily }}>
                  {ctaText}
                </a>
              )}
              {secondaryLabel && (
                <a href={secondaryHref} style={{ padding: "11px 18px", borderRadius: buttonRadius, border: `1px solid ${borderColor}`, color: secondaryButtonText, background: secondaryButtonBg, textDecoration: "none", fontWeight: 700, fontFamily: buttonFontFamily }}>
                  {secondaryLabel}
                </a>
              )}
            </div>
          </div>
        )}

        {layout === "stacked-card" && (
          <div style={{ margin: "0 auto", maxWidth: 860, border: `1px solid ${borderColor}`, borderRadius: sectionRadius, padding: "32px 24px", textAlign: "center", backgroundColor: "rgba(255,255,255,0.06)" }}>
            {heading && <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 10px", fontFamily: headingFontFamily }}>{heading}</h2>}
            {subheading && <p style={{ margin: "0 auto 24px", maxWidth: 700, fontSize: subheadingSize, opacity: 0.95, fontFamily: bodyFontFamily }}>{subheading}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {ctaText && (
                <a href={primaryHref} style={{ padding: "12px 20px", borderRadius: buttonRadius, backgroundColor: primaryButtonBg, color: primaryButtonText, textDecoration: "none", fontWeight: 700, border: `1px solid ${borderColor}`, fontFamily: buttonFontFamily }}>
                  {ctaText}
                </a>
              )}
              {secondaryLabel && (
                <a href={secondaryHref} style={{ padding: "12px 20px", borderRadius: buttonRadius, border: `1px solid ${borderColor}`, color: secondaryButtonText, background: secondaryButtonBg, textDecoration: "none", fontWeight: 700, fontFamily: buttonFontFamily }}>
                  {secondaryLabel}
                </a>
              )}
            </div>
          </div>
        )}

        {layout === "minimal-strip" && (
          <div style={{ display: "grid", gap: 14, alignItems: "center", gridTemplateColumns: "1fr", borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`, padding: "16px 0" }}>
            <div>
              {heading && <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 4px", fontFamily: headingFontFamily }}>{heading}</h2>}
              {subheading && <p style={{ margin: 0, fontSize: "0.98rem", opacity: 0.9, fontFamily: bodyFontFamily }}>{subheading}</p>}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ctaText && (
                <a href={primaryHref} style={{ padding: "10px 16px", borderRadius: buttonRadius, backgroundColor: primaryButtonBg, color: primaryButtonText, textDecoration: "none", fontWeight: 700, border: `1px solid ${borderColor}`, fontFamily: buttonFontFamily }}>
                  {ctaText}
                </a>
              )}
              {secondaryLabel && (
                <a href={secondaryHref} style={{ padding: "10px 16px", borderRadius: buttonRadius, border: `1px solid ${borderColor}`, color: secondaryButtonText, background: secondaryButtonBg, textDecoration: "none", fontWeight: 700, fontFamily: buttonFontFamily }}>
                  {secondaryLabel}
                </a>
              )}
            </div>
          </div>
        )}

        {(layout === "center-banner" || !["split-inline", "stacked-card", "minimal-strip"].includes(layout)) && (
          <div style={{ margin: "0 auto", maxWidth: 760, textAlign: "center" }}>
            {heading && <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 12px", fontFamily: headingFontFamily }}>{heading}</h2>}
            {subheading && <p style={{ margin: "0 0 28px", fontSize: subheadingSize, opacity: 0.92, fontFamily: bodyFontFamily }}>{subheading}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {ctaText && (
                <a href={primaryHref} style={{ padding: "13px 24px", borderRadius: buttonRadius, backgroundColor: primaryButtonBg, color: primaryButtonText, textDecoration: "none", fontWeight: 700, border: `1px solid ${borderColor}`, fontFamily: buttonFontFamily }}>
                  {ctaText}
                </a>
              )}
              {secondaryLabel && (
                <a href={secondaryHref} style={{ padding: "13px 24px", borderRadius: buttonRadius, border: `1px solid ${borderColor}`, color: secondaryButtonText, background: secondaryButtonBg, textDecoration: "none", fontWeight: 700, fontFamily: buttonFontFamily }}>
                  {secondaryLabel}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
