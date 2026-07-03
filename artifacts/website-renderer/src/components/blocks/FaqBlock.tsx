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

function FaqRow({ item, accent }: { item: FaqItem; accent: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #e5e7eb" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "18px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
      >
        <span style={{ fontWeight: 600, color: "#111827", fontSize: "1rem" }}>{item.question}</span>
        <span style={{ color: accent, fontSize: "1.25rem", flexShrink: 0, transform: open ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
      </button>
      {open && (
        <div style={{ paddingBottom: 18, color: "#6b7280", lineHeight: 1.7, fontSize: "0.9375rem" }}>
          {item.answer}
        </div>
      )}
    </div>
  );
}

export default function FaqBlock({ content }: Props) {
  const {
    accent_color = "#f97316",
    background_color = "#f9fafb",
  } = content;
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
    <section style={{ padding: "72px 24px", backgroundColor: background_color }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div style={{ maxWidth: isModernTradePayload ? 960 : 800, margin: "0 auto" }}>
        <div style={{ textAlign: isModernTradePayload ? "left" : "center", marginBottom: 48 }}>
          {label && <p style={{ color: accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>}
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, margin: "0 0 12px", color: "#111827" }}>{heading}</h2>
          {subheading && <p style={{ color: "#6b7280", fontSize: "1.0625rem" }}>{subheading}</p>}
        </div>
        {isModernTradePayload ? (
          <div style={{ backgroundColor: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {items.map((item, i) => (
              <details key={i} style={{ borderTop: i === 0 ? "none" : "1px solid #e2e8f0", padding: "20px 24px" }}>
                <summary style={{ cursor: "pointer", listStyle: "none", fontWeight: 700, color: "#0f172a" }}>{item.question}</summary>
                <p style={{ margin: "10px 0 0", color: "#475569", lineHeight: 1.7 }}>{item.answer}</p>
              </details>
            ))}
          </div>
        ) : (
          <div style={{ backgroundColor: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "0 28px" }}>
            {items.map((item, i) => (
              <FaqRow key={i} item={item} accent={accent_color} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
