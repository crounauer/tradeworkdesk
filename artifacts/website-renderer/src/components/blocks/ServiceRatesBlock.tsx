"use client";

type RateItem = {
  service?: string;
  title?: string;
  price?: string;
  description?: string;
  duration?: string;
  badge?: string;
  ctaLabel?: string;
  ctaHref?: string;
  cta_text?: string;
  cta_url?: string;
};

interface Props {
  content: {
    eyebrow?: string;
    label?: string;
    title?: string;
    heading?: string;
    subtitle?: string;
    subheading?: string;
    note?: string;
    variation?: "cards" | "table" | "split" | "compact";
    layout?: string;
    rates?: RateItem[];
    items?: RateItem[];
    section_bg?: string;
    background_color?: string;
    card_bg?: string;
    card_border?: string;
    heading_color?: string;
    body_color?: string;
    accent_color?: string;
    muted_text_color?: string;
    heading_font_family?: string;
    body_font_family?: string;
  } & Record<string, unknown>;
}

export default function ServiceRatesBlock({ content }: Props) {
  const eyebrow = String(content.eyebrow || content.label || "Rates");
  const title = String(content.title || content.heading || "Service Rates");
  const subtitle = String(content.subtitle || content.subheading || "");
  const note = String(content.note || "");
  const variationRaw = String(content.variation || content.layout || "cards").toLowerCase();
  const variation = (["cards", "table", "split", "compact"].includes(variationRaw) ? variationRaw : "cards") as "cards" | "table" | "split" | "compact";

  const sectionBg = String(content.section_bg || content.background_color || "#ffffff");
  const cardBg = String(content.card_bg || "#ffffff");
  const cardBorder = String(content.card_border || "#cbd5e1");
  const headingColor = String(content.heading_color || "#0f172a");
  const bodyColor = String(content.body_color || content.muted_text_color || "#475569");
  const accentColor = String(content.accent_color || "#1a3a6b");
  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");

  const rates = (Array.isArray(content.rates) ? content.rates : Array.isArray(content.items) ? content.items : []) as RateItem[];

  return (
    <section style={{ padding: "72px 24px", background: sectionBg }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ maxWidth: 720 }}>
          <p style={{ margin: 0, color: accentColor, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontSize: 13, fontFamily: bodyFont }}>
            {eyebrow}
          </p>
          <h2 style={{ margin: "14px 0 0", color: headingColor, fontSize: "clamp(1.8rem, 3.3vw, 2.4rem)", lineHeight: 1.15, fontWeight: 800, fontFamily: headingFont }}>
            {title}
          </h2>
          {subtitle ? (
            <p style={{ margin: "14px 0 0", color: bodyColor, fontSize: "1.05rem", lineHeight: 1.6, fontFamily: bodyFont }}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {variation === "cards" ? (
          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginTop: 34 }}>
            {rates.map((rate, index) => {
              const name = String(rate.service || rate.title || `Service ${index + 1}`);
              const price = String(rate.price || "From £0");
              const ctaLabel = String(rate.ctaLabel || rate.cta_text || "");
              const ctaHref = String(rate.ctaHref || rate.cta_url || "");
              return (
                <article key={`${name}-${index}`} style={{ border: `1px solid ${cardBorder}`, borderRadius: 6, background: cardBg, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <h3 style={{ margin: 0, color: headingColor, fontSize: "1.06rem", fontWeight: 700, fontFamily: headingFont }}>{name}</h3>
                    <p style={{ margin: 0, color: accentColor, fontWeight: 800, fontSize: "1.02rem", fontFamily: headingFont }}>{price}</p>
                  </div>
                  {rate.badge ? (
                    <p style={{ margin: "10px 0 0", display: "inline-block", padding: "2px 8px", borderRadius: 4, background: accentColor, color: "#ffffff", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, fontFamily: bodyFont }}>
                      {rate.badge}
                    </p>
                  ) : null}
                  {rate.description ? <p style={{ margin: "10px 0 0", color: bodyColor, lineHeight: 1.55, fontFamily: bodyFont }}>{rate.description}</p> : null}
                  {rate.duration ? <p style={{ margin: "10px 0 0", color: bodyColor, fontSize: 13, fontFamily: bodyFont }}>Typical duration: {rate.duration}</p> : null}
                  {ctaLabel && ctaHref ? (
                    <a href={ctaHref} style={{ marginTop: 12, display: "inline-block", color: headingColor, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 4, fontFamily: bodyFont }}>
                      {ctaLabel} {'->'}
                    </a>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}

        {variation === "table" ? (
          <div style={{ marginTop: 34, border: `1px solid ${cardBorder}`, borderRadius: 6, background: cardBg, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: "12px 14px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#334155", fontFamily: bodyFont }}>Service</th>
                  <th style={{ padding: "12px 14px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#334155", fontFamily: bodyFont }}>Rate</th>
                  <th style={{ padding: "12px 14px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#334155", fontFamily: bodyFont }}>Duration</th>
                  <th style={{ padding: "12px 14px", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#334155", fontFamily: bodyFont }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate, index) => {
                  const name = String(rate.service || rate.title || `Service ${index + 1}`);
                  const price = String(rate.price || "From £0");
                  return (
                    <tr key={`${name}-${index}`} style={{ borderTop: index === 0 ? "none" : `1px solid ${cardBorder}` }}>
                      <td style={{ padding: "14px", color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{name}</td>
                      <td style={{ padding: "14px", color: accentColor, fontWeight: 800, fontFamily: headingFont }}>{price}</td>
                      <td style={{ padding: "14px", color: bodyColor, fontFamily: bodyFont }}>{String(rate.duration || "-")}</td>
                      <td style={{ padding: "14px", color: bodyColor, fontFamily: bodyFont }}>{String(rate.description || "-")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {variation === "split" ? (
          <div style={{ marginTop: 34, display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <article style={{ border: `2px solid ${accentColor}`, borderRadius: 6, background: cardBg, padding: 22 }}>
              <p style={{ margin: 0, color: accentColor, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontSize: 12, fontFamily: bodyFont }}>
                Featured Rate
              </p>
              <h3 style={{ margin: "10px 0 0", color: headingColor, fontSize: "1.5rem", fontWeight: 800, fontFamily: headingFont }}>
                {String(rates[0]?.service || rates[0]?.title || "Service")}
              </h3>
              <p style={{ margin: "8px 0 0", color: accentColor, fontSize: "1.8rem", fontWeight: 800, fontFamily: headingFont }}>
                {String(rates[0]?.price || "From £0")}
              </p>
              {rates[0]?.description ? <p style={{ margin: "10px 0 0", color: bodyColor, lineHeight: 1.55, fontFamily: bodyFont }}>{rates[0].description}</p> : null}
            </article>
            <div style={{ display: "grid", gap: 12 }}>
              {rates.slice(1).map((rate, index) => {
                const name = String(rate.service || rate.title || `Service ${index + 2}`);
                return (
                  <article key={`${name}-${index}`} style={{ border: `1px solid ${cardBorder}`, borderRadius: 6, background: cardBg, padding: "14px 16px", display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <p style={{ margin: 0, color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{name}</p>
                      {rate.description ? <p style={{ margin: "6px 0 0", color: bodyColor, fontSize: 14, fontFamily: bodyFont }}>{rate.description}</p> : null}
                    </div>
                    <p style={{ margin: 0, color: accentColor, fontWeight: 800, fontFamily: headingFont }}>{String(rate.price || "From £0")}</p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        {variation === "compact" ? (
          <div style={{ marginTop: 34, border: `1px solid ${cardBorder}`, borderRadius: 6, background: cardBg, overflow: "hidden" }}>
            {rates.map((rate, index) => {
              const name = String(rate.service || rate.title || `Service ${index + 1}`);
              const price = String(rate.price || "From £0");
              return (
                <article key={`${name}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderTop: index === 0 ? "none" : `1px solid ${cardBorder}` }}>
                  <div>
                    <p style={{ margin: 0, color: headingColor, fontWeight: 700, fontFamily: headingFont }}>{name}</p>
                    {rate.description ? <p style={{ margin: "4px 0 0", color: bodyColor, fontSize: 14, fontFamily: bodyFont }}>{rate.description}</p> : null}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, color: accentColor, fontWeight: 800, fontFamily: headingFont }}>{price}</p>
                    {rate.duration ? <p style={{ margin: "4px 0 0", color: bodyColor, fontSize: 12, fontFamily: bodyFont }}>{rate.duration}</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {note ? <p style={{ margin: "14px 0 0", color: bodyColor, fontSize: 13, fontFamily: bodyFont }}>{note}</p> : null}
      </div>
    </section>
  );
}
