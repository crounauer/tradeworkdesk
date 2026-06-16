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
  } & Record<string, unknown>;
}

export default function AccreditationsBlock({ content }: Props) {
  const { heading = "Accreditations", badges = [] } = content;
  if (!badges.length) return null;

  return (
    <section style={{ padding: "48px 24px", backgroundColor: "#f9fafb" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
        {heading && <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 32, color: "#374151" }}>{heading}</h3>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "center" }}>
          {badges.map((badge, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {badge.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={badge.logo_url} alt={badge.name} style={{ height: 60, objectFit: "contain" }} />
              ) : (
                <div style={{
                  width: 80, height: 60, backgroundColor: "#e5e7eb", borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", color: "#9ca3af",
                }}>
                  {badge.name}
                </div>
              )}
              {badge.number && <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>No. {badge.number}</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
