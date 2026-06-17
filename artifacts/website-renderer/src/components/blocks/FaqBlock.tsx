"use client";

import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
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
    heading = "Frequently Asked Questions",
    subheading,
    label,
    accent_color = "#f97316",
    background_color = "#f9fafb",
  } = content;
  const items = (Array.isArray(content.faqs) ? content.faqs : Array.isArray(content.items) ? content.items : []) as FaqItem[];
  if (!items.length) return null;

  return (
    <section style={{ padding: "72px 24px", backgroundColor: background_color }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          {label && <p style={{ color: accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>}
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, margin: "0 0 12px", color: "#111827" }}>{heading}</h2>
          {subheading && <p style={{ color: "#6b7280", fontSize: "1.0625rem" }}>{subheading}</p>}
        </div>
        <div style={{ backgroundColor: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", padding: "0 28px" }}>
          {items.map((item, i) => (
            <FaqRow key={i} item={item} accent={accent_color} />
          ))}
        </div>
      </div>
    </section>
  );
}
