"use client";

interface Badge {
  label: string;
  icon?: string;
}

interface TrustItem {
  text: string;
  icon?: string;
}

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    cta_text?: string;
    cta_url?: string;
    cta_phone?: string;
    secondary_cta_text?: string;
    secondary_cta_url?: string;
    background_image_url?: string;
    background_color?: string;
    text_color?: string;
    align?: "left" | "center" | "right";
    badges?: Badge[];
    trust_items?: TrustItem[];
    emergency_text?: string;
    emergency_phone?: string;
    min_height?: string;
    overlay_opacity?: number;
  } & Record<string, unknown>;
}

export default function HeroBlock({ content }: Props) {
  const {
    heading,
    subheading,
    cta_text,
    cta_url,
    cta_phone,
    secondary_cta_text,
    secondary_cta_url,
    background_image_url,
    background_color = "#1c2942",
    text_color = "#ffffff",
    align = "left",
    badges = [],
    trust_items = [],
    emergency_text,
    emergency_phone,
    min_height = "500px",
    overlay_opacity = 0.55,
  } = content;

  const overlayColor = `rgba(0,0,0,${overlay_opacity})`;
  const bgStyle: React.CSSProperties = background_image_url
    ? { background: `linear-gradient(${overlayColor}, ${overlayColor}), url(${background_image_url}) center/cover no-repeat` }
    : { backgroundColor: background_color };

  const primaryHref = cta_phone ? `tel:${cta_phone.replace(/\s/g, "")}` : (cta_url || "#contact");
  const primaryLabel = cta_text || (cta_phone ? `📞 Call Now: ${cta_phone}` : "Get a Quote");
  const textAlign = align === "center" ? "center" : "left";

  return (
    <>
      <section style={{ ...bgStyle, color: text_color, padding: "80px 24px 64px", minHeight: min_height, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%", textAlign }}>

          {/* Cert badges */}
          {(badges as Badge[]).length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, justifyContent: align === "center" ? "center" : "flex-start" }}>
              {(badges as Badge[]).map((badge, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20, padding: "4px 14px", fontSize: "0.8rem", fontWeight: 500 }}>
                  {badge.icon && <span>{badge.icon}</span>}{badge.label}
                </span>
              ))}
            </div>
          )}

          {/* Heading */}
          {heading && (
            <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", fontWeight: 800, margin: "0 0 16px", lineHeight: 1.15, maxWidth: align === "center" ? "none" : 680 }}>
              {heading}
            </h1>
          )}

          {/* Subheading */}
          {subheading && (
            <p style={{ fontSize: "1.125rem", opacity: 0.88, margin: "0 0 36px", maxWidth: 560, lineHeight: 1.65, marginLeft: align === "center" ? "auto" : undefined, marginRight: align === "center" ? "auto" : undefined }}>
              {subheading}
            </p>
          )}

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", marginBottom: (trust_items as TrustItem[]).length ? 36 : 0 }}>
            <a href={primaryHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", backgroundColor: "#f97316", color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "1rem" }}>
              {primaryLabel}
            </a>
            {secondary_cta_text && secondary_cta_url && (
              <a href={secondary_cta_url} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", backgroundColor: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,0.65)", borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "1rem" }}>
                {secondary_cta_text} ›
              </a>
            )}
          </div>

          {/* Trust items */}
          {(trust_items as TrustItem[]).length > 0 && (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", opacity: 0.82, justifyContent: align === "center" ? "center" : "flex-start" }}>
              {(trust_items as TrustItem[]).map((item, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }}>
                  <span style={{ color: "#f97316" }}>{item.icon || "✓"}</span> {item.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Emergency bar */}
      {(emergency_text || emergency_phone) && (
        <div style={{ backgroundColor: "#dc2626", color: "#fff", padding: "10px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: "0.9375rem" }}>
              <strong>⚠ {emergency_text || "Boiler broken down? Heating failed?"}</strong>{" "}
              <span style={{ opacity: 0.9 }}>Emergency callouts available 7 days a week — including evenings and weekends.</span>
            </span>
            {emergency_phone && (
              <a href={`tel:${emergency_phone.replace(/\s/g, "")}`} style={{ color: "#fff", fontWeight: 700, textDecoration: "none", backgroundColor: "rgba(255,255,255,0.15)", padding: "6px 16px", borderRadius: 4, fontSize: "0.9375rem", whiteSpace: "nowrap" }}>
                📞 Emergency: {emergency_phone}
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
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
