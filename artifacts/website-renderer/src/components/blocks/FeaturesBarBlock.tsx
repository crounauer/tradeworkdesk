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
  const features = (
    Array.isArray(content.features) ? content.features
    : Array.isArray(content.items) ? content.items
    : []
  ) as Feature[];

  const {
    accent_color,
    background_color = accent_color || "#0d9488",
    text_color = "#ffffff",
    columns,
  } = content;

  if (!features.length) return null;

  const cols = columns ?? Math.min(features.length, 4);

  return (
    <section style={{ padding: "36px 24px", backgroundColor: "transparent" }}>
      <style>{`
        .fbar-grid { display: grid; grid-template-columns: 1fr; gap: 28px; }
        @media (min-width: 600px) { .fbar-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 900px) { .fbar-grid { grid-template-columns: repeat(${cols}, 1fr); } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto", backgroundColor: background_color, color: text_color, borderRadius: 16, padding: "32px 28px" }}>
        <div className="fbar-grid">
          {features.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              {f.icon && (
                <div style={{ width: 48, height: 48, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>
                  {f.icon}
                </div>
              )}
              <div>
                <p style={{ margin: "0 0 5px", fontSize: "0.9375rem", fontWeight: 700, color: text_color }}>{f.title}</p>
                {f.description && (
                  <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.55, color: text_color, opacity: 0.82 }}>
                    {f.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
