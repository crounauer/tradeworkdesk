"use client";

interface Props {
  content: {
    html?: string;
    text?: string;
    align?: "left" | "center" | "right";
  } & Record<string, unknown>;
}

export default function TextBlock({ content }: Props) {
  const { html, text, align = "left" } = content;

  if (html) {
    return (
      <section style={{ padding: "48px 24px" }}>
        <div
          style={{ maxWidth: 800, margin: "0 auto", textAlign: align }}
          // Safe: html content is authored by the tenant via the CMS, not user-submitted
          dangerouslySetInnerHTML={{ __html: html }}
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
