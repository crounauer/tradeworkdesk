"use client";

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    cta_text?: string;
    cta_url?: string;
    background_image_url?: string;
    background_color?: string;
    text_color?: string;
    align?: "left" | "center" | "right";
  } & Record<string, unknown>;
}

export default function HeroBlock({ content }: Props) {
  const {
    heading,
    subheading,
    cta_text,
    cta_url,
    background_image_url,
    background_color = "#1a1a2e",
    text_color = "#ffffff",
    align = "center",
  } = content;

  const style: React.CSSProperties = {
    background: background_image_url
      ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${background_image_url}) center/cover no-repeat`
      : background_color,
    color: text_color,
    padding: "80px 24px",
    textAlign: align,
  };

  return (
    <section style={style}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {heading && (
          <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 700, margin: "0 0 16px" }}>
            {heading}
          </h1>
        )}
        {subheading && (
          <p style={{ fontSize: "1.25rem", opacity: 0.9, margin: "0 0 32px", maxWidth: 640, marginLeft: align === "center" ? "auto" : undefined, marginRight: align === "center" ? "auto" : undefined }}>
            {subheading}
          </p>
        )}
        {cta_text && cta_url && (
          <a
            href={cta_url}
            style={{
              display: "inline-block",
              padding: "14px 32px",
              backgroundColor: "#f97316",
              color: "#fff",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
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
