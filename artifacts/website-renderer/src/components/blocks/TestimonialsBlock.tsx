"use client";

interface Testimonial {
  author_name: string;
  location?: string;
  rating?: number;
  body: string;
}

interface Props {
  content: {
    heading?: string;
    testimonials?: Testimonial[];
  } & Record<string, unknown>;
}

export default function TestimonialsBlock({ content }: Props) {
  const { heading = "What Our Customers Say", testimonials = [] } = content;
  if (!testimonials.length) return null;

  return (
    <section style={{ padding: "64px 24px", backgroundColor: "#fff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {heading && (
          <h2 style={{ textAlign: "center", fontSize: "2rem", fontWeight: 700, marginBottom: 48 }}>
            {heading}
          </h2>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          {testimonials.map((t, i) => (
            <div
              key={i}
              style={{
                backgroundColor: "#f9fafb",
                borderRadius: 8,
                padding: 24,
                borderLeft: "4px solid #f97316",
              }}
            >
              {t.rating && (
                <div style={{ color: "#f59e0b", marginBottom: 8, fontSize: "1.25rem" }}>
                  {"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}
                </div>
              )}
              <blockquote style={{ margin: 0, fontStyle: "italic", color: "#374151", lineHeight: 1.7 }}>
                &ldquo;{t.body}&rdquo;
              </blockquote>
              <footer style={{ marginTop: 16, fontWeight: 600 }}>
                {t.author_name}
                {t.location && <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: 6 }}>— {t.location}</span>}
              </footer>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
