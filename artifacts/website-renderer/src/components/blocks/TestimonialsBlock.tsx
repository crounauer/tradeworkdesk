"use client";

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

function Stars({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
      {[1,2,3,4,5].map((i) => (
        <span key={i} style={{ color: i <= count ? "#f59e0b" : "#d1d5db", fontSize: "1rem" }}>★</span>
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
  const { accent_color = "#0d9488", background_color = "#f9fafb", aggregate_rating, review_count } = content;
  const isModernTradePayload = Boolean(content.reviews || content.eyebrow);
  if (!testimonials.length) return null;

  if (isModernTradePayload) {
    return (
      <section style={{ padding: "80px 24px", backgroundColor: "#ffffff" }}>
        <style>{`
          .test-modern-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
          @media (min-width: 900px) { .test-modern-grid { grid-template-columns: repeat(3, 1fr); } }
        `}</style>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {label && <p style={{ color: "#d97706", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 10px" }}>{label}</p>}
          <h2 style={{ fontSize: "clamp(1.85rem, 3.2vw, 2.5rem)", fontWeight: 800, margin: "0 0 16px", color: "#0f172a" }}>{heading}</h2>
          <div className="test-modern-grid" style={{ marginTop: 28 }}>
            {testimonials.map((t, i) => {
              const authorName = t.author_name || t.author || "";
              const bodyText = t.body || t.text || "";
              return (
                <figure key={i} style={{ backgroundColor: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", padding: "24px" }}>
                  {typeof t.rating === "number" && <p style={{ margin: "0 0 10px", color: "#d97706", fontWeight: 700, fontSize: "0.875rem" }}>{t.rating}/5 rating</p>}
                  <blockquote style={{ margin: "0 0 14px", color: "#334155", lineHeight: 1.7 }}>&ldquo;{bodyText}&rdquo;</blockquote>
                  <figcaption style={{ color: "#0f172a", fontWeight: 700, fontSize: "0.95rem" }}>
                    {authorName}
                    {t.location ? <span style={{ color: "#64748b", fontWeight: 400 }}>, {t.location}</span> : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={{ padding: "72px 24px", backgroundColor: background_color }}>
      <style>{`
        .test-grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
        @media (min-width: 600px) { .test-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (min-width: 900px) { .test-grid { grid-template-columns: repeat(3, 1fr); } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          {label && <p style={{ color: accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</p>}
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, margin: "0 0 12px", color: "#111827" }}>{heading}</h2>
          {(aggregate_rating || review_count) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, marginBottom: 4 }}>
              {aggregate_rating && <span style={{ fontWeight: 800, fontSize: "1.125rem", color: "#111827" }}>{aggregate_rating}</span>}
              <div style={{ display: "flex", gap: 2 }}>
                {[1,2,3,4,5].map((i) => <span key={i} style={{ color: "#f59e0b", fontSize: "1.125rem" }}>★</span>)}
              </div>
              {review_count && <span style={{ color: "#6b7280", fontSize: "0.9375rem" }}>{review_count}</span>}
            </div>
          )}
          {subheading && <p style={{ color: "#6b7280", fontSize: "1.0625rem", maxWidth: 560, margin: "0 auto" }}>{subheading}</p>}
        </div>
        <div className="test-grid">
          {testimonials.map((t, i) => {
            const authorName = t.author_name || t.author || "";
            const bodyText = t.body || t.text || "";
            return (
            <div key={i} style={{ backgroundColor: "#f9fafb", borderRadius: 10, padding: "24px", border: "1px solid #e5e7eb" }}>
              <Stars count={t.rating ?? 5} />
              <blockquote style={{ margin: "0 0 20px", color: "#374151", lineHeight: 1.7, fontSize: "0.9375rem" }}>
                &ldquo;{bodyText}&rdquo;
              </blockquote>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <footer style={{ fontWeight: 700, color: "#111827", fontSize: "0.9rem" }}>
                  {authorName}
                  {t.location && <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 5 }}>— {t.location}</span>}
                </footer>
                {t.source && (
                  <a href={t.source_url || "#"} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "#9ca3af", textDecoration: "none" }}>
                    {t.source}
                  </a>
                )}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
