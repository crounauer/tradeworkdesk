"use client";

interface Testimonial {
  author_name: string;
  location?: string;
  rating?: number;
  body: string;
  source?: string;
  source_url?: string;
}

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    testimonials?: Testimonial[];
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

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    testimonials?: Testimonial[];
    accent_color?: string;
    background_color?: string;
    aggregate_rating?: string;
    review_count?: string;
  } & Record<string, unknown>;
}

export default function TestimonialsBlock({ content }: Props) {
  const { heading = "What Our Customers Say", subheading, label, testimonials = [], accent_color = "#0d9488", background_color = "#f9fafb", aggregate_rating, review_count } = content;
  if (!testimonials.length) return null;

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
          {testimonials.map((t, i) => (
            <div key={i} style={{ backgroundColor: "#f9fafb", borderRadius: 10, padding: "24px", border: "1px solid #e5e7eb" }}>
              <Stars count={t.rating ?? 5} />
              <blockquote style={{ margin: "0 0 20px", color: "#374151", lineHeight: 1.7, fontSize: "0.9375rem" }}>
                &ldquo;{t.body}&rdquo;
              </blockquote>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <footer style={{ fontWeight: 700, color: "#111827", fontSize: "0.9rem" }}>
                  {t.author_name}
                  {t.location && <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 5 }}>— {t.location}</span>}
                </footer>
                {t.source && (
                  <a href={t.source_url || "#"} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "#9ca3af", textDecoration: "none" }}>
                    {t.source}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
