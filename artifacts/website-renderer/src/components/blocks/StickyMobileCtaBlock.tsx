"use client";

interface Props {
  content: {
    enabled?: boolean;
    primary_label?: string;
    primary_href?: string;
    secondary_label?: string;
    secondary_href?: string;
    background_color?: string;
    text_color?: string;
    border_color?: string;
  } & Record<string, unknown>;
}

export default function StickyMobileCtaBlock({ content }: Props) {
  if (content.enabled === false) return null;

  const primaryLabel = String(content.primary_label || content.primaryLabel || "Call Now").trim() || "Call Now";
  const primaryHref = String(content.primary_href || content.primaryHref || "tel:+441224000000").trim() || "tel:+441224000000";
  const secondaryLabel = String(content.secondary_label || content.secondaryLabel || "Book Online").trim() || "Book Online";
  const secondaryHref = String(content.secondary_href || content.secondaryHref || "/book").trim() || "/book";

  const layout = String(content.layout_variant || content.layout || "dual-pill").toLowerCase();

  const backgroundColor = String(content.background_color || content.backgroundColor || "#0f172a");
  const textColor = String(content.text_color || content.textColor || "#ffffff");
  const primaryColor = String(content.primary_color || "rgba(255,255,255,0.2)");
  const secondaryColor = String(content.secondary_color || "rgba(255,255,255,0.08)");
  const borderColor = String(content.border_color || content.borderColor || "rgba(255,255,255,0.2)");
  const headingColor = String(content.heading_color || textColor);
  const bodyColor = String(content.body_color || "rgba(255,255,255,0.8)");

  const headingFont = String(content.heading_font_family || content.global_heading_font_family || "inherit");
  const bodyFont = String(content.body_font_family || content.global_body_font_family || "inherit");
  const buttonFont = String(content.button_font_family || content.global_button_font_family || "inherit");

  const headingSize = String(content.heading_size || "0.9rem");
  const bodySize = String(content.body_size || "0.78rem");
  const buttonSize = String(content.button_size || "0.95rem");
  const barRadius = String(content.bar_radius || "12px");
  const buttonRadius = String(content.button_radius || "10px");

  const heading = String(content.heading || content.title || "Need help today?");
  const subheading = String(content.subheading || content.subtitle || "Call us now or book online.");

  return (
    <>
      <style>{`
        .sticky-mobile-cta {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1200;
          padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid ${borderColor};
          box-shadow: 0 -6px 24px rgba(2, 6, 23, 0.25);
          background: ${backgroundColor};
        }
        .sticky-mobile-cta__inner {
          margin: 0 auto;
          max-width: 960px;
          border: 1px solid ${borderColor};
          border-radius: ${barRadius};
          padding: 8px;
          background: ${backgroundColor};
        }
        .sticky-mobile-cta__copy {
          margin: 0 0 8px;
        }
        .sticky-mobile-cta__heading {
          margin: 0 0 2px;
          color: ${headingColor};
          font-family: ${headingFont};
          font-size: ${headingSize};
          font-weight: 700;
        }
        .sticky-mobile-cta__subheading {
          margin: 0;
          color: ${bodyColor};
          font-family: ${bodyFont};
          font-size: ${bodySize};
        }
        .sticky-mobile-cta__row {
          display: grid;
          gap: 8px;
        }
        .sticky-mobile-cta__row--two {
          grid-template-columns: 1fr 1fr;
        }
        .sticky-mobile-cta__row--one {
          grid-template-columns: 1fr;
        }
        .sticky-mobile-cta__btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          border-radius: ${buttonRadius};
          border: 1px solid ${borderColor};
          color: ${textColor};
          text-decoration: none;
          font-size: ${buttonSize};
          font-family: ${buttonFont};
          font-weight: 700;
          letter-spacing: 0.01em;
          background: ${secondaryColor};
          padding: 10px 12px;
        }
        .sticky-mobile-cta__btn--primary {
          background: ${primaryColor};
        }
        .sticky-mobile-cta__btn--ghost {
          background: transparent;
        }
        @media (min-width: 768px) {
          .sticky-mobile-cta {
            display: none;
          }
        }
      `}</style>
      <div className="sticky-mobile-cta" role="region" aria-label="Quick actions">
        <div className="sticky-mobile-cta__inner">
          {(layout === "stacked-copy" || layout === "split-label") && (
            <div className="sticky-mobile-cta__copy">
              <p className="sticky-mobile-cta__heading">{heading}</p>
              <p className="sticky-mobile-cta__subheading">{subheading}</p>
            </div>
          )}

          {(layout === "single-primary") && (
            <div className="sticky-mobile-cta__row sticky-mobile-cta__row--one">
              <a className="sticky-mobile-cta__btn sticky-mobile-cta__btn--primary" href={primaryHref}>{primaryLabel}</a>
            </div>
          )}

          {(layout === "split-label") && (
            <div className="sticky-mobile-cta__row sticky-mobile-cta__row--two">
              <a className="sticky-mobile-cta__btn sticky-mobile-cta__btn--primary" href={primaryHref}>{primaryLabel}</a>
              <a className="sticky-mobile-cta__btn sticky-mobile-cta__btn--ghost" href={secondaryHref}>{secondaryLabel}</a>
            </div>
          )}

          {(layout === "stacked-copy") && (
            <div className="sticky-mobile-cta__row sticky-mobile-cta__row--two">
              <a className="sticky-mobile-cta__btn sticky-mobile-cta__btn--primary" href={primaryHref}>{primaryLabel}</a>
              <a className="sticky-mobile-cta__btn" href={secondaryHref}>{secondaryLabel}</a>
            </div>
          )}

          {(layout === "dual-pill" || !["single-primary", "split-label", "stacked-copy"].includes(layout)) && (
            <div className="sticky-mobile-cta__row sticky-mobile-cta__row--two">
              <a className="sticky-mobile-cta__btn sticky-mobile-cta__btn--primary" href={primaryHref}>{primaryLabel}</a>
              <a className="sticky-mobile-cta__btn" href={secondaryHref}>{secondaryLabel}</a>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
