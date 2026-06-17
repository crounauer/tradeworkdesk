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
  if (!images.length) return null;

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
