import { sanitizeTenantHtml } from "@/lib/sanitize-html";

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    body?: string;
    text?: string;
    html?: string;
    image_url?: string;
    cta_text?: string;
    cta_url?: string;
    label?: string;
    accent_color?: string;
    background_color?: string;
    text_color?: string;
  } & Record<string, unknown>;
}

export default function DetailSectionBlock({ content }: Props) {
  const heading = content.heading || "Details";
  const body = (content.html || content.body || content.text) as string | undefined;
  const safeBody = sanitizeTenantHtml(body);
  const accent = content.accent_color || "#f97316";
  const background = content.background_color || "#ffffff";
  const textColor = content.text_color || "#111827";
  const headingColor = String(content.heading_color || textColor);
  const bodyColor = String(content.body_color || "#374151");
  const cardBg = String(content.card_bg || background);
  const borderColor = String(content.border_color || "rgba(15, 23, 42, 0.08)");
  const radius = String(content.card_radius || "16px");
  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.8rem, 4vw, 2.6rem)");
  const bodySize = String(content.body_size || "1rem");
  const sectionPaddingY = String(content.padding_y || "72px");
  const sectionPaddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1180px");
  const layoutVariant = String(content.layout_variant || content.layout || "split-right").toLowerCase();
  const imageOnLeft = ["split-left", "image-left", "left"].includes(layoutVariant);
  const showImage = Boolean(content.image_url);
  const columns = showImage ? (imageOnLeft ? "0.9fr 1.1fr" : "1.1fr 0.9fr") : "1fr";

  return (
    <section style={{ padding: `${sectionPaddingY} ${sectionPaddingX}`, backgroundColor: background, color: textColor }}>
      <div style={{ maxWidth, margin: "0 auto", display: "grid", gap: 32, gridTemplateColumns: columns, alignItems: "center" }}>
        {showImage && imageOnLeft && (
          <div style={{ borderRadius: radius, overflow: "hidden", boxShadow: "0 16px 40px rgba(15,23,42,0.12)", background: cardBg, border: `1px solid ${borderColor}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content.image_url} alt={heading} style={{ width: "100%", display: "block", objectFit: "cover" }} />
          </div>
        )}
        <div>
          {content.label && <p style={{ color: accent, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFont }}>{content.label}</p>}
          <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 14px", lineHeight: 1.15, color: headingColor, fontFamily: headingFont }}>{heading}</h2>
          {content.subheading && <p style={{ color: "#6b7280", fontSize: "1.0625rem", lineHeight: 1.75, margin: "0 0 20px", fontFamily: bodyFont }}>{content.subheading}</p>}
          {safeBody && <div style={{ color: bodyColor, lineHeight: 1.85, marginBottom: 24, fontSize: bodySize, fontFamily: bodyFont }} dangerouslySetInnerHTML={{ __html: safeBody }} />}
          {content.cta_text && content.cta_url && (
            <a href={content.cta_url} style={{ display: "inline-block", padding: "12px 24px", backgroundColor: accent, color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontFamily: bodyFont }}>
              {content.cta_text}
            </a>
          )}
        </div>
        {showImage && !imageOnLeft && (
          <div style={{ borderRadius: radius, overflow: "hidden", boxShadow: "0 16px 40px rgba(15,23,42,0.12)", background: cardBg, border: `1px solid ${borderColor}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content.image_url} alt={heading} style={{ width: "100%", display: "block", objectFit: "cover" }} />
          </div>
        )}
      </div>
    </section>
  );
}