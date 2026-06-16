"use client";

interface Service {
  title: string;
  description?: string;
  icon?: string;
}

interface Props {
  content: {
    heading?: string;
    services?: Service[];
    columns?: 2 | 3 | 4;
  } & Record<string, unknown>;
}

export default function ServicesBlock({ content }: Props) {
  const { heading, services = [], columns = 3 } = content;

  return (
    <section style={{ padding: "64px 24px", backgroundColor: "#f9fafb" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {heading && (
          <h2 style={{ textAlign: "center", fontSize: "2rem", fontWeight: 700, marginBottom: 48 }}>
            {heading}
          </h2>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 24,
          }}
        >
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
