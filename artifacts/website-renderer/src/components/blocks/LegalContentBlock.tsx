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

  return (
    <section style={{ padding: "64px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {heading && <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 20px", color: "#111827" }}>{heading}</h2>}
        {body ? (
          <div style={{ lineHeight: 1.9, color: "#374151" }} dangerouslySetInnerHTML={{ __html: body }} />
        ) : (
          <p style={{ color: "#6b7280" }}>No legal content has been added yet.</p>
        )}
      </div>
    </section>
  );
}