interface Brand {
  name: string;
  logo_url?: string;
}

interface Props {
  content: {
    heading?: string;
    label?: string;
    brands?: Brand[];
    items?: Brand[];
    background_color?: string;
  } & Record<string, unknown>;
}

export default function BrandsBlock({ content }: Props) {
  const brands = (Array.isArray(content.brands) ? content.brands : Array.isArray(content.items) ? content.items : []) as Brand[];
  if (!brands.length) return null;

  const heading = String(content.heading || content.title || "Trusted By");
  const label = String(content.label || content.eyebrow || "");

  const sectionBg = String(content.section_bg || content.background_color || "#ffffff");
  const cardBg = String(content.card_bg || "transparent");
  const textColor = String(content.text_color || "#9ca3af");
  const headingColor = String(content.heading_color || "#6b7280");
  const accentColor = String(content.accent_color || "#0d9488");
  const borderColor = String(content.border_color || "#e5e7eb");

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const headingSize = String(content.heading_size || "0.8125rem");
  const bodySize = String(content.body_size || "0.9375rem");

  const layout = String(content.layout_variant || content.layout || "logo-cloud").toLowerCase();
  const radius = String(content.card_radius || "12px");
  const paddingY = String(content.padding_y || "40px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1200px");

  const renderLogo = (brand: Brand, i: number) => (
    brand.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={i} src={brand.logo_url} alt={brand.name} style={{ height: 36, objectFit: "contain", opacity: 0.75, filter: layout === "minimal-list" ? "none" : "grayscale(1)" }} />
    ) : (
      <span key={i} style={{ fontSize: bodySize, fontWeight: 600, color: textColor, fontFamily: bodyFont }}>{brand.name}</span>
    )
  );

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, backgroundColor: sectionBg, borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}` }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        {(label || heading) ? (
          <p style={{ textAlign: layout === "split-grid" ? "left" : "center", fontSize: headingSize, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: headingColor, marginBottom: 24, fontFamily: headingFont }}>
            {label || heading}
          </p>
        ) : null}

        {(layout === "logo-cloud" || !["split-grid", "minimal-list", "numbered-tiles"].includes(layout)) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 30, background: cardBg, borderRadius: radius, padding: cardBg === "transparent" ? "0" : "14px" }}>
            {brands.map((brand, i) => renderLogo(brand, i))}
          </div>
        )}

        {layout === "split-grid" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
            {brands.map((brand, i) => (
              <article key={i} style={{ border: `1px solid ${borderColor}`, borderRadius: radius, background: cardBg === "transparent" ? "#fff" : cardBg, padding: "12px 10px", display: "grid", placeItems: "center", minHeight: 72 }}>
                {renderLogo(brand, i)}
              </article>
            ))}
          </div>
        )}

        {layout === "minimal-list" && (
          <div style={{ display: "grid", gap: 6 }}>
            {brands.map((brand, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${borderColor}`, padding: "8px 0", color: textColor, fontFamily: bodyFont, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: accentColor, fontWeight: 700, fontSize: "0.82rem" }}>{String(i + 1).padStart(2, "0")}</span>
                {renderLogo(brand, i)}
              </div>
            ))}
          </div>
        )}

        {layout === "numbered-tiles" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
            {brands.map((brand, i) => (
              <article key={i} style={{ borderRadius: radius, border: `1px solid ${borderColor}`, background: cardBg === "transparent" ? "#fff" : cardBg, padding: "10px" }}>
                <p style={{ margin: "0 0 6px", color: accentColor, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: bodyFont }}>Brand {i + 1}</p>
                <div style={{ display: "grid", placeItems: "center", minHeight: 50 }}>{renderLogo(brand, i)}</div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
