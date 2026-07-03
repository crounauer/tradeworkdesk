import { sanitizeTenantHtml } from "@/lib/sanitize-html";
import { isModernTemplateContent } from "@/lib/siteTheme";

interface Props {
  content: {
    heading?: string;
    body?: string;
    html?: string;
    text?: string;
  } & Record<string, unknown>;
}

export default function LegalContentBlock({ content }: Props) {
  const heading = content.heading || "Legal";
  const body = (content.html || content.body || content.text) as string | undefined;
  const safeBody = sanitizeTenantHtml(body);
  const label = (content.label || content.eyebrow) as string | undefined;
  const isModernTradePayload = isModernTemplateContent(content);

  if (isModernTradePayload) {
    return (
      <section style={{ padding: "80px 24px", backgroundColor: "#ffffff" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {label && <p style={{ color: "#d97706", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>{label}</p>}
          <h2 style={{ margin: "0 0 16px", color: "#0f172a", fontSize: "clamp(1.85rem, 3.2vw, 2.5rem)", fontWeight: 800 }}>{heading}</h2>
          {safeBody ? (
            <div style={{ lineHeight: 1.9, color: "#334155" }} dangerouslySetInnerHTML={{ __html: safeBody }} />
          ) : (
            <p style={{ color: "#64748b" }}>No legal content has been added yet.</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: "64px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {heading && <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 20px", color: "#111827" }}>{heading}</h2>}
        {safeBody ? (
          <div style={{ lineHeight: 1.9, color: "#374151" }} dangerouslySetInnerHTML={{ __html: safeBody }} />
        ) : (
          <p style={{ color: "#6b7280" }}>No legal content has been added yet.</p>
        )}
      </div>
    </section>
  );
}