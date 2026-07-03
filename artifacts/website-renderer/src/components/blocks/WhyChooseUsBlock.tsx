interface Feature {
  title: string;
  description?: string;
  icon?: string;
}

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    features?: Feature[];
    items?: Feature[];
    cta_text?: string;
    cta_url?: string;
    background_color?: string;
    text_color?: string;
    accent_color?: string;
  } & Record<string, unknown>;
}

export default function WhyChooseUsBlock({ content }: Props) {
  const features = (Array.isArray(content.features) ? content.features : Array.isArray(content.items) ? content.items : []) as Feature[];

  if (!features.length) return null;

  const heading = String(content.heading || content.title || "Why Choose Us");
  const subheading = String(content.subheading || content.subtitle || "");
  const label = String(content.label || content.eyebrow || "");
  const ctaText = String(content.cta_text || content.primaryCtaLabel || content.primaryButtonText || "");
  const ctaUrl = String(content.cta_url || content.primaryCtaHref || content.primaryButtonUrl || "");

  const sectionBg = String(content.section_bg || content.background_color || "#1c2942");
  const cardBg = String(content.card_bg || "transparent");
  const textColor = String(content.body_color || content.text_color || "#ffffff");
  const headingColor = String(content.heading_color || "#ffffff");
  const accentColor = String(content.accent_color || "#f97316");
  const borderColor = String(content.border_color || "rgba(249,115,22,0.3)");

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const buttonFont = String(content.button_font_family || content.global_button_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.75rem, 3vw, 2.25rem)");
  const bodySize = String(content.body_size || "1rem");

  const layout = String(content.layout_variant || content.layout || "icon-circle").toLowerCase();
  const radius = String(content.card_radius || "12px");
  const paddingY = String(content.padding_y || "72px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1200px");

  return (
    <section style={{ backgroundColor: sectionBg, color: textColor, padding: `${paddingY} ${paddingX}` }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        <div style={{ textAlign: layout === "split-list" ? "left" : "center", marginBottom: 36 }}>
          {label ? <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFont }}>{label}</p> : null}
          <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 14px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
          {subheading ? <p style={{ opacity: 0.85, fontSize: bodySize, maxWidth: 720, margin: layout === "split-list" ? "0" : "0 auto", color: textColor, fontFamily: bodyFont }}>{subheading}</p> : null}
        </div>

        {(layout === "icon-circle" || !["split-list", "minimal-cards", "numbered-steps"].includes(layout)) && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {features.map((f, i) => (
              <article key={i} style={{ textAlign: "center", padding: 12, background: cardBg, borderRadius: radius, border: cardBg === "transparent" ? "none" : `1px solid ${borderColor}` }}>
                <div style={{ width: 60, height: 60, backgroundColor: `${accentColor}26`, border: `2px solid ${accentColor}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", margin: "0 auto 14px" }}>
                  {f.icon || "✓"}
                </div>
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, marginBottom: 10, color: headingColor, fontFamily: headingFont }}>{f.title}</h3>
                {f.description ? <p style={{ opacity: 0.85, fontSize: "0.9375rem", lineHeight: 1.65, margin: 0, color: textColor, fontFamily: bodyFont }}>{f.description}</p> : null}
              </article>
            ))}
          </div>
        )}

        {layout === "split-list" && (
          <div style={{ display: "grid", gap: 12 }}>
            {features.map((f, i) => (
              <article key={i} style={{ display: "grid", gridTemplateColumns: "36px minmax(0, 1fr)", gap: 12, padding: "12px 14px", border: `1px solid ${borderColor}`, borderRadius: radius, background: cardBg === "transparent" ? "rgba(255,255,255,0.03)" : cardBg }}>
                <div style={{ color: accentColor, fontWeight: 700, fontFamily: headingFont }}>{f.icon || i + 1}</div>
                <div>
                  <h3 style={{ margin: "0 0 4px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{f.title}</h3>
                  {f.description ? <p style={{ margin: 0, color: textColor, opacity: 0.86, fontSize: "0.9rem", fontFamily: bodyFont }}>{f.description}</p> : null}
                </div>
              </article>
            ))}
          </div>
        )}

        {layout === "minimal-cards" && (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {features.map((f, i) => (
              <article key={i} style={{ padding: "14px 14px", borderBottom: `2px solid ${accentColor}`, borderRadius: radius, background: cardBg === "transparent" ? "rgba(255,255,255,0.02)" : cardBg }}>
                <h3 style={{ margin: "0 0 6px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{f.title}</h3>
                {f.description ? <p style={{ margin: 0, color: textColor, opacity: 0.86, fontSize: "0.86rem", fontFamily: bodyFont }}>{f.description}</p> : null}
              </article>
            ))}
          </div>
        )}

        {layout === "numbered-steps" && (
          <div style={{ display: "grid", gap: 12 }}>
            {features.map((f, i) => (
              <article key={i} style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", gap: 12, alignItems: "start" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: accentColor, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: "0.85rem", fontFamily: headingFont }}>{i + 1}</div>
                <div style={{ border: `1px solid ${borderColor}`, borderRadius: radius, padding: "12px 14px", background: cardBg === "transparent" ? "rgba(255,255,255,0.03)" : cardBg }}>
                  <h3 style={{ margin: "0 0 6px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{f.title}</h3>
                  {f.description ? <p style={{ margin: 0, color: textColor, opacity: 0.86, fontSize: "0.9rem", fontFamily: bodyFont }}>{f.description}</p> : null}
                </div>
              </article>
            ))}
          </div>
        )}

        {ctaText && ctaUrl ? (
          <div style={{ textAlign: "center", marginTop: 34 }}>
            <a href={ctaUrl} style={{ display: "inline-block", padding: "13px 32px", backgroundColor: accentColor, color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "1rem", fontFamily: buttonFont }}>
              {ctaText} ›
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
