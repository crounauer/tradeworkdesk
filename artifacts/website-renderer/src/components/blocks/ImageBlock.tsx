"use client";

interface Props {
  content: {
    url?: string;
    alt?: string;
    caption?: string;
    width?: "full" | "contained";
  } & Record<string, unknown>;
}

export default function ImageBlock({ content }: Props) {
  const { url, alt = "", caption, width = "contained" } = content;
  if (!url) return null;

  return (
    <section style={{ padding: "32px 24px" }}>
      <div style={{ maxWidth: width === "full" ? "100%" : 960, margin: "0 auto", textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} style={{ maxWidth: "100%", borderRadius: 8 }} />
        {caption && <p style={{ marginTop: 8, fontSize: "0.875rem", color: "#666" }}>{caption}</p>}
      </div>
    </section>
  );
}
