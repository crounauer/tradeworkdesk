interface FeatureCard {
  title: string;
  description?: string;
  icon?: string;
  cta_text?: string;
  cta_url?: string;
}

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    cards?: FeatureCard[];
    features?: FeatureCard[];
    items?: FeatureCard[];
    accent_color?: string;
  } & Record<string, unknown>;
}

export default function FeatureCardsBlock({ content }: Props) {
  const cards = (Array.isArray(content.cards) ? content.cards : Array.isArray(content.features) ? content.features : Array.isArray(content.items) ? content.items : []) as FeatureCard[];

  if (!cards.length) return null;

  const heading = String(content.heading || content.title || "Features");
  const subheading = String(content.subheading || content.subtitle || "");
  const label = String(content.label || content.eyebrow || "");

  const sectionBg = String(content.section_bg || "transparent");
  const cardBg = String(content.card_bg || "#ffffff");
  const borderColor = String(content.border_color || "#e5e7eb");
  const accentColor = String(content.accent_color || "#0d9488");
  const headingColor = String(content.heading_color || "#111827");
  const bodyColor = String(content.body_color || "#6b7280");

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const buttonFont = String(content.button_font_family || content.global_button_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.75rem, 3vw, 2.25rem)");
  const bodySize = String(content.body_size || "1rem");

  const layout = String(content.layout_variant || content.layout || "card-grid").toLowerCase();
  const radius = String(content.card_radius || "14px");
  const paddingY = String(content.padding_y || "72px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1200px");

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, background: sectionBg }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        <div style={{ textAlign: layout === "split-list" ? "left" : "center", marginBottom: 28 }}>
          {label ? <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFont }}>{label}</p> : null}
          <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 12px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
          {subheading ? <p style={{ color: bodyColor, fontSize: bodySize, maxWidth: 720, margin: layout === "split-list" ? "0" : "0 auto", fontFamily: bodyFont }}>{subheading}</p> : null}
        </div>

        {(layout === "card-grid" || !["split-list", "icon-panels", "minimal-tiles"].includes(layout)) && (
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {cards.map((card, index) => (
              <article key={index} style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: radius, padding: 22, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
                {card.icon ? <div style={{ fontSize: "1.5rem", marginBottom: 14, color: accentColor }}>{card.icon}</div> : null}
                <h3 style={{ margin: "0 0 10px", fontSize: "1.05rem", fontWeight: 700, color: headingColor, fontFamily: headingFont }}>{card.title}</h3>
                {card.description ? <p style={{ margin: "0 0 16px", color: bodyColor, lineHeight: 1.7, fontSize: "0.9375rem", fontFamily: bodyFont }}>{card.description}</p> : null}
                {card.cta_text && card.cta_url ? <a href={card.cta_url} style={{ color: accentColor, fontWeight: 700, textDecoration: "none", fontFamily: buttonFont }}>{card.cta_text}</a> : null}
              </article>
            ))}
          </div>
        )}

        {layout === "split-list" && (
          <div style={{ display: "grid", gap: 12 }}>
            {cards.map((card, index) => (
              <article key={index} style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: radius, padding: "16px 18px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "32px minmax(0, 1fr)", gap: 12 }}>
                  <div style={{ color: accentColor, fontWeight: 700, fontFamily: headingFont }}>{card.icon || String(index + 1)}</div>
                  <div>
                    <h3 style={{ margin: "0 0 6px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{card.title}</h3>
                    {card.description ? <p style={{ margin: 0, color: bodyColor, fontSize: "0.92rem", fontFamily: bodyFont }}>{card.description}</p> : null}
                    {card.cta_text && card.cta_url ? <a href={card.cta_url} style={{ display: "inline-block", marginTop: 10, color: accentColor, fontWeight: 700, textDecoration: "none", fontFamily: buttonFont }}>{card.cta_text}</a> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {layout === "icon-panels" && (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {cards.map((card, index) => (
              <article key={index} style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: radius, padding: 18 }}>
                <div style={{ width: 46, height: 46, borderRadius: 10, background: `${accentColor}22`, color: accentColor, display: "grid", placeItems: "center", fontSize: "1.2rem", marginBottom: 10 }}>{card.icon || "✓"}</div>
                <h3 style={{ margin: "0 0 6px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{card.title}</h3>
                {card.description ? <p style={{ margin: 0, color: bodyColor, fontSize: "0.9rem", lineHeight: 1.65, fontFamily: bodyFont }}>{card.description}</p> : null}
                {card.cta_text && card.cta_url ? <a href={card.cta_url} style={{ display: "inline-block", marginTop: 12, color: accentColor, fontWeight: 700, textDecoration: "none", fontFamily: buttonFont }}>{card.cta_text}</a> : null}
              </article>
            ))}
          </div>
        )}

        {layout === "minimal-tiles" && (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {cards.map((card, index) => (
              <article key={index} style={{ borderBottom: `2px solid ${accentColor}`, background: cardBg, borderRadius: radius, border: `1px solid ${borderColor}`, padding: 14 }}>
                <h3 style={{ margin: "0 0 5px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{card.title}</h3>
                {card.description ? <p style={{ margin: 0, color: bodyColor, fontSize: "0.88rem", fontFamily: bodyFont }}>{card.description}</p> : null}
                {card.cta_text && card.cta_url ? <a href={card.cta_url} style={{ display: "inline-block", marginTop: 10, color: accentColor, fontWeight: 700, textDecoration: "none", fontFamily: buttonFont }}>{card.cta_text}</a> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
