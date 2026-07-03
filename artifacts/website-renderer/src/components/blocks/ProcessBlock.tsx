"use client";

import { isModernTemplateContent } from "@/lib/siteTheme";

interface Step {
  title: string;
  description?: string;
  icon?: string;
  step_number?: number;
}

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    steps?: Step[];
    items?: Step[];
    cta_text?: string;
    cta_url?: string;
    background_color?: string;
    accent_color?: string;
  } & Record<string, unknown>;
}

export default function ProcessBlock({ content }: Props) {
  const steps = (
    Array.isArray(content.steps) ? content.steps
    : Array.isArray(content.items) ? content.items
    : []
  ) as Step[];

  const {
    heading = "How It Works",
    subheading,
    label,
    cta_text,
    cta_url,
    background_color = "#ffffff",
    accent_color = "#0d9488",
  } = content;
  const isModernTradePayload = isModernTemplateContent(content);

  const cols = Math.min(steps.length || 4, 4);

  if (isModernTradePayload) {
    return (
      <section style={{ backgroundColor: "#020617", color: "#ffffff", padding: "80px 24px" }}>
        <style>{`
          .proc-modern-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
          @media (min-width: 900px) { .proc-modern-grid { grid-template-columns: repeat(${cols}, 1fr); } }
        `}</style>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {label && <p style={{ color: "#fbbf24", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>{label}</p>}
          <h2 style={{ margin: "0 0 14px", fontWeight: 800, fontSize: "clamp(1.85rem, 3.2vw, 2.5rem)" }}>{heading}</h2>
          {subheading && <p style={{ margin: "0 0 20px", color: "#cbd5e1" }}>{subheading}</p>}
          <div className="proc-modern-grid">
            {steps.map((step, i) => (
              <article key={i} style={{ backgroundColor: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: "20px" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 700 }}>{step.title}</h3>
                {step.description && <p style={{ margin: 0, color: "#cbd5e1", fontSize: "0.92rem", lineHeight: 1.7 }}>{step.description}</p>}
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ backgroundColor: background_color, padding: "72px 24px" }}>
      <style>{`
        .proc-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 600px) { .proc-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 900px) { .proc-grid { grid-template-columns: repeat(${cols}, 1fr); } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          {label && (
            <p style={{ color: accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              {label}
            </p>
          )}
          {heading && (
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, margin: "0 0 14px", color: "#111827" }}>
              {heading}
            </h2>
          )}
          {subheading && (
            <p style={{ color: "#6b7280", fontSize: "1.0625rem", maxWidth: 560, margin: "0 auto" }}>
              {subheading}
            </p>
          )}
        </div>
        <div className="proc-grid">
          {steps.map((step, i) => (
            <div key={i} style={{ backgroundColor: "#f9fafb", borderRadius: 12, padding: "32px 24px", textAlign: "center", border: "1px solid #e5e7eb" }}>
              <div style={{ width: 52, height: 52, backgroundColor: accent_color, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: step.icon ? "1.5rem" : "1.25rem", fontWeight: 800, color: "#fff" }}>
                {step.icon || (step.step_number ?? i + 1)}
              </div>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.0625rem", fontWeight: 700, color: "#111827" }}>
                {step.title}
              </h3>
              {step.description && (
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9375rem", lineHeight: 1.65 }}>
                  {step.description}
                </p>
              )}
            </div>
          ))}
        </div>
        {cta_text && cta_url && (
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <a
              href={cta_url}
              style={{ display: "inline-block", padding: "13px 32px", backgroundColor: accent_color, color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "1rem" }}
            >
              {cta_text}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
