interface FeatureCard {
  title: string;
  description?: string;
  icon?: string;
  cta_text?: string;
  cta_url?: string;
}

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    cards?: FeatureCard[];
    features?: FeatureCard[];
    items?: FeatureCard[];
    accent_color?: string;
  } & Record<string, unknown>;
}

export default function FeatureCardsBlock({ content }: Props) {
  const cards = (Array.isArray(content.cards) ? content.cards : Array.isArray(content.features) ? content.features : Array.isArray(content.items) ? content.items : []) as FeatureCard[];
  const heading = content.heading || "Features";
  const accent = content.accent_color || "#0d9488";

  if (!cards.length) return null;

  return (
    <section style={{ padding: "72px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          {content.label && <p style={{ color: accent, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{content.label}</p>}
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, margin: "0 0 12px", color: "#111827" }}>{heading}</h2>
          {content.subheading && <p style={{ color: "#6b7280", fontSize: "1.0625rem", maxWidth: 720, margin: "0 auto" }}>{content.subheading}</p>}
        </div>
        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {cards.map((card, index) => (
            <div key={index} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}>
              {card.icon && <div style={{ fontSize: "1.5rem", marginBottom: 16, color: accent }}>{card.icon}</div>}
              <h3 style={{ margin: "0 0 10px", fontSize: "1.05rem", fontWeight: 700, color: "#111827" }}>{card.title}</h3>
              {card.description && <p style={{ margin: "0 0 16px", color: "#6b7280", lineHeight: 1.7, fontSize: "0.9375rem" }}>{card.description}</p>}
              {card.cta_text && card.cta_url && <a href={card.cta_url} style={{ color: accent, fontWeight: 700, textDecoration: "none" }}>{card.cta_text}</a>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}