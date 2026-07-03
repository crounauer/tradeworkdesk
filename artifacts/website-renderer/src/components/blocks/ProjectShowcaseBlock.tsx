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

  const heading = String(content.heading || content.title || "Real Homes, Real Results");
  const subheading = String(content.subheading || content.subtitle || "");
  const label = String(content.label || content.eyebrow || "");

  const accentColor = String(content.accent_color || "#0d9488");
  const sectionBg = String(content.section_bg || content.background_color || "#f9fafb");
  const cardBg = String(content.card_bg || "#ffffff");
  const borderColor = String(content.border_color || "#e5e7eb");
  const headingColor = String(content.heading_color || "#111827");
  const bodyColor = String(content.body_color || "#4b5563");

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const buttonFont = String(content.button_font_family || content.global_button_font_family || "inherit");
  const headingSize = String(content.heading_size || "clamp(1.75rem, 3vw, 2.25rem)");
  const bodySize = String(content.body_size || "1rem");

  const layout = String(content.layout_variant || content.layout || "featured-split").toLowerCase();
  const radius = String(content.card_radius || "14px");
  const paddingY = String(content.padding_y || "72px");
  const paddingX = String(content.padding_x || "24px");
  const maxWidth = String(content.max_width || "1200px");

  if (!projects.length) return null;

  const renderProjectCard = (project: Project, i: number) => {
    if (layout === "compact-list") {
      return (
        <article key={i} style={{ borderRadius: radius, border: `1px solid ${borderColor}`, background: cardBg, padding: "16px 18px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
            <span style={{ color: accentColor, fontWeight: 800, fontFamily: headingFont }}>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 style={{ margin: "0 0 6px", color: headingColor, fontSize: "1.05rem", fontWeight: 800, fontFamily: headingFont }}>{project.title}</h3>
              {project.location ? <p style={{ margin: "0 0 6px", color: accentColor, fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: bodyFont }}>{project.location}</p> : null}
              {project.description ? <p style={{ margin: 0, color: bodyColor, fontSize: "0.93rem", lineHeight: 1.7, fontFamily: bodyFont }}>{project.description}</p> : null}
            </div>
          </div>
        </article>
      );
    }

    if (layout === "card-grid" || layout === "masonry-cards") {
      return (
        <article key={i} style={{ borderRadius: radius, border: `1px solid ${borderColor}`, background: cardBg, overflow: "hidden" }}>
          {project.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.image_url} alt={project.title} style={{ width: "100%", height: layout === "masonry-cards" ? (i % 2 === 0 ? 220 : 300) : 220, objectFit: "cover" }} />
          ) : null}
          <div style={{ padding: "16px" }}>
            {project.location ? <p style={{ margin: "0 0 8px", color: accentColor, fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: bodyFont }}>📍 {project.location}</p> : null}
            <h3 style={{ margin: "0 0 10px", color: headingColor, fontSize: "1.1rem", fontWeight: 800, fontFamily: headingFont }}>{project.title}</h3>
            {project.description ? <p style={{ margin: 0, color: bodyColor, fontSize: "0.93rem", lineHeight: 1.7, fontFamily: bodyFont }}>{project.description}</p> : null}
            {project.cta_text && project.cta_url ? (
              <a href={project.cta_url} style={{ marginTop: 10, display: "inline-flex", color: accentColor, textDecoration: "none", fontWeight: 700, fontSize: "0.92rem", fontFamily: buttonFont }}>
                {project.cta_text}
              </a>
            ) : null}
          </div>
        </article>
      );
    }

    return (
      <article key={i} style={{ display: "flex", flexDirection: "column", borderRadius: radius, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.10)", border: `1px solid ${borderColor}`, background: cardBg }}>
        <style>{`
          @media (min-width: 760px) { .proj-split-${i} { flex-direction: row; } }
          @media (min-width: 760px) { .proj-img-${i} { width: 42%; height: auto; min-height: 360px; } }
        `}</style>
        {project.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.image_url} alt={project.title} className={`proj-img-${i}`} style={{ width: "100%", height: 280, objectFit: "cover" }} />
        ) : null}

        <div className={`proj-split-${i}`} style={{ flex: 1, padding: "32px 28px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {project.location ? (
            <p style={{ margin: "0 0 10px", fontSize: "0.8125rem", fontWeight: 600, color: accentColor, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: bodyFont }}>
              📍 {project.location}
            </p>
          ) : null}
          <h3 style={{ margin: "0 0 14px", fontSize: "1.375rem", fontWeight: 800, color: headingColor, lineHeight: 1.3, fontFamily: headingFont }}>{project.title}</h3>
          {project.description ? <p style={{ margin: "0 0 24px", color: bodyColor, fontSize: "0.9375rem", lineHeight: 1.7, fontFamily: bodyFont }}>{project.description}</p> : null}
          {project.stats && project.stats.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 0, marginBottom: 20 }}>
              {project.stats.map((s, j) => (
                <div key={j} style={{ paddingRight: 18, marginRight: 18, borderRight: j < project.stats!.length - 1 ? `1px solid ${borderColor}` : "none", marginBottom: 10 }}>
                  <div style={{ fontSize: "1.125rem", fontWeight: 800, color: headingColor, fontFamily: headingFont }}>{s.value}</div>
                  {s.label ? <div style={{ fontSize: "0.75rem", color: bodyColor, marginTop: 2, fontFamily: bodyFont }}>{s.label}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
          {project.cta_text && project.cta_url ? (
            <a href={project.cta_url} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: accentColor, fontWeight: 700, textDecoration: "none", fontSize: "0.9375rem", fontFamily: buttonFont }}>
              {project.cta_text} <span style={{ fontSize: "1.1rem" }}>›</span>
            </a>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <section style={{ backgroundColor: sectionBg, padding: `${paddingY} ${paddingX}` }}>
      <div style={{ maxWidth, margin: "0 auto" }}>
        <div style={{ textAlign: layout === "compact-list" ? "left" : "center", marginBottom: 36 }}>
          {label ? (
            <p style={{ color: accentColor, fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontFamily: bodyFont }}>
              {label}
            </p>
          ) : null}
          <h2 style={{ fontSize: headingSize, fontWeight: 800, margin: "0 0 12px", color: headingColor, fontFamily: headingFont }}>{heading}</h2>
          {subheading ? <p style={{ color: bodyColor, fontSize: bodySize, maxWidth: 700, margin: layout === "compact-list" ? "0" : "0 auto", fontFamily: bodyFont }}>{subheading}</p> : null}
        </div>

        {layout === "card-grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {projects.map(renderProjectCard)}
          </div>
        ) : null}

        {layout === "masonry-cards" ? (
          <div style={{ columnCount: 1, columnGap: "16px" }}>
            <style>{`@media (min-width: 900px) { .proj-masonry { column-count: 2; } }`}</style>
            <div className="proj-masonry" style={{ columnCount: 1, columnGap: "16px" }}>
              {projects.map((project, i) => (
                <div key={i} style={{ breakInside: "avoid", marginBottom: 16 }}>{renderProjectCard(project, i)}</div>
              ))}
            </div>
          </div>
        ) : null}

        {layout === "compact-list" ? (
          <div style={{ display: "grid", gap: 12 }}>{projects.map(renderProjectCard)}</div>
        ) : null}

        {(layout === "featured-split" || !["card-grid", "masonry-cards", "compact-list"].includes(layout)) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {projects.map(renderProjectCard)}
          </div>
        ) : null}
      </div>
    </section>
  );
}
