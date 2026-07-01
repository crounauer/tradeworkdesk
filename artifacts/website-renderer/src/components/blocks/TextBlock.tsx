"use client";

import { sanitizeTenantHtml } from "@/lib/sanitize-html";

interface Props {
  content: {
    html?: string;
    text?: string;
    align?: "left" | "center" | "right";
  } & Record<string, unknown>;
}

export default function TextBlock({ content }: Props) {
  // Support both field names: 'html' (current) and 'body' (legacy editor name)
  const html = (content.html || content.body) as string | undefined;
  const safeHtml = sanitizeTenantHtml(html);
  const text = content.text as string | undefined;
  const align = (content.align as "left" | "center" | "right") ?? "left";
  const title = content.title as string | undefined;
  const eyebrow = content.eyebrow as string | undefined;
  const subtitle = content.subtitle as string | undefined;
  const isModernTradePayload = Boolean(title || eyebrow || subtitle);

  if (isModernTradePayload) {
    return (
      <section style={{ padding: "80px 24px", backgroundColor: "#ffffff" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {eyebrow && <p style={{ color: "#d97706", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>{eyebrow}</p>}
          {title && <h2 style={{ margin: "0 0 14px", color: "#0f172a", fontWeight: 800, fontSize: "clamp(1.85rem, 3.2vw, 2.5rem)" }}>{title}</h2>}
          {subtitle && <p style={{ margin: "0 0 20px", color: "#475569", lineHeight: 1.7 }}>{subtitle}</p>}
          {safeHtml && <div style={{ color: "#334155", lineHeight: 1.9 }} dangerouslySetInnerHTML={{ __html: safeHtml }} />}
          {!safeHtml && text && <p style={{ color: "#334155", lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{text}</p>}
        </div>
      </section>
    );
  }

  if (safeHtml) {
    return (
      <section style={{ padding: "48px 24px" }}>
        <div
          style={{ maxWidth: 800, margin: "0 auto", textAlign: align }}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </section>
    );
  }

  if (text) {
    return (
      <section style={{ padding: "48px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: align }}>
          <p style={{ whiteSpace: "pre-wrap" }}>{text}</p>
        </div>
      </section>
    );
  }

  return null;
}
