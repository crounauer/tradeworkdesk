"use client";

interface Props {
  content: {
    eyebrow?: string;
    label?: string;
    title?: string;
    heading?: string;
    subtitle?: string;
    subheading?: string;
    note?: string;
    columns?: string[];
    rows?: string[][];
    striped?: boolean;
    section_bg?: string;
    background_color?: string;
    card_bg?: string;
    alt_row_bg?: string;
    border_color?: string;
    accent_color?: string;
    header_text_color?: string;
    heading_color?: string;
    body_color?: string;
    text_color?: string;
    heading_font_family?: string;
    body_font_family?: string;
    card_radius?: string;
  } & Record<string, unknown>;
}

export default function DataTableBlock({ content }: Props) {
  const eyebrow = String(content.eyebrow || content.label || "");
  const title = String(content.title || content.heading || "");
  const subtitle = String(content.subtitle || content.subheading || "");
  const note = String(content.note || "");

  const columns = Array.isArray(content.columns) ? content.columns.map(String) : [];
  const rows = Array.isArray(content.rows) ? content.rows.map((row) => (Array.isArray(row) ? row.map(String) : [])) : [];

  const sectionBg = String(content.section_bg || content.background_color || "#ffffff");
  const cardBg = String(content.card_bg || "#ffffff");
  const altRowBg = String(content.alt_row_bg || "#f8fafc");
  const borderColor = String(content.border_color || "#e2e8f0");
  const headerBg = String(content.accent_color || "#1a3a6b");
  const headerTextColor = String(content.header_text_color || "#ffffff");
  const headingColor = String(content.heading_color || "#0f172a");
  const bodyColor = String(content.body_color || content.text_color || "#475569");
  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const radius = String(content.card_radius || "10px");
  const striped = content.striped !== false;

  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <section style={{ padding: "72px 24px", background: sectionBg }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {(eyebrow || title || subtitle) && (
          <div style={{ maxWidth: 720, marginBottom: 32 }}>
            {eyebrow ? (
              <p style={{ margin: 0, color: headerBg, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, fontSize: 13, fontFamily: bodyFont }}>
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 style={{ margin: "14px 0 0", color: headingColor, fontSize: "clamp(1.8rem, 3.3vw, 2.4rem)", lineHeight: 1.15, fontWeight: 800, fontFamily: headingFont }}>
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p style={{ margin: "14px 0 0", color: bodyColor, fontSize: "1.05rem", lineHeight: 1.6, fontFamily: bodyFont }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        )}

        <div style={{ border: `1px solid ${borderColor}`, borderRadius: radius, background: cardBg, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead>
                <tr style={{ background: headerBg }}>
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "14px 18px",
                        textAlign: "left",
                        color: headerTextColor,
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        fontFamily: headingFont,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    style={{
                      background: striped && rowIndex % 2 === 1 ? altRowBg : cardBg,
                      borderTop: `1px solid ${borderColor}`,
                    }}
                  >
                    {columns.map((_, colIndex) => (
                      <td
                        key={colIndex}
                        style={{
                          padding: "14px 18px",
                          color: colIndex === 0 ? headingColor : bodyColor,
                          fontWeight: colIndex === 0 ? 600 : 400,
                          fontSize: "0.95rem",
                          fontFamily: bodyFont,
                        }}
                      >
                        {row[colIndex] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {note ? (
          <p style={{ margin: "14px 0 0", color: bodyColor, fontSize: 13, fontFamily: bodyFont }}>{note}</p>
        ) : null}
      </div>
    </section>
  );
}
