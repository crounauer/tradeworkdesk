"use client";

interface Service {
  title: string;
  description?: string;
  icon?: string;
  cta_text?: string;
  cta_url?: string;
  badge?: string;
}

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    services?: Service[];
    items?: Service[];
    columns?: 2 | 3 | 4;
    accent_color?: string;
  } & Record<string, unknown>;
}

export default function ServicesBlock({ content }: Props) {
  const services = (Array.isArray(content.services) ? content.services : Array.isArray(content.items) ? content.items : []) as Service[];
  const { heading, subheading, label, columns = 3, accent_color = "#f97316" } = content;

  return (
    <section style={{ padding: "72px 24px", backgroundColor: "#f9fafb" }}>
      <style>{`
        .svc-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 600px) { .svc-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 900px) { .svc-grid { grid-template-columns: repeat(${columns}, 1fr); } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {(label || heading || subheading) && (
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            {label && <p style={{ color: accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>}
            {heading && <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, margin: "0 0 14px", color: "#111827" }}>{heading}</h2>}
            {subheading && <p style={{ color: "#6b7280", fontSize: "1.0625rem", maxWidth: 560, margin: "0 auto" }}>{subheading}</p>}
          </div>
        )}
        <div className="svc-grid">
          {services.map((service, i) => (
            <div key={i} style={{ backgroundColor: "#fff", borderRadius: 10, padding: "28px 24px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
              {service.badge && (
                <span style={{ display: "inline-block", backgroundColor: "#fef3c7", color: "#92400e", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 4, padding: "2px 8px", marginBottom: 14, alignSelf: "flex-start" }}>
                  {service.badge}
                </span>
              )}
              {service.icon && (
                <div style={{ width: 48, height: 48, backgroundColor: "#fff7ed", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: 16 }}>
                  {service.icon}
                </div>
              )}
              <h3 style={{ margin: "0 0 10px", fontSize: "1.0625rem", fontWeight: 700, color: "#111827" }}>{service.title}</h3>
              {service.description && <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: "0.9375rem", lineHeight: 1.65, flex: 1 }}>{service.description}</p>}
              {service.cta_url && (
                <a href={service.cta_url} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: accent_color, fontWeight: 600, fontSize: "0.9rem", textDecoration: "none", marginTop: "auto" }}>
                  {service.cta_text || "Get a quote"} <span style={{ fontSize: "1rem" }}>›</span>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


interface Props {
  content: {
    heading?: string;
    services?: Service[];
    columns?: 2 | 3 | 4;
  } & Record<string, unknown>;
}

export default function ServicesBlock({ content }: Props) {
  // Support both field names: 'services' (current) and 'items' (legacy editor name)
  const services = (Array.isArray(content.services) ? content.services : Array.isArray(content.items) ? content.items : []) as Service[];
  const { heading, columns = 3 } = content;
  const gridId = `sg-${columns}`;

  return (
    <section style={{ padding: "64px 24px", backgroundColor: "#f9fafb" }}>
      <style>{`
        .services-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 600px) { .services-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 900px) { .services-grid { grid-template-columns: repeat(${columns}, 1fr); } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {heading && (
          <h2 style={{ textAlign: "center", fontSize: "2rem", fontWeight: 700, marginBottom: 48 }}>
            {heading}
          </h2>
        )}
        <div className="services-grid">
          {services.map((service, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#fff",
                borderRadius: 8,
                padding: "24px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              {service.icon && <div style={{ fontSize: "2rem", marginBottom: 12 }}>{service.icon}</div>}
              <h3 style={{ margin: "0 0 8px", fontSize: "1.125rem", fontWeight: 600 }}>{service.title}</h3>
              {service.description && <p style={{ margin: 0, color: "#666", fontSize: "0.9375rem" }}>{service.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
