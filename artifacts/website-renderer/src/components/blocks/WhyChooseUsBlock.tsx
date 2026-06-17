"use client";

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
    cta_text?: string;
    cta_url?: string;
    background_color?: string;
    text_color?: string;
    accent_color?: string;
  } & Record<string, unknown>;
}

export default function WhyChooseUsBlock({ content }: Props) {
  const {
    heading = "Why Choose Us",
    subheading,
    label,
    features = [],
    cta_text,
    cta_url,
    background_color = "#1c2942",
    text_color = "#ffffff",
    accent_color = "#f97316",
  } = content;

  return (
    <section style={{ backgroundColor: background_color, color: text_color, padding: "72px 24px" }}>
      <style>{`
        .wcu-grid { display: grid; grid-template-columns: 1fr; gap: 28px; }
        @media (min-width: 600px) { .wcu-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 900px) { .wcu-grid { grid-template-columns: repeat(${Math.min((features as Feature[]).length || 4, 4)}, 1fr); } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          {label && <p style={{ color: accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>}
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, margin: "0 0 14px" }}>{heading}</h2>
          {subheading && <p style={{ opacity: 0.8, fontSize: "1.0625rem", maxWidth: 560, margin: "0 auto" }}>{subheading}</p>}
        </div>
        <div className="wcu-grid">
          {(features as Feature[]).map((f, i) => (
            <div key={i} style={{ textAlign: "center", padding: "8px" }}>
              {f.icon && (
                <div style={{ width: 60, height: 60, backgroundColor: "rgba(249,115,22,0.15)", border: `2px solid ${accent_color}`, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", margin: "0 auto 18px" }}>
                  {f.icon}
                </div>
              )}
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, marginBottom: 10 }}>{f.title}</h3>
              {f.description && <p style={{ opacity: 0.75, fontSize: "0.9375rem", lineHeight: 1.65, margin: 0 }}>{f.description}</p>}
            </div>
          ))}
        </div>
        {cta_text && cta_url && (
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <a href={cta_url} style={{ display: "inline-block", padding: "13px 32px", backgroundColor: accent_color, color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "1rem" }}>
              {cta_text} ›
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
