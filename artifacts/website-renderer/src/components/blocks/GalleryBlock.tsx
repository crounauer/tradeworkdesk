"use client";

import { isModernTemplateContent } from "@/lib/siteTheme";

interface GalleryImage {
  url: string;
  alt?: string;
  caption?: string;
}

interface Props {
  content: {
    heading?: string;
    images?: GalleryImage[];
    columns?: 2 | 3 | 4;
  } & Record<string, unknown>;
}

export default function GalleryBlock({ content }: Props) {
  const heading = content.heading as string | undefined;
  const images = (content.images || []) as GalleryImage[];
  const columns = Number(content.columns || 3);
  const label = (content.label || content.eyebrow) as string | undefined;
  const subtitle = (content.subtitle || content.subheading) as string | undefined;
  const isModernTradePayload = isModernTemplateContent(content);
  const layout = String(content.layout_variant || content.layout || "grid").toLowerCase();

  const sectionBg = String(content.section_bg || content.background_color || "#ffffff");
  const cardBg = String(content.card_bg || "#ffffff");
  const borderColor = String(content.border_color || "#e2e8f0");
  const headingColor = String(content.heading_color || content.text_color || "#111827");
  const textColor = String(content.body_color || content.muted_text_color || "#6b7280");
  const accentColor = String(content.accent_color || (isModernTradePayload ? "#d97706" : "#f97316"));
  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const headingSize = String(content.heading_size || (isModernTradePayload ? "clamp(1.85rem, 3.2vw, 2.5rem)" : "2rem"));
  const imageRadius = String(content.image_radius || "12px");
  const imageHeight = String(content.image_height || "240px");
  const paddingY = String(content.padding_y || (isModernTradePayload ? "80px" : "64px"));
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1200px");

  if (!images.length) return null;

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, backgroundColor: sectionBg }}>
      <style>{`
        .gallery-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 500px) { .gallery-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 900px) { .gallery-grid { grid-template-columns: repeat(${columns}, 1fr); } }
        .gallery-masonry { columns: 1; column-gap: 12px; }
        .gallery-masonry > div { break-inside: avoid; margin-bottom: 12px; }
        @media (min-width: 700px) { .gallery-masonry { columns: 2; } }
        @media (min-width: 1024px) { .gallery-masonry { columns: ${Math.max(2, columns)}; } }
        .gallery-strip { display: grid; gap: 10px; grid-auto-flow: column; grid-auto-columns: minmax(220px, 1fr); overflow-x: auto; padding-bottom: 6px; }
      `}</style>
      <div style={{ maxWidth, margin: "0 auto" }}>
        {(heading || label || subtitle) && (
          <div style={{ textAlign: layout === "strip" ? "left" : "center", marginBottom: 24 }}>
            {label ? <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px", fontFamily: bodyFont }}>{label}</p> : null}
            {heading ? <h2 style={{ margin: "0 0 12px", color: headingColor, fontWeight: 800, fontSize: headingSize, fontFamily: headingFont }}>{heading}</h2> : null}
            {subtitle ? <p style={{ margin: 0, color: textColor, fontFamily: bodyFont }}>{subtitle}</p> : null}
          </div>
        )}

        {layout === "masonry" && (
          <div className="gallery-masonry">
            {images.map((img, i) => (
              <div key={i} style={{ borderRadius: imageRadius, overflow: "hidden", border: `1px solid ${borderColor}`, background: cardBg }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt || img.caption || ""} style={{ width: "100%", height: i % 3 === 0 ? "300px" : imageHeight, objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>
        )}

        {layout === "collage" && (
          <div className="gallery-grid" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
            {images.map((img, i) => {
              const span = i % 5 === 0 ? 8 : i % 5 === 1 ? 4 : i % 5 === 2 ? 5 : i % 5 === 3 ? 7 : 6;
              return (
                <div key={i} style={{ gridColumn: `span ${span} / span ${span}`, overflow: "hidden", borderRadius: imageRadius, border: `1px solid ${borderColor}`, background: cardBg }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt || img.caption || ""} style={{ width: "100%", height: imageHeight, objectFit: "cover", display: "block" }} />
                </div>
              );
            })}
          </div>
        )}

        {layout === "strip" && (
          <div className="gallery-strip">
            {images.map((img, i) => (
              <div key={i} style={{ overflow: "hidden", borderRadius: imageRadius, border: `1px solid ${borderColor}`, background: cardBg }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt || img.caption || ""} style={{ width: "100%", height: imageHeight, objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>
        )}

        {(layout === "grid" || !["masonry", "collage", "strip"].includes(layout)) && (
          <div className="gallery-grid">
            {images.map((img, i) => (
              <div key={i} style={{ overflow: "hidden", borderRadius: imageRadius, border: `1px solid ${borderColor}`, background: cardBg }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt || img.caption || ""} style={{ width: "100%", height: imageHeight, objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
