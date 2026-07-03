"use client";

interface Feature {
  title: string;
  description?: string;
  icon?: string;
}

interface Props {
  content: {
    features?: Feature[];
    items?: Feature[];
    background_color?: string;
    text_color?: string;
    accent_color?: string;
    columns?: number;
  } & Record<string, unknown>;
}

export default function FeaturesBarBlock({ content }: Props) {
  const features = (Array.isArray(content.features) ? content.features : Array.isArray(content.items) ? content.items : []) as Feature[];

  if (!features.length) return null;

  const heading = String(content.heading || content.title || "Why Choose Us");
  const subheading = String(content.subheading || content.subtitle || "");
  const label = String(content.label || content.eyebrow || "");

  const sectionBg = String(content.section_bg || "transparent");
  const cardBg = String(content.card_bg || content.background_color || content.accent_color || "#0d9488");
  const textColor = String(content.body_color || content.text_color || "#ffffff");
  const headingColor = String(content.heading_color || "#ffffff");
  const borderColor = String(content.border_color || "rgba(255,255,255,0.2)");
  const accentColor = String(content.accent_color || "#0d9488");

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.6rem, 3vw, 2.1rem)");
  const bodySize = String(content.body_size || "0.95rem");

  const layout = String(content.layout_variant || content.layout || "icon-grid").toLowerCase();
  const columns = Number(content.columns || Math.min(features.length, 4));
  const cols = Number.isFinite(columns) ? Math.min(Math.max(columns, 1), 4) : Math.min(features.length, 4);
  const radius = String(content.card_radius || "16px");
  const paddingY = String(content.padding_y || "36px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1200px");

  const iconBox = (icon?: string) => (
    <div style={{ width: 44, height: 44, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", flexShrink: 0 }}>
      {icon || "✓"}
    </div>
  );

  const gridTemplate = `repeat(${cols}, minmax(0, 1fr))`;

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, backgroundColor: sectionBg }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        {(label || heading || subheading) && (
          <div style={{ textAlign: layout === "split-list" ? "left" : "center", marginBottom: 22 }}>
            {label ? <p style={{ margin: "0 0 8px", color: accentColor, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: bodyFont }}>{label}</p> : null}
            <h2 style={{ margin: "0 0 8px", color: headingColor, fontWeight: 800, fontSize: headingSize, fontFamily: headingFont }}>{heading}</h2>
            {subheading ? <p style={{ margin: 0, color: textColor, opacity: 0.9, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p> : null}
          </div>
        )}

        {(layout === "icon-grid" || !["split-list", "minimal-strip", "numbered-cards"].includes(layout)) && (
          <div style={{ backgroundColor: cardBg, color: textColor, borderRadius: radius, padding: "28px 24px", border: `1px solid ${borderColor}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }} className="fbar-grid-layout">
              <style>{`
                @media (min-width: 600px) { .fbar-grid-layout { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
                @media (min-width: 900px) { .fbar-grid-layout { grid-template-columns: ${gridTemplate}; } }
              `}</style>
              {features.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  {iconBox(f.icon)}
                  <div>
                    <p style={{ margin: "0 0 5px", fontSize: "0.95rem", fontWeight: 700, color: headingColor, fontFamily: headingFont }}>{f.title}</p>
                    {f.description ? <p style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.55, color: textColor, opacity: 0.86, fontFamily: bodyFont }}>{f.description}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {layout === "split-list" && (
          <div style={{ backgroundColor: cardBg, color: textColor, borderRadius: radius, padding: "22px 20px", border: `1px solid ${borderColor}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
              {features.map((f, i) => (
                <article key={i} style={{ border: `1px solid ${borderColor}`, borderRadius: 10, padding: "12px 12px" }}>
                  <p style={{ margin: "0 0 5px", color: accentColor, fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: bodyFont }}>Feature {i + 1}</p>
                  <h3 style={{ margin: "0 0 6px", color: headingColor, fontSize: "1rem", fontWeight: 700, fontFamily: headingFont }}>{f.title}</h3>
                  {f.description ? <p style={{ margin: 0, color: textColor, opacity: 0.88, fontSize: "0.86rem", fontFamily: bodyFont }}>{f.description}</p> : null}
                </article>
              ))}
            </div>
          </div>
        )}

        {layout === "minimal-strip" && (
          <div style={{ backgroundColor: cardBg, color: textColor, borderRadius: radius, padding: "0 18px", border: `1px solid ${borderColor}` }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", gap: 10, alignItems: "start", borderBottom: i < features.length - 1 ? `1px solid ${borderColor}` : "none", padding: "12px 0" }}>
                <div style={{ color: accentColor, fontWeight: 700, fontFamily: headingFont }}>{f.icon || "•"}</div>
                <div>
                  <p style={{ margin: "0 0 4px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{f.title}</p>
                  {f.description ? <p style={{ margin: 0, color: textColor, opacity: 0.86, fontSize: "0.84rem", fontFamily: bodyFont }}>{f.description}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {layout === "numbered-cards" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {features.map((f, i) => (
              <article key={i} style={{ backgroundColor: cardBg, color: textColor, borderRadius: radius, border: `1px solid ${borderColor}`, padding: "14px 14px" }}>
                <p style={{ margin: "0 0 4px", color: accentColor, fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: bodyFont }}>Item {String(i + 1).padStart(2, "0")}</p>
                <h3 style={{ margin: "0 0 5px", color: headingColor, fontSize: "0.98rem", fontWeight: 700, fontFamily: headingFont }}>{f.title}</h3>
                {f.description ? <p style={{ margin: 0, color: textColor, opacity: 0.88, fontSize: "0.84rem", lineHeight: 1.55, fontFamily: bodyFont }}>{f.description}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
