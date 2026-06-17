"use client";

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    areas?: string[];
    body_text?: string;
    phone?: string;
    accent_color?: string;
    background_color?: string;
  } & Record<string, unknown>;
}

export default function AreasBlock({ content }: Props) {
  const {
    heading = "Areas We Cover",
    subheading,
    label,
    areas = [],
    body_text,
    phone,
    accent_color = "#f97316",
    background_color = "#ffffff",
  } = content;

  return (
    <section style={{ padding: "72px 24px", backgroundColor: background_color }}>
      <style>{`
        .areas-layout { display: grid; grid-template-columns: 1fr; gap: 40px; align-items: start; }
        @media (min-width: 760px) { .areas-layout { grid-template-columns: 1fr 1.5fr; } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="areas-layout">
          {/* Left: text */}
          <div>
            {label && <p style={{ color: accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>}
            <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, margin: "0 0 16px", color: "#111827" }}>{heading}</h2>
            {subheading && <p style={{ color: "#6b7280", fontSize: "1.0625rem", marginBottom: 16 }}>{subheading}</p>}
            {body_text && <p style={{ color: "#6b7280", lineHeight: 1.7, fontSize: "0.9375rem", marginBottom: 24 }}>{body_text}</p>}
            {phone && (
              <a href={`tel:${phone.replace(/\s/g, "")}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: accent_color, fontWeight: 700, textDecoration: "none", fontSize: "1rem" }}>
                📞 {phone}
              </a>
            )}
          </div>
          {/* Right: area tags */}
          <div>
            {(areas as string[]).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {(areas as string[]).map((area, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#f3f4f6", borderRadius: 20, padding: "6px 16px", fontSize: "0.9rem", color: "#374151", fontWeight: 500 }}>
                    <span style={{ color: accent_color, fontSize: "0.75rem" }}>◉</span> {area}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
