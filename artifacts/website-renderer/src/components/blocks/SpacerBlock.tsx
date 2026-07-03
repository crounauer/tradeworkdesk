"use client";

interface Props {
  content: {
    height?: number | string;
    layout?: string;
    layout_variant?: string;
  } & Record<string, unknown>;
}

export default function SpacerBlock({ content }: Props) {
  const rawHeight = content.height ?? "md";
  const height =
    typeof rawHeight === "number"
      ? `${rawHeight}px`
      : rawHeight === "sm"
        ? "16px"
        : rawHeight === "md"
          ? "32px"
          : rawHeight === "lg"
            ? "64px"
            : rawHeight === "xl"
              ? "96px"
              : String(rawHeight);

  const variant = String(content.layout_variant || content.layout || "blank-gap").toLowerCase();
  const sectionBg = String(content.section_bg || "transparent");
  const ruleColor = String(content.rule_color || "#e5e7eb");
  const accentColor = String(content.accent_color || "#0d9488");

  if (variant === "divider-line") {
    return (
      <section style={{ background: sectionBg, padding: "0 24px" }} aria-hidden="true">
        <div style={{ height, display: "grid", alignItems: "center", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ borderTop: `1px solid ${ruleColor}` }} />
        </div>
      </section>
    );
  }

  if (variant === "accent-rule") {
    return (
      <section style={{ background: sectionBg, padding: "0 24px" }} aria-hidden="true">
        <div style={{ height, display: "grid", alignItems: "center", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent 0%, ${accentColor} 20%, ${accentColor} 80%, transparent 100%)` }} />
        </div>
      </section>
    );
  }

  if (variant === "dotted-rule") {
    return (
      <section style={{ background: sectionBg, padding: "0 24px" }} aria-hidden="true">
        <div style={{ height, display: "grid", alignItems: "center", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ borderTop: `2px dotted ${ruleColor}` }} />
        </div>
      </section>
    );
  }

  return <div style={{ height, background: sectionBg }} aria-hidden="true" />;
}
