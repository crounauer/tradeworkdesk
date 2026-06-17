"use client";

interface Badge {
  name: string;
  logo_url?: string;
  number?: string;
}

interface Props {
  content: {
    heading?: string;
    badges?: Badge[];
    background_color?: string;
    text_color?: string;
    show_heading?: boolean;
  } & Record<string, unknown>;
}

export default function AccreditationsBlock({ content }: Props) {
  const {
    heading = "Accreditations",
    badges = [],
    background_color = "#f9fafb",
    text_color,
    show_heading = true,
  } = content;

  if (!badges.length) return null;

  const isDark = background_color === "dark" || (background_color && background_color !== "#f9fafb" && background_color.startsWith("#0") || background_color?.startsWith("#1"));
  const resolvedBg = background_color === "dark" ? "#111827" : background_color;
  const resolvedText = text_color ?? (isDark ? "#9ca3af" : "#374151");
  const headingColor = isDark ? "#ffffff" : "#374151";

  return (
    <section style={{ padding: "40px 24px", backgroundColor: resolvedBg }}>
      <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
        {show_heading && heading && (
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 28, color: headingColor, letterSpacing: "0.04em" }}>
            {heading}
          </h3>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "center" }}>
          {(badges as Badge[]).map((badge, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {badge.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={badge.logo_url} alt={badge.name} style={{ height: 52, objectFit: "contain", filter: isDark ? "brightness(0) invert(1)" : "none", opacity: isDark ? 0.75 : 1 }} />
              ) : (
                <div style={{ padding: "8px 20px", backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb", borderRadius: 6, color: resolvedText, fontSize: "0.875rem", fontWeight: 600 }}>
                  {badge.name}
                </div>
              )}
              {badge.number && (
                <span style={{ fontSize: "0.7rem", color: resolvedText }}>No. {badge.number}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
