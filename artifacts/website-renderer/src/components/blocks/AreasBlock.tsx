"use client";

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    areas?: string[];
    body_text?: string;
    phone?: string;
    cta_text?: string;
    cta_url?: string;
    accent_color?: string;
    background_color?: string;
    outer_background?: string;
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
    cta_text,
    cta_url,
    accent_color = "#0d9488",
    background_color = "#0d9488",
    outer_background = "#f9fafb",
  } = content;

  const isTealCard = background_color.startsWith("#0") || background_color.startsWith("#1") || background_color === "#0d9488";
  const cardText = isTealCard ? "#ffffff" : "#111827";
  const cardSubText = isTealCard ? "rgba(255,255,255,0.82)" : "#6b7280";
  const pillBg = isTealCard ? "rgba(255,255,255,0.18)" : "#f3f4f6";
  const pillText = isTealCard ? "#ffffff" : "#374151";
  const ctaBg = isTealCard ? "#ffffff" : accent_color;
  const ctaColor = isTealCard ? accent_color : "#ffffff";

  return (
    <section style={{ padding: "72px 24px", backgroundColor: outer_background }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ backgroundColor: background_color, borderRadius: 16, padding: "52px 48px", textAlign: "center" }}>
          {label && (
            <p style={{ color: isTealCard ? "rgba(255,255,255,0.7)" : accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              {label}
            </p>
          )}
          <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 800, margin: "0 0 12px", color: cardText }}>{heading}</h2>
          {subheading && <p style={{ color: cardSubText, fontSize: "1.0625rem", marginBottom: 8, maxWidth: 560, margin: "0 auto 16px" }}>{subheading}</p>}
          {body_text && <p style={{ color: cardSubText, lineHeight: 1.7, fontSize: "0.9375rem", marginBottom: 28, maxWidth: 560, margin: "0 auto 28px" }}>{body_text}</p>}

          {(areas as string[]).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 32 }}>
              {(areas as string[]).map((area, i) => (
                <span key={i} style={{ display: "inline-block", backgroundColor: pillBg, borderRadius: 20, padding: "6px 18px", fontSize: "0.9rem", color: pillText, fontWeight: 500 }}>
                  {area}
                </span>
              ))}
            </div>
          )}

          {phone && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} style={{ display: "inline-block", color: cardText, fontWeight: 700, textDecoration: "none", fontSize: "1rem", marginBottom: 20 }}>
              📞 {phone}
            </a>
          )}

          {cta_text && (
            <div style={{ marginTop: areas.length ? 0 : 16 }}>
              <a
                href={cta_url || "#contact"}
                style={{ display: "inline-block", padding: "12px 32px", backgroundColor: ctaBg, color: ctaColor, borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "0.9375rem" }}
              >
                {cta_text}
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
