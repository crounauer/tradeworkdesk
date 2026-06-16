"use client";

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    cta_text?: string;
    cta_url?: string;
    background_color?: string;
    text_color?: string;
  } & Record<string, unknown>;
}

export default function CtaBlock({ content }: Props) {
  const {
    heading,
    subheading,
    cta_text,
    cta_url,
    background_color = "#f97316",
    text_color = "#ffffff",
  } = content;

  return (
    <section
      style={{
        padding: "64px 24px",
        backgroundColor: background_color,
        color: text_color,
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {heading && <h2 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 16px" }}>{heading}</h2>}
        {subheading && <p style={{ fontSize: "1.125rem", opacity: 0.9, margin: "0 0 32px" }}>{subheading}</p>}
        {cta_text && cta_url && (
          <a
            href={cta_url}
            style={{
              display: "inline-block",
              padding: "14px 32px",
              backgroundColor: "#fff",
              color: background_color,
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: "1.1rem",
            }}
          >
            {cta_text}
          </a>
        )}
      </div>
    </section>
  );
}
