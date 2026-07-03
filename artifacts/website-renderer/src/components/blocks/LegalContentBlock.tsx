import { sanitizeTenantHtml } from "@/lib/sanitize-html";

interface Props {
  content: {
    heading?: string;
    body?: string;
    html?: string;
    text?: string;
  } & Record<string, unknown>;
}

export default function LegalContentBlock({ content }: Props) {
  const heading = String(content.heading || content.title || "Legal");
  const label = String(content.label || content.eyebrow || "");
  const body = (content.html || content.body || content.text) as string | undefined;
  const safeBody = sanitizeTenantHtml(body);

  const layout = String(content.layout_variant || content.layout || "classic-doc").toLowerCase();

  const sectionBg = String(content.section_bg || content.background_color || "#ffffff");
  const cardBg = String(content.card_bg || "#ffffff");
  const borderColor = String(content.border_color || "#e5e7eb");
  const accentColor = String(content.accent_color || "#d97706");
  const headingColor = String(content.heading_color || content.text_color || "#0f172a");
  const bodyColor = String(content.body_color || content.muted_text_color || "#334155");

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.85rem, 3.2vw, 2.5rem)");
  const bodySize = String(content.body_size || "1rem");
  const cardRadius = String(content.card_radius || "12px");
  const paddingY = String(content.padding_y || "72px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "960px");

  const proseStyle = {
    lineHeight: 1.9,
    color: bodyColor,
    fontFamily: bodyFont,
    fontSize: bodySize,
  };

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, backgroundColor: sectionBg }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        {layout === "split-aside" ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)", gap: 18 }}>
            <aside style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 14, alignSelf: "start", position: "sticky", top: 16 }}>
              <p style={{ margin: 0, color: headingColor, fontWeight: 700, fontFamily: headingFont }}>On this page</p>
              <p style={{ margin: "8px 0 0", color: bodyColor, fontSize: "0.86rem", fontFamily: bodyFont }}>Overview</p>
              <p style={{ margin: "5px 0 0", color: bodyColor, fontSize: "0.86rem", fontFamily: bodyFont }}>How we use information</p>
              <p style={{ margin: "5px 0 0", color: bodyColor, fontSize: "0.86rem", fontFamily: bodyFont }}>Your rights</p>
            </aside>
            <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 20 }}>
              {label ? <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: bodyFont }}>{label}</p> : null}
              <h2 style={{ margin: "0 0 14px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading}</h2>
              {safeBody ? <div style={proseStyle} dangerouslySetInnerHTML={{ __html: safeBody }} /> : <p style={proseStyle}>No legal content has been added yet.</p>}
            </article>
          </div>
        ) : null}

        {layout === "minimal-prose" ? (
          <article>
            {label ? <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: bodyFont }}>{label}</p> : null}
            <h2 style={{ margin: "0 0 14px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading}</h2>
            {safeBody ? <div style={proseStyle} dangerouslySetInnerHTML={{ __html: safeBody }} /> : <p style={proseStyle}>No legal content has been added yet.</p>}
          </article>
        ) : null}

        {layout === "boxed-note" ? (
          <article style={{ border: `2px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 22, boxShadow: `0 18px 48px -34px ${accentColor}` }}>
            {label ? <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: bodyFont }}>{label}</p> : null}
            <h2 style={{ margin: "0 0 14px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading}</h2>
            {safeBody ? <div style={proseStyle} dangerouslySetInnerHTML={{ __html: safeBody }} /> : <p style={proseStyle}>No legal content has been added yet.</p>}
          </article>
        ) : null}

        {(layout === "classic-doc" || !["split-aside", "minimal-prose", "boxed-note"].includes(layout)) ? (
          <article style={{ border: `1px solid ${borderColor}`, borderRadius: cardRadius, background: cardBg, padding: 20 }}>
            {label ? <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: bodyFont }}>{label}</p> : null}
            <h2 style={{ margin: "0 0 14px", color: headingColor, fontSize: headingSize, fontWeight: 800, fontFamily: headingFont }}>{heading}</h2>
            {safeBody ? <div style={proseStyle} dangerouslySetInnerHTML={{ __html: safeBody }} /> : <p style={proseStyle}>No legal content has been added yet.</p>}
          </article>
        ) : null}
      </div>
    </section>
  );
}
