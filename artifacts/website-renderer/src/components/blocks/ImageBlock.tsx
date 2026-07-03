"use client";

interface Props {
  content: {
    url?: string;
    image_url?: string;
    alt?: string;
    alt_text?: string;
    caption?: string;
    width?: "full" | "contained" | "wide" | "normal";
    layout?: string;
    layout_variant?: string;
  } & Record<string, unknown>;
}

export default function ImageBlock({ content }: Props) {
  const imageUrl = String(content.image_url || content.url || "");
  const alt = String(content.alt_text || content.alt || "");
  const caption = String(content.caption || "");

  if (!imageUrl) return null;

  const layout = String(content.layout_variant || content.layout || "single-frame").toLowerCase();
  const width = String(content.width || "contained").toLowerCase();

  const sectionBg = String(content.section_bg || "transparent");
  const frameBg = String(content.frame_bg || "#ffffff");
  const borderColor = String(content.border_color || "#e5e7eb");
  const captionColor = String(content.caption_color || "#666666");
  const accentColor = String(content.accent_color || "#0d9488");

  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const captionSize = String(content.caption_size || "0.875rem");
  const radius = String(content.image_radius || "10px");
  const sectionPaddingY = String(content.padding_y || "32px");
  const sectionPaddingX = String(content.padding_x || "24px");

  const maxWidth =
    width === "full" ? "100%"
      : width === "wide" ? "1200px"
      : width === "normal" ? "760px"
      : "960px";

  return (
    <section style={{ padding: `${sectionPaddingY} ${sectionPaddingX}`, background: sectionBg }}>
      <div style={{ maxWidth, margin: "0 auto", textAlign: "center" }}>
        {layout === "single-frame" || !["polaroid", "split-caption", "minimal-edge"].includes(layout) ? (
          <div style={{ background: frameBg, border: `1px solid ${borderColor}`, borderRadius: radius, padding: "8px", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={alt} style={{ maxWidth: "100%", width: "100%", borderRadius: radius, display: "block" }} />
          </div>
        ) : null}

        {layout === "polaroid" ? (
          <div style={{ display: "inline-block", background: frameBg, border: `1px solid ${borderColor}`, borderRadius: radius, padding: "8px 8px 16px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={alt} style={{ maxWidth: "100%", borderRadius: radius, display: "block" }} />
          </div>
        ) : null}

        {layout === "split-caption" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, alignItems: "center" }}>
            <style>{`@media (min-width: 900px){ .img-split-layout { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); text-align: left; } }`}</style>
            <div className="img-split-layout" style={{ display: "grid", gap: 14, alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={alt} style={{ maxWidth: "100%", width: "100%", borderRadius: radius, display: "block", border: `1px solid ${borderColor}` }} />
              <div style={{ textAlign: "left", borderLeft: `4px solid ${accentColor}`, paddingLeft: 12 }}>
                {caption ? <p style={{ margin: 0, color: captionColor, fontSize: captionSize, lineHeight: 1.7, fontFamily: bodyFont }}>{caption}</p> : <p style={{ margin: 0, color: captionColor, fontSize: captionSize, fontFamily: bodyFont }}>Add a caption to describe this image.</p>}
              </div>
            </div>
          </div>
        ) : null}

        {layout === "minimal-edge" ? (
          <div style={{ borderTop: `2px solid ${accentColor}`, paddingTop: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={alt} style={{ maxWidth: "100%", width: "100%", borderRadius: radius, display: "block" }} />
          </div>
        ) : null}

        {caption && layout !== "split-caption" ? (
          <p style={{ marginTop: 8, fontSize: captionSize, color: captionColor, fontFamily: bodyFont }}>{caption}</p>
        ) : null}
      </div>
    </section>
  );
}
