"use client";

import { sanitizeTenantHtml } from "@/lib/sanitize-html";
import { isModernTemplateContent } from "@/lib/siteTheme";

interface Props {
  content: {
    html?: string;
    text?: string;
    align?: "left" | "center" | "right";
  } & Record<string, unknown>;
}

export default function TextBlock({ content }: Props) {
  // Support both field names: 'html' (current) and 'body' (legacy editor name)
  const html = (content.html || content.body) as string | undefined;
  const safeHtml = sanitizeTenantHtml(html);
  const text = content.text as string | undefined;
  const align = (content.align as "left" | "center" | "right") ?? "left";
  const title = content.title as string | undefined;
  const eyebrow = content.eyebrow as string | undefined;
  const subtitle = content.subtitle as string | undefined;
  const isModernTradePayload = isModernTemplateContent(content);

  const sectionBg = String(content.section_bg || content.background_color || "#ffffff");
  const headingColor = String(content.heading_color || content.text_color || "#0f172a");
  const bodyColor = String(content.body_color || content.text_color || "#334155");
  const mutedColor = String(content.muted_text_color || "#475569");
  const accentColor = String(content.accent_color || "#d97706");
  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.85rem, 3.2vw, 2.5rem)");
  const bodySize = String(content.body_size || "1rem");
  const maxWidth = String(content.max_width || (isModernTradePayload ? "960px" : "800px"));
  const sectionPaddingY = String(content.padding_y || (isModernTradePayload ? "80px" : "48px"));
  const sectionPaddingX = String(content.padding_x || "24px");
  const layoutVariant = String(content.layout_variant || content.layout || "default").toLowerCase();
  const alignMode = layoutVariant === "center" ? "center" : align;

  if (isModernTradePayload) {
    return (
      <section style={{ padding: `${sectionPaddingY} ${sectionPaddingX}`, backgroundColor: sectionBg }}>
        <div style={{ maxWidth, margin: "0 auto", textAlign: alignMode }}>
          {eyebrow && <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: bodyFont }}>{eyebrow}</p>}
          {title && <h2 style={{ margin: "0 0 14px", color: headingColor, fontWeight: 800, fontSize: headingSize, fontFamily: headingFont }}>{title}</h2>}
          {subtitle && <p style={{ margin: "0 0 20px", color: mutedColor, lineHeight: 1.7, fontSize: bodySize, fontFamily: bodyFont }}>{subtitle}</p>}
          {safeHtml && <div style={{ color: bodyColor, lineHeight: 1.9, fontSize: bodySize, fontFamily: bodyFont }} dangerouslySetInnerHTML={{ __html: safeHtml }} />}
          {!safeHtml && text && <p style={{ color: bodyColor, lineHeight: 1.9, whiteSpace: "pre-wrap", fontSize: bodySize, fontFamily: bodyFont }}>{text}</p>}
        </div>
      </section>
    );
  }

  if (safeHtml) {
    return (
      <section style={{ padding: `${sectionPaddingY} ${sectionPaddingX}`, backgroundColor: sectionBg }}>
        <div
          style={{ maxWidth, margin: "0 auto", textAlign: alignMode, color: bodyColor, fontFamily: bodyFont, fontSize: bodySize }}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </section>
    );
  }

  if (text) {
    return (
      <section style={{ padding: `${sectionPaddingY} ${sectionPaddingX}`, backgroundColor: sectionBg }}>
        <div style={{ maxWidth, margin: "0 auto", textAlign: alignMode }}>
          <p style={{ whiteSpace: "pre-wrap", color: bodyColor, fontFamily: bodyFont, fontSize: bodySize }}>{text}</p>
        </div>
      </section>
    );
  }

  if (title || eyebrow || subtitle) {
    return (
      <section style={{ padding: `${sectionPaddingY} ${sectionPaddingX}`, backgroundColor: sectionBg }}>
        <div style={{ maxWidth, margin: "0 auto", textAlign: alignMode }}>
          {eyebrow && <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: bodyFont }}>{eyebrow}</p>}
          {title && <h2 style={{ margin: "0 0 14px", color: headingColor, fontWeight: 800, fontSize: headingSize, fontFamily: headingFont }}>{title}</h2>}
          {subtitle && <p style={{ margin: "0 0 20px", color: mutedColor, lineHeight: 1.7, fontSize: bodySize, fontFamily: bodyFont }}>{subtitle}</p>}
        </div>
      </section>
    );
  }

  return null;
}
