"use client";

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
  const text = content.text as string | undefined;
  const align = (content.align as "left" | "center" | "right") ?? "left";

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
