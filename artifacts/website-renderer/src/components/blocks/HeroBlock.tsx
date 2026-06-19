"use client";

interface Stat {
  value: string;
  label: string;
}

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
    heading_accent?: string;
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
    layout?: "full" | "split";
    hero_image_url?: string;
    accent_color?: string;
    badges?: Badge[];
    trust_items?: TrustItem[];
    stats?: Stat[];
    emergency_text?: string;
    emergency_phone?: string;
    min_height?: string;
    overlay_opacity?: number;
  } & Record<string, unknown>;
}

export default function HeroBlock({ content }: Props) {
  const {
    heading,
    heading_accent,
    subheading,
    cta_text,
    cta_url,
    cta_phone,
    secondary_cta_text,
    secondary_cta_url,
    background_image_url,
    background_color,
    text_color,
    align = "left",
    layout = "full",
    hero_image_url,
    accent_color = "#f97316",
    badges = [],
    trust_items = [],
    stats = [],
    emergency_text,
    emergency_phone,
    min_height = "500px",
    overlay_opacity = 0.55,
  } = content;

  const isSplit = layout === "split";

  // Split layout defaults to light background
  const bgColor = background_color ?? (isSplit ? "#ffffff" : "#1c2942");
  const txtColor = text_color ?? (isSplit ? "#111827" : "#ffffff");

  const overlayColor = `rgba(0,0,0,${overlay_opacity})`;
  const bgStyle: React.CSSProperties = !isSplit && background_image_url
    ? { background: `linear-gradient(${overlayColor}, ${overlayColor}), url(${background_image_url}) center/cover no-repeat` }
    : { backgroundColor: bgColor };

  const isPostcodeCta = (cta_text || "").toLowerCase().includes("postcode");
  const primaryHref = cta_phone
    ? `tel:${cta_phone.replace(/\s/g, "")}`
    : (isPostcodeCta ? "#postcode-checker" : (cta_url || "#contact"));
  const primaryLabel = cta_text || (cta_phone ? `Call Now: ${cta_phone}` : "Get a Quote");
  const textAlign = align === "center" ? "center" : "left";
  const isDark = !isSplit;

  // Render heading with optional accent word highlighted
  function renderHeading() {
    if (!heading) return null;
    const fontSize = "clamp(1.9rem, 4.5vw, 3rem)";
    const style: React.CSSProperties = { fontSize, fontWeight: 800, margin: "0 0 16px", lineHeight: 1.15, color: txtColor };
    if (heading_accent && heading.includes(heading_accent)) {
      const parts = heading.split(heading_accent);
      return (
        <h1 style={style}>
          {parts[0]}<span style={{ color: accent_color }}>{heading_accent}</span>{parts.slice(1).join(heading_accent)}
        </h1>
      );
    }
    return <h1 style={style}>{heading}</h1>;
  }

  const badgeBg = isDark ? "rgba(255,255,255,0.15)" : `${accent_color}18`;
  const badgeBorder = isDark ? "1px solid rgba(255,255,255,0.25)" : `1px solid ${accent_color}44`;
  const badgeTxt = isDark ? txtColor : accent_color;
  const secondaryBorderColor = isDark ? "rgba(255,255,255,0.65)" : "#d1d5db";

  const contentBlock = (
    <div style={{ flex: 1, minWidth: 0, textAlign: isSplit ? "left" : textAlign }}>
      {/* Badges */}
      {(badges as Badge[]).length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22, justifyContent: !isSplit && align === "center" ? "center" : "flex-start" }}>
          {(badges as Badge[]).map((badge, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: badgeBg, border: badgeBorder, borderRadius: 20, padding: "4px 14px", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: badgeTxt }}>
              {badge.icon && <span>{badge.icon}</span>}{badge.label}
            </span>
          ))}
        </div>
      )}

      {renderHeading()}

      {subheading && (
        <p style={{ fontSize: "1.0625rem", color: isDark ? "rgba(255,255,255,0.85)" : "#4b5563", margin: "0 0 32px", maxWidth: 540, lineHeight: 1.7 }}>
          {subheading}
        </p>
      )}

      {/* CTA buttons */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: (trust_items as TrustItem[]).length || (stats as Stat[]).length ? 36 : 0 }}>
        <a href={primaryHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", backgroundColor: accent_color, color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "0.9375rem" }}>
          {primaryLabel}
        </a>
        {secondary_cta_text && (secondary_cta_url || cta_url) && (
          <a href={secondary_cta_url || cta_url || "#"} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 26px", backgroundColor: "transparent", color: txtColor, border: `2px solid ${secondaryBorderColor}`, borderRadius: 6, textDecoration: "none", fontWeight: 600, fontSize: "0.9375rem" }}>
            {secondary_cta_text}
          </a>
        )}
      </div>

      {/* Stats row */}
      {(stats as Stat[]).length > 0 && (
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap", marginBottom: (trust_items as TrustItem[]).length ? 24 : 0 }}>
          {(stats as Stat[]).map((s, i) => (
            <div key={i} style={{ paddingRight: 28, marginRight: 28, borderRight: i < (stats as Stat[]).length - 1 ? `2px solid ${isDark ? "rgba(255,255,255,0.2)" : "#e5e7eb"}` : "none" }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: isDark ? "#fff" : "#111827", lineHeight: 1 }}>{s.value}</div>
              {s.label && <div style={{ fontSize: "0.8125rem", color: isDark ? "rgba(255,255,255,0.65)" : "#6b7280", marginTop: 4 }}>{s.label}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Trust items */}
      {(trust_items as TrustItem[]).length > 0 && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {(trust_items as TrustItem[]).map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.875rem", color: isDark ? "rgba(255,255,255,0.8)" : "#4b5563" }}>
              <span style={{ color: accent_color }}>{item.icon || "✓"}</span> {item.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        .hero-split { display: flex; flex-direction: column; gap: 40px; align-items: center; }
        @media (min-width: 860px) { .hero-split { flex-direction: row; gap: 60px; } }
        .hero-split-img { width: 100%; max-height: 380px; object-fit: cover; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
        @media (min-width: 860px) { .hero-split-img { max-height: 480px; } }
      `}</style>

      <section style={{ ...bgStyle, color: txtColor, padding: isSplit ? "72px 24px 64px" : "80px 24px 64px", minHeight: isSplit ? undefined : min_height, display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", width: "100%" }}>
          {isSplit ? (
            <div className="hero-split">
              {contentBlock}
              {hero_image_url && (
                <div style={{ flex: "0 0 auto", width: "100%", maxWidth: 520 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={hero_image_url} alt="" className="hero-split-img" />
                </div>
              )}
            </div>
          ) : (
            contentBlock
          )}
        </div>
      </section>

      {/* Emergency bar */}
      {(emergency_text || emergency_phone) && (
        <div style={{ backgroundColor: "#dc2626", color: "#fff", padding: "10px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: "0.9375rem" }}>
              <strong>⚠ {emergency_text || "Boiler broken down? Heating failed?"}</strong>
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
