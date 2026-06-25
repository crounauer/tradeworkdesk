interface Props {
  content: {
    heading?: string;
    subheading?: string;
    body?: string;
    text?: string;
    html?: string;
    image_url?: string;
    cta_text?: string;
    cta_url?: string;
    label?: string;
    accent_color?: string;
    background_color?: string;
    text_color?: string;
  } & Record<string, unknown>;
}

export default function DetailSectionBlock({ content }: Props) {
  const heading = content.heading || "Details";
  const body = (content.html || content.body || content.text) as string | undefined;
  const accent = content.accent_color || "#f97316";
  const background = content.background_color || "#ffffff";
  const textColor = content.text_color || "#111827";

  return (
    <section style={{ padding: "72px 24px", backgroundColor: background, color: textColor }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 32, gridTemplateColumns: content.image_url ? "1.1fr 0.9fr" : "1fr", alignItems: "center" }}>
        <div>
          {content.label && <p style={{ color: accent, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{content.label}</p>}
          <h2 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 800, margin: "0 0 14px", lineHeight: 1.15 }}>{heading}</h2>
          {content.subheading && <p style={{ color: "#6b7280", fontSize: "1.0625rem", lineHeight: 1.75, margin: "0 0 20px" }}>{content.subheading}</p>}
          {body && <div style={{ color: "#374151", lineHeight: 1.85, marginBottom: 24 }} dangerouslySetInnerHTML={{ __html: body }} />}
          {content.cta_text && content.cta_url && (
            <a href={content.cta_url} style={{ display: "inline-block", padding: "12px 24px", backgroundColor: accent, color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700 }}>
              {content.cta_text}
            </a>
          )}
        </div>
        {content.image_url && (
          <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 16px 40px rgba(15,23,42,0.12)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content.image_url} alt={heading} style={{ width: "100%", display: "block", objectFit: "cover" }} />
          </div>
        )}
      </div>
    </section>
  );
}