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
  const columns = Number(content.columns || 3);
  const accentColor = String(content.accent_color || "#f97316");
  const isModernTradePayload = isModernTemplateContent(content);
  const layout = String(content.layout_variant || content.layout || "card-grid").toLowerCase();

  const sectionBg = String(content.section_bg || content.background_color || content.muted_background_color || "#ffffff");
  const cardBg = String(content.card_bg || content.card_background_color || "#ffffff");
  const cardBorder = String(content.card_border || content.card_border_color || content.border_color || "#e5e7eb");
  const headingColor = String(content.heading_color || content.text_color || "#111827");
  const textColor = String(content.body_color || content.muted_text_color || "#6b7280");
  const badgeBg = String(content.badge_bg || "#fef3c7");
  const badgeText = String(content.badge_text_color || "#92400e");
  const linkColor = String(content.link_color || accentColor);

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const buttonFont = String(content.button_font_family || content.global_button_font_family || "inherit");

  const headingSize = String(content.heading_size || "clamp(1.75rem, 3vw, 2.25rem)");
  const itemTitleSize = String(content.item_title_size || "1.0625rem");
  const bodySize = String(content.body_size || "0.9375rem");
  const radius = String(content.card_radius || "10px");
  const sectionPaddingY = String(content.padding_y || (isModernTradePayload ? "80px" : "72px"));
  const sectionPaddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1200px");
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

  return (
    <section style={{ padding: `${sectionPaddingY} ${sectionPaddingX}`, backgroundColor: sectionBg }}>
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
        .svc-split { display: grid; grid-template-columns: 1fr; gap: 20px; }
        @media (min-width: 1000px) { .svc-split { grid-template-columns: minmax(260px, 0.9fr) minmax(0, 2.1fr); gap: 28px; } }
        .svc-panel { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 760px) { .svc-panel { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
      <div style={{ maxWidth, margin: "0 auto" }}>
        {(label || heading || subheading) && (
          <div style={{ textAlign: layout === "split-list" ? "left" : "center", marginBottom: 36 }}>
            {label && <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFont }}>{label}</p>}
            {heading && <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 14px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>}
            {subheading && <p style={{ color: textColor, fontSize: "1.0625rem", maxWidth: layout === "split-list" ? 720 : 560, margin: layout === "split-list" ? "0" : "0 auto", fontFamily: bodyFont }}>{subheading}</p>}
          </div>
        )}

        {layout === "split-list" && (
          <div className="svc-split">
            <div style={{ border: `1px solid ${cardBorder}`, borderRadius: radius, background: cardBg, padding: "20px" }}>
              <p style={{ margin: 0, color: headingColor, fontWeight: 700, fontFamily: headingFont }}>Our services at a glance</p>
              <p style={{ margin: "8px 0 0", color: textColor, fontSize: bodySize, lineHeight: 1.6, fontFamily: bodyFont }}>
                Choose a service to learn more and request a quote.
              </p>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {services.map((service, i) => {
                const serviceHref = service.href || service.cta_url;
                return (
                  <article key={i} style={{ border: `1px solid ${cardBorder}`, borderRadius: radius, backgroundColor: cardBg, padding: "16px 18px", display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {service.icon ? <span style={{ fontSize: "1.1rem" }}>{service.icon}</span> : null}
                      <h3 style={{ margin: 0, fontSize: itemTitleSize, fontWeight: 700, color: headingColor, fontFamily: headingFont }}>{service.title}</h3>
                    </div>
                    {service.description ? <p style={{ margin: 0, fontSize: bodySize, color: textColor, lineHeight: 1.6, fontFamily: bodyFont }}>{service.description}</p> : null}
                    {serviceHref ? (
                      <a href={serviceHref} style={{ color: linkColor, textDecoration: "none", fontWeight: 700, fontSize: "0.9rem", fontFamily: buttonFont }}>
                        {service.cta_text || "Learn more"} →
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {layout === "icon-panels" && (
          <div className="svc-panel">
            {services.map((service, i) => {
              const serviceHref = service.href || service.cta_url;
              return (
                <article key={i} style={{ border: `1px solid ${cardBorder}`, borderRadius: radius, background: cardBg, padding: "22px", display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${accentColor}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span>{service.icon || "⚙️"}</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: itemTitleSize, fontWeight: 700, color: headingColor, fontFamily: headingFont }}>{service.title}</h3>
                  </div>
                  {service.description ? <p style={{ margin: 0, color: textColor, lineHeight: 1.65, fontSize: bodySize, fontFamily: bodyFont }}>{service.description}</p> : null}
                  {serviceHref ? (
                    <a href={serviceHref} style={{ color: linkColor, textDecoration: "none", fontWeight: 700, fontSize: "0.9rem", fontFamily: buttonFont }}>
                      {service.cta_text || "Get a quote"} →
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {layout === "compact-rows" && (
          <div style={{ display: "grid", gap: 8 }}>
            {services.map((service, i) => {
              const serviceHref = service.href || service.cta_url;
              return (
                <article key={i} style={{ border: `1px solid ${cardBorder}`, borderRadius: radius, background: cardBg, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {service.icon ? <span>{service.icon}</span> : null}
                    <span style={{ fontWeight: 700, color: headingColor, fontFamily: headingFont }}>{service.title}</span>
                    {service.badge ? <span style={{ background: badgeBg, color: badgeText, borderRadius: 999, padding: "2px 8px", fontSize: "0.7rem", fontWeight: 700, fontFamily: bodyFont }}>{service.badge}</span> : null}
                  </div>
                  {serviceHref ? (
                    <a href={serviceHref} style={{ color: linkColor, textDecoration: "none", fontWeight: 700, fontSize: "0.86rem", fontFamily: buttonFont }}>
                      {service.cta_text || "Details"} →
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {(layout === "card-grid" || !["split-list", "icon-panels", "compact-rows"].includes(layout)) && (
          <div className="svc-grid">
            {services.map((service, i) => {
              const serviceHref = service.href || service.cta_url;
              return (
                <article key={i} style={{ backgroundColor: cardBg, borderRadius: radius, padding: "28px 24px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: `1px solid ${cardBorder}`, display: "flex", flexDirection: "column" }}>
                  {service.badge ? (
                    <span style={{ display: "inline-block", backgroundColor: badgeBg, color: badgeText, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", borderRadius: 4, padding: "2px 8px", marginBottom: 14, alignSelf: "flex-start", fontFamily: bodyFont }}>
                      {service.badge}
                    </span>
                  ) : null}
                  {service.icon ? (
                    <div style={{ width: 48, height: 48, backgroundColor: `${accentColor}18`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: 16 }}>
                      {service.icon}
                    </div>
                  ) : null}
                  <h3 style={{ margin: "0 0 10px", fontSize: itemTitleSize, fontWeight: 700, color: headingColor, fontFamily: headingFont }}>{service.title}</h3>
                  {service.description ? <p style={{ margin: "0 0 20px", color: textColor, fontSize: bodySize, lineHeight: 1.65, flex: 1, fontFamily: bodyFont }}>{service.description}</p> : null}
                  {serviceHref ? (
                    <a href={serviceHref} style={{ display: "inline-flex", alignItems: "center", gap: 4, color: linkColor, fontWeight: 700, fontSize: "0.9rem", textDecoration: "none", marginTop: "auto", fontFamily: buttonFont }}>
                      {service.cta_text || "Get a quote"} <span style={{ fontSize: "1rem" }}>›</span>
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

