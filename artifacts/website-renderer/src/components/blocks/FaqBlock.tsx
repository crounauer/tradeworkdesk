"use client";

import { useState } from "react";
import { isModernTemplateContent } from "@/lib/siteTheme";

interface FaqItem {
  question: string;
  answer: string;
}

interface Props {
  content: {
    heading?: string;
    title?: string;
    subheading?: string;
    subtitle?: string;
    label?: string;
    eyebrow?: string;
    items?: FaqItem[];
    faqs?: FaqItem[];
    accent_color?: string;
    background_color?: string;
  } & Record<string, unknown>;
}

function FaqRow({ item, accent, headingColor, bodyColor, borderColor, headingFont, bodyFont }: { item: FaqItem; accent: string; headingColor: string; bodyColor: string; borderColor: string; headingFont: string; bodyFont: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${borderColor}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "18px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
      >
        <span style={{ fontWeight: 600, color: headingColor, fontSize: "1rem", fontFamily: headingFont }}>{item.question}</span>
        <span style={{ color: accent, fontSize: "1.25rem", flexShrink: 0, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
      </button>
      {open && (
        <div style={{ paddingBottom: 18, color: bodyColor, lineHeight: 1.7, fontSize: "0.9375rem", fontFamily: bodyFont }}>
          {item.answer}
        </div>
      )}
    </div>
  );
}

export default function FaqBlock({ content }: Props) {
  const accentColor = String(content.accent_color || "#f97316");
  const backgroundColor = String(content.section_bg || content.background_color || "#f9fafb");
  const cardBg = String(content.card_bg || "#ffffff");
  const borderColor = String(content.border_color || "#e5e7eb");
  const headingColor = String(content.heading_color || content.text_color || "#111827");
  const bodyColor = String(content.body_color || content.muted_text_color || "#6b7280");
  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const layout = String(content.layout_variant || content.layout || "accordion-card").toLowerCase();
  const headingSize = String(content.heading_size || "clamp(1.75rem, 3vw, 2.25rem)");
  const bodySize = String(content.body_size || "1.0625rem");
  const radius = String(content.card_radius || "10px");
  const paddingY = String(content.padding_y || "72px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || (isModernTemplateContent(content) ? "960px" : "800px"));
  const heading = (content.heading || content.title || "Frequently Asked Questions") as string;
  const subheading = (content.subheading || content.subtitle) as string | undefined;
  const label = (content.label || content.eyebrow) as string | undefined;
  const isModernTradePayload = isModernTemplateContent(content);
  const items = (Array.isArray(content.faqs) ? content.faqs : Array.isArray(content.items) ? content.items : []) as FaqItem[];
  if (!items.length) return null;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, backgroundColor }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div style={{ maxWidth, margin: "0 auto" }}>
        <div style={{ textAlign: layout === "split-panels" ? "left" : isModernTradePayload ? "left" : "center", marginBottom: 30 }}>
          {label && <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFont }}>{label}</p>}
          <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 12px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
          {subheading && <p style={{ color: bodyColor, fontSize: bodySize, fontFamily: bodyFont }}>{subheading}</p>}
        </div>

        {layout === "minimal-list" && (
          <div style={{ backgroundColor: cardBg, borderRadius: radius, border: `1px solid ${borderColor}`, padding: "0 20px" }}>
            {items.map((item, i) => (
              <FaqRow key={i} item={item} accent={accentColor} headingColor={headingColor} bodyColor={bodyColor} borderColor={borderColor} headingFont={headingFont} bodyFont={bodyFont} />
            ))}
          </div>
        )}

        {layout === "stacked-cards" && (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((item, i) => (
              <details key={i} style={{ borderRadius: radius, border: `1px solid ${borderColor}`, background: cardBg, padding: "16px 18px" }}>
                <summary style={{ cursor: "pointer", listStyle: "none", fontWeight: 700, color: headingColor, fontFamily: headingFont }}>{item.question}</summary>
                <p style={{ margin: "10px 0 0", color: bodyColor, lineHeight: 1.7, fontFamily: bodyFont }}>{item.answer}</p>
              </details>
            ))}
          </div>
        )}

        {layout === "split-panels" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {items.map((item, i) => (
              <article key={i} style={{ borderRadius: radius, border: `1px solid ${borderColor}`, background: cardBg, padding: "16px 18px" }}>
                <h3 style={{ margin: "0 0 8px", color: headingColor, fontWeight: 700, fontSize: "1rem", fontFamily: headingFont }}>{item.question}</h3>
                <p style={{ margin: 0, color: bodyColor, lineHeight: 1.7, fontFamily: bodyFont }}>{item.answer}</p>
              </article>
            ))}
          </div>
        )}

        {(layout === "accordion-card" || !["minimal-list", "stacked-cards", "split-panels"].includes(layout)) && (
          <div style={{ backgroundColor: cardBg, borderRadius: radius, border: `1px solid ${borderColor}`, overflow: "hidden", padding: "0 20px" }}>
            {items.map((item, i) => (
              <FaqRow key={i} item={item} accent={accentColor} headingColor={headingColor} bodyColor={bodyColor} borderColor={borderColor} headingFont={headingFont} bodyFont={bodyFont} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
