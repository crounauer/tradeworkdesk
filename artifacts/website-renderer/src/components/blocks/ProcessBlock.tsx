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
  const steps = (Array.isArray(content.steps) ? content.steps : Array.isArray(content.items) ? content.items : []) as Step[];
  const isModernTradePayload = isModernTemplateContent(content);

  const heading = String(content.heading || content.title || "How It Works");
  const subheading = String(content.subheading || content.subtitle || "");
  const label = String(content.label || content.eyebrow || "");
  const ctaText = String(content.cta_text || content.primaryCtaLabel || content.primaryButtonText || "");
  const ctaUrl = String(content.cta_url || content.primaryCtaHref || content.primaryButtonUrl || "");

  const accentColor = String(content.accent_color || "#0d9488");
  const sectionBg = String(content.section_bg || content.background_color || (isModernTradePayload ? "#020617" : "#ffffff"));
  const cardBg = String(content.card_bg || (isModernTradePayload ? "#0f172a" : "#f9fafb"));
  const borderColor = String(content.border_color || (isModernTradePayload ? "#334155" : "#e5e7eb"));
  const headingColor = String(content.heading_color || (isModernTradePayload ? "#ffffff" : "#111827"));
  const bodyColor = String(content.body_color || (isModernTradePayload ? "#cbd5e1" : "#6b7280"));

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const buttonFont = String(content.button_font_family || content.global_button_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.85rem, 3.2vw, 2.5rem)");
  const bodySize = String(content.body_size || "1rem");

  const layout = String(content.layout_variant || content.layout || "numbered-cards").toLowerCase();
  const radius = String(content.card_radius || "12px");
  const paddingY = String(content.padding_y || "80px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1200px");
  const cols = Math.min(Math.max(steps.length || 4, 1), 4);

  if (!steps.length) return null;

  const contentBlock =
    layout === "timeline" ? (
      <div style={{ display: "grid", gap: 14 }}>
        {steps.map((step, i) => (
          <article key={i} style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr)", gap: 12, alignItems: "start" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: accentColor, color: "#ffffff", display: "grid", placeItems: "center", fontWeight: 800, fontFamily: headingFont, fontSize: "0.92rem", marginTop: 2 }}>
              {step.icon || step.step_number || i + 1}
            </div>
            <div style={{ border: `1px solid ${borderColor}`, background: cardBg, borderRadius: radius, padding: "14px 16px" }}>
              <h3 style={{ margin: "0 0 8px", color: headingColor, fontWeight: 700, fontSize: "1rem", fontFamily: headingFont }}>{step.title}</h3>
              {step.description ? <p style={{ margin: 0, color: bodyColor, lineHeight: 1.7, fontSize: "0.95rem", fontFamily: bodyFont }}>{step.description}</p> : null}
            </div>
          </article>
        ))}
      </div>
    ) : layout === "split-list" ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {steps.map((step, i) => (
          <article key={i} style={{ border: `1px solid ${borderColor}`, background: cardBg, borderRadius: radius, padding: "16px" }}>
            <p style={{ margin: "0 0 8px", color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: bodyFont }}>Step {i + 1}</p>
            <h3 style={{ margin: "0 0 8px", color: headingColor, fontWeight: 700, fontSize: "1.05rem", fontFamily: headingFont }}>{step.title}</h3>
            {step.description ? <p style={{ margin: 0, color: bodyColor, lineHeight: 1.7, fontSize: "0.95rem", fontFamily: bodyFont }}>{step.description}</p> : null}
          </article>
        ))}
      </div>
    ) : layout === "minimal-steps" ? (
      <div style={{ border: `1px solid ${borderColor}`, background: cardBg, borderRadius: radius, padding: "0 18px" }}>
        {steps.map((step, i) => (
          <div key={i} style={{ borderBottom: i < steps.length - 1 ? `1px solid ${borderColor}` : "none", padding: "14px 0", display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", gap: 12 }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${accentColor}`, color: accentColor, display: "grid", placeItems: "center", fontWeight: 700, fontSize: "0.85rem", fontFamily: headingFont }}>{step.step_number || i + 1}</span>
            <div>
              <h3 style={{ margin: "0 0 5px", color: headingColor, fontWeight: 700, fontSize: "1rem", fontFamily: headingFont }}>{step.title}</h3>
              {step.description ? <p style={{ margin: 0, color: bodyColor, lineHeight: 1.65, fontSize: "0.94rem", fontFamily: bodyFont }}>{step.description}</p> : null}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <>
        <style>{`
          .proc-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
          @media (min-width: 600px) { .proc-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (min-width: 900px) { .proc-grid { grid-template-columns: repeat(${cols}, 1fr); } }
        `}</style>
        <div className="proc-grid">
          {steps.map((step, i) => (
            <div key={i} style={{ backgroundColor: cardBg, borderRadius: radius, padding: "28px 20px", textAlign: "center", border: `1px solid ${borderColor}` }}>
              <div style={{ width: 52, height: 52, backgroundColor: accentColor, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", fontSize: step.icon ? "1.5rem" : "1.25rem", fontWeight: 800, color: "#fff", fontFamily: headingFont }}>
                {step.icon || step.step_number || i + 1}
              </div>
              <h3 style={{ margin: "0 0 10px", fontSize: "1.0625rem", fontWeight: 700, color: headingColor, fontFamily: headingFont }}>{step.title}</h3>
              {step.description ? <p style={{ margin: 0, color: bodyColor, fontSize: "0.9375rem", lineHeight: 1.65, fontFamily: bodyFont }}>{step.description}</p> : null}
            </div>
          ))}
        </div>
      </>
    );

  return (
    <section style={{ backgroundColor: sectionBg, padding: `${paddingY} ${paddingX}` }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        <div style={{ textAlign: layout === "split-list" ? "left" : "center", marginBottom: 36 }}>
          {label ? (
            <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFont }}>
              {label}
            </p>
          ) : null}
          <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 14px", color: headingColor, fontFamily: headingFont }}>
            {heading}
          </h2>
          {subheading ? (
            <p style={{ color: bodyColor, fontSize: bodySize, maxWidth: 700, margin: layout === "split-list" ? "0" : "0 auto", fontFamily: bodyFont }}>
              {subheading}
            </p>
          ) : null}
        </div>

        {contentBlock}

        {ctaText && ctaUrl ? (
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <a
              href={ctaUrl}
              style={{ display: "inline-block", padding: "13px 32px", backgroundColor: accentColor, color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "1rem", fontFamily: buttonFont }}
            >
              {ctaText}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
