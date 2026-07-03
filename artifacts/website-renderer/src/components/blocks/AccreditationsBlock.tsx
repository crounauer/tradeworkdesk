"use client";

interface Badge {
  name: string;
  label?: string;
  logo_url?: string;
  description?: string;
  number?: string;
}

interface Props {
  content: {
    heading?: string;
    badges?: Badge[];
    items?: Badge[];
    background_color?: string;
    text_color?: string;
    show_heading?: boolean;
  } & Record<string, unknown>;
}

export default function AccreditationsBlock({ content }: Props) {
  const source = (Array.isArray(content.badges) ? content.badges : Array.isArray(content.items) ? content.items : []) as Badge[];
  const badges = source.map((badge) => ({
    ...badge,
    name: badge.name || badge.label || "Badge",
  }));

  if (!badges.length) return null;

  const heading = String(content.heading || content.title || "Accreditations");
  const showHeading = content.show_heading !== false;

  const sectionBg = String(content.section_bg || "transparent");
  const cardBg = String(content.card_bg || content.background_color || "#f9fafb");
  const textColor = String(content.body_color || content.text_color || "#374151");
  const headingColor = String(content.heading_color || "#111827");
  const borderColor = String(content.border_color || "#e5e7eb");
  const accentColor = String(content.accent_color || "#0d9488");

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const headingSize = String(content.heading_size || "1rem");
  const bodySize = String(content.body_size || "0.9rem");

  const layout = String(content.layout_variant || content.layout || "logo-row").toLowerCase();
  const radius = String(content.card_radius || "14px");
  const paddingY = String(content.padding_y || "40px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1200px");

  const hasDescriptions = badges.some((badge) => Boolean(badge.description));

  const logoNode = (badge: Badge) =>
    badge.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={badge.logo_url} alt={badge.name} style={{ height: 52, objectFit: "contain" }} />
    ) : (
      <div style={{ padding: "8px 20px", backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 6, color: textColor, fontSize: bodySize, fontWeight: 600, fontFamily: bodyFont }}>
        {badge.name}
      </div>
    );

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, backgroundColor: sectionBg }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        {showHeading && heading ? (
          <div style={{ textAlign: layout === "minimal-list" ? "left" : "center", marginBottom: 22 }}>
            <p style={{ margin: 0, color: headingColor, fontWeight: 700, fontSize: headingSize, letterSpacing: "0.04em", fontFamily: headingFont }}>{heading}</p>
          </div>
        ) : null}

        {(layout === "logo-row" || !["card-grid", "minimal-list", "numbered-cards"].includes(layout)) && (
          <div style={{ backgroundColor: cardBg, borderRadius: radius, padding: "30px 24px", textAlign: "center", border: `1px solid ${borderColor}` }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", justifyContent: "center" }}>
              {badges.map((badge, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  {logoNode(badge)}
                  {badge.number ? <span style={{ fontSize: "0.75rem", color: textColor, fontFamily: bodyFont }}>No. {badge.number}</span> : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {layout === "card-grid" && (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {badges.map((badge, i) => (
              <div key={i} style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: radius, padding: "16px 14px" }}>
                <div style={{ marginBottom: 8 }}>{logoNode(badge)}</div>
                <p style={{ margin: "0 0 6px", fontWeight: 700, color: headingColor, fontSize: "0.95rem", fontFamily: headingFont }}>{badge.name}</p>
                {badge.description ? <p style={{ margin: 0, color: textColor, fontSize: "0.875rem", lineHeight: 1.6, fontFamily: bodyFont }}>{badge.description}</p> : null}
                {badge.number ? <p style={{ margin: "6px 0 0", color: accentColor, fontSize: "0.75rem", fontFamily: bodyFont }}>Reg. {badge.number}</p> : null}
              </div>
            ))}
          </div>
        )}

        {layout === "minimal-list" && (
          <div style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: radius, padding: "10px 16px" }}>
            {badges.map((badge, i) => (
              <div key={i} style={{ borderBottom: i < badges.length - 1 ? `1px solid ${borderColor}` : "none", padding: "12px 0", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
                <div>
                  <p style={{ margin: "0 0 4px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{badge.name}</p>
                  {badge.description ? <p style={{ margin: 0, color: textColor, fontSize: "0.85rem", fontFamily: bodyFont }}>{badge.description}</p> : null}
                </div>
                {badge.number ? <span style={{ color: accentColor, fontWeight: 700, fontSize: "0.78rem", fontFamily: bodyFont }}>No. {badge.number}</span> : <div>{logoNode(badge)}</div>}
              </div>
            ))}
          </div>
        )}

        {layout === "numbered-cards" && (
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {badges.map((badge, i) => (
              <article key={i} style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, borderRadius: radius, padding: "14px 14px" }}>
                <p style={{ margin: "0 0 6px", color: accentColor, fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: bodyFont }}>Badge {String(i + 1).padStart(2, "0")}</p>
                <p style={{ margin: "0 0 6px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{badge.name}</p>
                {hasDescriptions && badge.description ? <p style={{ margin: "0 0 6px", color: textColor, fontSize: "0.86rem", lineHeight: 1.6, fontFamily: bodyFont }}>{badge.description}</p> : null}
                <div>{logoNode(badge)}</div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
