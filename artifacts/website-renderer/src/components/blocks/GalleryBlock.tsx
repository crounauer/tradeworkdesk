"use client";

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
  const { heading, images = [], columns = 3 } = content;
  const label = (content.label || content.eyebrow) as string | undefined;
  const subtitle = content.subtitle as string | undefined;
  const isModernTradePayload = Boolean(content.eyebrow || content.subtitle);
  if (!images.length) return null;

  if (isModernTradePayload) {
    return (
      <section style={{ padding: "80px 24px", backgroundColor: "#ffffff" }}>
        <style>{`
          .gallery-modern-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
          @media (min-width: 700px) { .gallery-modern-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (min-width: 1024px) { .gallery-modern-grid { grid-template-columns: repeat(3, 1fr); } }
        `}</style>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {label && <p style={{ color: "#d97706", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>{label}</p>}
          {heading && <h2 style={{ margin: "0 0 14px", color: "#0f172a", fontWeight: 800, fontSize: "clamp(1.85rem, 3.2vw, 2.5rem)" }}>{heading}</h2>}
          {subtitle && <p style={{ margin: "0 0 20px", color: "#475569" }}>{subtitle}</p>}
          <div className="gallery-modern-grid">
            {images.map((img, i) => (
              <div key={i} style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt || img.caption || ""} style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }} />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: "64px 24px" }}>
      <style>{`
        .gallery-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 500px) { .gallery-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 900px) { .gallery-grid { grid-template-columns: repeat(${columns}, 1fr); } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {heading && (
          <h2 style={{ textAlign: "center", fontSize: "2rem", fontWeight: 700, marginBottom: 40 }}>
            {heading}
          </h2>
        )}
        <div className="gallery-grid">
          {images.map((img, i) => (
            <div key={i} style={{ overflow: "hidden", borderRadius: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt || img.caption || ""}
                style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
