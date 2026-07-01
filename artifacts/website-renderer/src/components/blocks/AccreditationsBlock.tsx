"use client";

interface Badge {
  name: string;
  label?: string;
  logo_url?: string;
  description?: string;
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
  const normalizedBadges = (content.badges || []).map((badge) => ({
    ...badge,
    name: badge.name || badge.label || "Badge",
  }));
  const hasDescriptions = normalizedBadges.some((badge) => Boolean(badge.description));

  const {
    heading = "Accreditations",
    background_color = "#f9fafb",
    text_color,
    show_heading = true,
  } = content;

  if (!normalizedBadges.length) return null;

  const isDark = background_color === "dark" || (background_color && background_color !== "#f9fafb" && background_color.startsWith("#0") || background_color?.startsWith("#1"));
  const resolvedBg = background_color === "dark" ? "#111827" : background_color;
  const resolvedText = text_color ?? (isDark ? "#9ca3af" : "#374151");
  const headingColor = isDark ? "#ffffff" : "#374151";

  if (hasDescriptions) {
    return (
      <section style={{ backgroundColor: "#f8fafc", padding: "40px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {normalizedBadges.map((badge, i) => (
              <div key={i} style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 16px" }}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>{badge.name}</p>
                {badge.description && <p style={{ margin: 0, color: "#475569", fontSize: "0.875rem", lineHeight: 1.6 }}>{badge.description}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: "40px 24px", backgroundColor: "transparent" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ backgroundColor: resolvedBg, borderRadius: 16, padding: "34px 28px", textAlign: "center" }}>
        {show_heading && heading && (
          <p style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 28, color: headingColor, letterSpacing: "0.04em" }}>
            {heading}
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "center" }}>
          {(normalizedBadges as Badge[]).map((badge, i) => (
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
      </div>
    </section>
  );
}
