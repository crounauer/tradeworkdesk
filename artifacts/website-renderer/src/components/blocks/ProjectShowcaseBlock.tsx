"use client";

interface ProjectStat {
  value: string;
  label?: string;
}

interface Project {
  title: string;
  description?: string;
  image_url?: string;
  location?: string;
  stats?: ProjectStat[];
  cta_text?: string;
  cta_url?: string;
}

interface Props {
  content: {
    heading?: string;
    subheading?: string;
    label?: string;
    projects?: Project[];
    accent_color?: string;
    background_color?: string;
  } & Record<string, unknown>;
}

export default function ProjectShowcaseBlock({ content }: Props) {
  const projects = (Array.isArray(content.projects) ? content.projects : []) as Project[];

  const {
    heading = "Real Homes, Real Results",
    subheading,
    label,
    accent_color = "#0d9488",
    background_color = "#f9fafb",
  } = content;

  if (!projects.length) return null;

  return (
    <section style={{ backgroundColor: background_color, padding: "72px 24px" }}>
      <style>{`
        .proj-layout { display: flex; flex-direction: column; gap: 0; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); border: 1px solid #e5e7eb; }
        @media (min-width: 760px) { .proj-layout { flex-direction: row; } }
        .proj-img { width: 100%; height: 280px; object-fit: cover; }
        @media (min-width: 760px) { .proj-img { width: 42%; height: auto; min-height: 360px; } }
      `}</style>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          {label && (
            <p style={{ color: accent_color, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
              {label}
            </p>
          )}
          {heading && (
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", fontWeight: 800, margin: "0 0 12px", color: "#111827" }}>
              {heading}
            </h2>
          )}
          {subheading && (
            <p style={{ color: "#6b7280", fontSize: "1.0625rem", maxWidth: 560, margin: "0 auto" }}>
              {subheading}
            </p>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {projects.map((project, i) => (
            <div key={i} className="proj-layout" style={{ backgroundColor: "#fff" }}>
              {/* Image */}
              {project.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={project.image_url} alt={project.title} className="proj-img" />
              )}

              {/* Content */}
              <div style={{ flex: 1, padding: "36px 32px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                {project.location && (
                  <p style={{ margin: "0 0 10px", fontSize: "0.8125rem", fontWeight: 600, color: accent_color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    📍 {project.location}
                  </p>
                )}
                <h3 style={{ margin: "0 0 14px", fontSize: "1.375rem", fontWeight: 800, color: "#111827", lineHeight: 1.3 }}>
                  {project.title}
                </h3>
                {project.description && (
                  <p style={{ margin: "0 0 24px", color: "#4b5563", fontSize: "0.9375rem", lineHeight: 1.7 }}>
                    {project.description}
                  </p>
                )}
                {project.stats && project.stats.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 0, marginBottom: 28 }}>
                    {project.stats.map((s, j) => (
                      <div key={j} style={{ paddingRight: 24, marginRight: 24, borderRight: j < project.stats!.length - 1 ? "1px solid #e5e7eb" : "none", marginBottom: 12 }}>
                        <div style={{ fontSize: "1.125rem", fontWeight: 800, color: "#111827" }}>{s.value}</div>
                        {s.label && <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 2 }}>{s.label}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {project.cta_text && project.cta_url && (
                  <a href={project.cta_url} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: accent_color, fontWeight: 700, textDecoration: "none", fontSize: "0.9375rem" }}>
                    {project.cta_text} <span style={{ fontSize: "1.1rem" }}>›</span>
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
