"use client";

import { isModernTemplateContent } from "@/lib/siteTheme";

interface Service {
  title: string;
  description?: string;
  icon?: string;
  cta_text?: string;
  cta_url?: string;
  href?: string;
  badge?: string;
}

interface Props {
  content: {
    heading?: string;
    title?: string;
    subheading?: string;
    subtitle?: string;
    label?: string;
    eyebrow?: string;
    services?: Service[];
    items?: Service[];
    columns?: 2 | 3 | 4;
    accent_color?: string;
  } & Record<string, unknown>;
}

export default function ServicesBlock({ content }: Props) {
  const services = (Array.isArray(content.services) ? content.services : Array.isArray(content.items) ? content.items : []) as Service[];
  const heading = (content.heading || content.title) as string | undefined;
  const subheading = (content.subheading || content.subtitle) as string | undefined;
  const label = (content.label || content.eyebrow) as string | undefined;
  const { columns = 3, accent_color = "#f97316" } = content;
  const isModernTradePayload = isModernTemplateContent(content);
  const schemaServices = services
    .filter((service) => Boolean(service.title))
    .map((service) => {
      const next: Record<string, unknown> = {
        "@type": "Service",
        name: service.title,
      };

      if (service.description) next.description = service.description;
      const href = service.cta_url || service.href;
      if (href && /^https?:\/\//i.test(href)) next.url = href;
      return next;
    });
  const servicesSchema = schemaServices.length > 0
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: schemaServices.map((service, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: service,
        })),
      }
    : null;

  if (isModernTradePayload) {
    return (
      <section style={{ padding: "80px 24px", backgroundColor: "#ffffff" }}>
        {servicesSchema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesSchema) }}
          />
        )}
        <style>{`
          .svc-modern-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
          @media (min-width: 900px) { .svc-modern-grid { grid-template-columns: repeat(3, 1fr); } }
        `}</style>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ maxWidth: 740 }}>
            {label && <p style={{ color: "#d97706", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>{label}</p>}
            {heading && <h2 style={{ fontSize: "clamp(1.85rem, 3.2vw, 2.5rem)", fontWeight: 800, margin: "0 0 14px", color: "#0f172a" }}>{heading}</h2>}
            {subheading && <p style={{ color: "#475569", fontSize: "1.0625rem", margin: 0 }}>{subheading}</p>}
          </div>
          <div className="svc-modern-grid" style={{ marginTop: 36 }}>
            {services.map((service, i) => {
              const serviceHref = service.href || service.cta_url;
              return (
                <article key={i} style={{ backgroundColor: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", padding: "24px" }}>
                  <h3 style={{ margin: "0 0 10px", fontSize: "1.2rem", fontWeight: 700, color: "#0f172a" }}>{service.title}</h3>
                  {service.description && <p style={{ margin: "0 0 14px", color: "#475569", lineHeight: 1.6 }}>{service.description}</p>}
                  {serviceHref && (
                    <a href={serviceHref} style={{ color: "#0f172a", fontWeight: 700, textDecoration: "none", fontSize: "0.95rem" }}>
                      Learn more →
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: "72px 24px", backgroundColor: "#ffffff" }}>
      {servicesSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(servicesSchema) }}
        />
      )}
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
          {services.map((service, i) => {
            const serviceHref = service.href;

            return (
            <div key={i} style={{ backgroundColor: "#fff", borderRadius: 10, padding: "28px 24px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
              {service.badge && (
                <span style={{ display: "inline-block", backgroundColor: "#fef3c7", color: "#92400e", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 4, padding: "2px 8px", marginBottom: 14, alignSelf: "flex-start" }}>
                  {service.badge}
                </span>
              )}
              {service.icon && (
                <div style={{ width: 48, height: 48, backgroundColor: `${accent_color}18`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: 16 }}>
                  {service.icon}
                </div>
              )}
              <h3 style={{ margin: "0 0 10px", fontSize: "1.0625rem", fontWeight: 700, color: "#111827" }}>{service.title}</h3>
              {service.description && <p style={{ margin: "0 0 20px", color: "#6b7280", fontSize: "0.9375rem", lineHeight: 1.65, flex: 1 }}>{service.description}</p>}
              {(service.cta_url || serviceHref) && (
                <a href={service.cta_url || serviceHref || "#"} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: accent_color, fontWeight: 600, fontSize: "0.9rem", textDecoration: "none", marginTop: "auto" }}>
                  {service.cta_text || "Get a quote"} <span style={{ fontSize: "1rem" }}>›</span>
                </a>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

