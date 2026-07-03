"use client";

import { isModernTemplateContent } from "@/lib/siteTheme";

// Supports both legacy field names (author, text) and current names (author_name, body)
interface Testimonial {
  author_name?: string;
  author?: string;
  location?: string;
  rating?: number;
  body?: string;
  text?: string;
  source?: string;
  source_url?: string;
}

interface Props {
  content: {
    heading?: string;
    title?: string;
    subheading?: string;
    subtitle?: string;
    label?: string;
    eyebrow?: string;
    testimonials?: Testimonial[];
    reviews?: Array<Record<string, unknown>>;
    accent_color?: string;
    background_color?: string;
    aggregate_rating?: string;
    review_count?: string;
  } & Record<string, unknown>;
}

function Stars({ count, color = "#f59e0b", emptyColor = "#d1d5db" }: { count: number; color?: string; emptyColor?: string }) {
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
      {[1,2,3,4,5].map((i) => (
        <span key={i} style={{ color: i <= count ? color : emptyColor, fontSize: "1rem" }}>★</span>
      ))}
    </div>
  );
}

export default function TestimonialsBlock({ content }: Props) {
  const heading = (content.heading || content.title || "What Our Customers Say") as string;
  const subheading = (content.subheading || content.subtitle) as string | undefined;
  const label = (content.label || content.eyebrow) as string | undefined;
  const testimonials = (Array.isArray(content.testimonials) ? content.testimonials : Array.isArray(content.reviews)
    ? content.reviews.map((r) => ({
      author_name: (r.name as string | undefined) || (r.author_name as string | undefined),
      author: r.author as string | undefined,
      location: r.location as string | undefined,
      rating: typeof r.rating === "number" ? r.rating : undefined,
      body: (r.quote as string | undefined) || (r.body as string | undefined),
      text: r.text as string | undefined,
      source: r.source as string | undefined,
      source_url: r.source_url as string | undefined,
    })) : []) as Testimonial[];
  const accentColor = String(content.accent_color || "#0d9488");
  const sectionBg = String(content.section_bg || content.background_color || "#f9fafb");
  const cardBg = String(content.card_bg || "#f9fafb");
  const cardBorder = String(content.card_border || content.border_color || "#e5e7eb");
  const headingColor = String(content.heading_color || content.text_color || "#111827");
  const bodyColor = String(content.body_color || content.muted_text_color || "#6b7280");
  const metaColor = String(content.meta_color || "#9ca3af");
  const starColor = String(content.star_color || "#f59e0b");
  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const layout = String(content.layout_variant || content.layout || "card-grid").toLowerCase();
  const columns = Number(content.columns || 3);
  const headingSize = String(content.heading_size || "clamp(1.75rem, 3vw, 2.25rem)");
  const bodySize = String(content.body_size || "0.9375rem");
  const cardRadius = String(content.card_radius || "10px");
  const paddingY = String(content.padding_y || "72px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1200px");
  const aggregateRating = content.aggregate_rating as string | undefined;
  const reviewCount = content.review_count as string | undefined;
  const isModernTradePayload = isModernTemplateContent(content);
  if (!testimonials.length) return null;

  return (
    <section style={{ padding: `${paddingY} ${paddingX}`, backgroundColor: sectionBg }}>
      <style>{`
        .test-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 600px) { .test-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 900px) { .test-grid { grid-template-columns: repeat(${columns}, 1fr); } }
        .test-list { display: grid; gap: 14px; }
        .test-compact { display: grid; gap: 8px; }
      `}</style>
      <div style={{ maxWidth, margin: "0 auto" }}>
        <div style={{ textAlign: layout === "editorial-list" ? "left" : "center", marginBottom: 38 }}>
          {label && <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFont }}>{label}</p>}
          <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 12px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
          {(aggregateRating || reviewCount) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, marginBottom: 4 }}>
              {aggregateRating && <span style={{ fontWeight: 800, fontSize: "1.125rem", color: headingColor, fontFamily: headingFont }}>{aggregateRating}</span>}
              <div style={{ display: "flex", gap: 2 }}>
                {[1,2,3,4,5].map((i) => <span key={i} style={{ color: starColor, fontSize: "1.125rem" }}>★</span>)}
              </div>
              {reviewCount && <span style={{ color: bodyColor, fontSize: "0.9375rem", fontFamily: bodyFont }}>{reviewCount}</span>}
            </div>
          )}
          {subheading && <p style={{ color: bodyColor, fontSize: "1.0625rem", maxWidth: layout === "editorial-list" ? 760 : 560, margin: layout === "editorial-list" ? "0" : "0 auto", fontFamily: bodyFont }}>{subheading}</p>}
        </div>

        {layout === "editorial-list" && (
          <div className="test-list">
            {testimonials.map((t, i) => {
              const authorName = t.author_name || t.author || "";
              const bodyText = t.body || t.text || "";
              return (
                <article key={i} style={{ backgroundColor: cardBg, borderRadius: cardRadius, padding: "18px 20px", border: `1px solid ${cardBorder}` }}>
                  <div style={{ marginBottom: 8 }}><Stars count={t.rating ?? 5} color={starColor} /></div>
                  <blockquote style={{ margin: "0 0 12px", color: bodyColor, lineHeight: 1.7, fontSize: bodySize, fontFamily: bodyFont }}>&ldquo;{bodyText}&rdquo;</blockquote>
                  <footer style={{ color: headingColor, fontWeight: 700, fontSize: "0.92rem", fontFamily: headingFont }}>
                    {authorName}
                    {t.location ? <span style={{ color: metaColor, fontWeight: 400, marginLeft: 5, fontFamily: bodyFont }}>— {t.location}</span> : null}
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {layout === "spotlight" && (
          <div style={{ display: "grid", gap: 14 }}>
            {testimonials.map((t, i) => {
              const authorName = t.author_name || t.author || "";
              const bodyText = t.body || t.text || "";
              return (
                <article key={i} style={{ backgroundColor: i === 0 ? `${accentColor}18` : cardBg, borderRadius: cardRadius, padding: "22px", border: `1px solid ${cardBorder}` }}>
                  <Stars count={t.rating ?? 5} color={starColor} />
                  <blockquote style={{ margin: "0 0 16px", color: bodyColor, lineHeight: 1.7, fontSize: bodySize, fontFamily: bodyFont }}>&ldquo;{bodyText}&rdquo;</blockquote>
                  <footer style={{ fontWeight: 700, color: headingColor, fontSize: "0.92rem", fontFamily: headingFont }}>
                    {authorName}
                    {t.location ? <span style={{ color: metaColor, fontWeight: 400, marginLeft: 5, fontFamily: bodyFont }}>— {t.location}</span> : null}
                  </footer>
                </article>
              );
            })}
          </div>
        )}

        {layout === "compact-rows" && (
          <div className="test-compact">
            {testimonials.map((t, i) => {
              const authorName = t.author_name || t.author || "";
              const bodyText = t.body || t.text || "";
              return (
                <article key={i} style={{ backgroundColor: cardBg, borderRadius: cardRadius, border: `1px solid ${cardBorder}`, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: headingColor, fontWeight: 700, fontSize: "0.9rem", fontFamily: headingFont }}>{authorName}</div>
                      <div style={{ color: bodyColor, fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: bodyFont }}>{bodyText}</div>
                    </div>
                    <div style={{ color: starColor, whiteSpace: "nowrap" }}>{"★".repeat(Math.max(1, Math.min(5, t.rating ?? 5)))}</div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {(layout === "card-grid" || !["editorial-list", "spotlight", "compact-rows"].includes(layout)) && (
          <div className="test-grid">
            {testimonials.map((t, i) => {
              const authorName = t.author_name || t.author || "";
              const bodyText = t.body || t.text || "";
              return (
                <article key={i} style={{ backgroundColor: isModernTradePayload ? "#f8fafc" : cardBg, borderRadius: cardRadius, padding: "24px", border: `1px solid ${cardBorder}` }}>
                  <div style={{ marginBottom: 6 }}><Stars count={t.rating ?? 5} color={starColor} /></div>
                  <blockquote style={{ margin: "0 0 20px", color: bodyColor, lineHeight: 1.7, fontSize: bodySize, fontFamily: bodyFont }}>
                    &ldquo;{bodyText}&rdquo;
                  </blockquote>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <footer style={{ fontWeight: 700, color: headingColor, fontSize: "0.9rem", fontFamily: headingFont }}>
                      {authorName}
                      {t.location ? <span style={{ fontWeight: 400, color: metaColor, marginLeft: 5, fontFamily: bodyFont }}>— {t.location}</span> : null}
                    </footer>
                    {t.source ? (
                      <a href={t.source_url || "#"} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: metaColor, textDecoration: "none", fontFamily: bodyFont }}>
                        {t.source}
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
