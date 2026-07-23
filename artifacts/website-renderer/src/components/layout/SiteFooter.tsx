import type { ReactNode } from "react";
import type { CompanySettings, SitePage } from "@/lib/api";

interface Props {
  siteName: string;
  company: CompanySettings | null;
  socialLinks: Record<string, string> | null;
  theme: Record<string, unknown>;
  templateSlug?: string;
  pages?: SitePage[];
  tagline?: string | null;
  logoUrl?: string | null;
  footerContent?: Record<string, unknown> | null;
}

export default function SiteFooter({ siteName, company, socialLinks, theme, templateSlug, pages = [], tagline, logoUrl, footerContent }: Props) {
  function readFooterString(content: Record<string, unknown> | null | undefined, keys: string[], fallback = ""): string {
    if (!content) return fallback;
    for (const key of keys) {
      const value = content[key];
      if (typeof value === "string" && value.trim().length > 0) return value.trim();
    }
    return fallback;
  }

  function readFooterArray<T>(content: Record<string, unknown> | null | undefined, keys: string[], fallback: T[] = []): T[] {
    if (!content) return fallback;
    for (const key of keys) {
      const value = content[key];
      if (Array.isArray(value)) return value as T[];
    }
    return fallback;
  }

  const savedFooter = footerContent && typeof footerContent === "object" ? footerContent : null;
  const footerProps = savedFooter && typeof savedFooter.props === "object"
    ? (savedFooter.props as Record<string, unknown>)
    : savedFooter;

  const displayName = company?.trading_name || company?.name || siteName;
  const footerLogoText = readFooterString(footerProps, ["logoText", "logo_text"], displayName);
  const footerDescription = readFooterString(footerProps, ["description"], tagline || "");
  const footerPhone = readFooterString(footerProps, ["phone"], company?.phone || "");
  const footerEmail = readFooterString(footerProps, ["email"], company?.email || "");
  const rawLayoutVariant = readFooterString(footerProps, ["layout_variant", "layout"], String(theme.footer_layout_variant || theme.footer_layout || "four-column")).toLowerCase();
  const footerVariant = readFooterString(footerProps, ["variant"], "default").toLowerCase();
  const footerTone = readFooterString(footerProps, ["tone"], "default").toLowerCase();
  const footerBackground = readFooterString(footerProps, ["background_color", "background"], String(theme.footer_background || "#111827"));
  const footerTextColor = readFooterString(footerProps, ["text_color"], String(theme.footer_text || "#9ca3af"));
  const footerHeadingColor = readFooterString(footerProps, ["heading_color"], "#ffffff");
  const footerBorderColor = readFooterString(footerProps, ["border_color"], "rgba(255,255,255,0.12)");
  const footerHeadingFont = readFooterString(footerProps, ["heading_font_family"], "inherit");
  const footerBodyFont = readFooterString(footerProps, ["body_font_family"], "inherit");
  const footerHeadingSize = readFooterString(footerProps, ["heading_size"], "1rem");
  const footerBodySize = readFooterString(footerProps, ["body_size"], "0.9rem");
  const poweredByHref = "https://www.tradeworkdesk.co.uk";
  const poweredByLabel = "Powered by Tradeworkdesk";
  const footerLayoutVariant = rawLayoutVariant === "default"
    ? "four-column"
    : rawLayoutVariant === "traditional"
      ? "minimal-columns"
      : rawLayoutVariant;
  const isClassic = footerVariant === "classic";
  const useNavy = readFooterString(footerProps, ["background"], "default") === "navy" || isClassic;

  const footerNavItems = readFooterArray<Record<string, unknown>>(footerProps, ["navItems", "nav_items", "footer_navigation_links", "navigation_links"], [])
    .map((item) => ({
      label: String(item.label ?? "").trim(),
      href: String(item.href ?? "").trim(),
    }))
    .filter((item) => item.label || item.href);
  const footerLegalLinks = readFooterArray<Record<string, unknown>>(footerProps, ["legalLinks", "legal_links", "footer_legal_links"], [])
    .map((item) => ({
      label: String(item.label ?? "").trim(),
      href: String(item.href ?? "").trim(),
    }))
    .filter((item) => item.label || item.href);
  const navItems = footerNavItems.length > 0
    ? footerNavItems
    : pages
        .filter((p) => p.show_in_nav && p.page_type !== "home")
        .map((page) => ({
          label: page.nav_label || page.title,
          href: page.slug.startsWith("/") ? page.slug : `/${page.slug}`,
        }));

  const socialPlatformConfig: Array<{ label: string; keys: string[] }> = [
    { label: "Facebook", keys: ["facebook"] },
    { label: "Instagram", keys: ["instagram"] },
    { label: "X", keys: ["x", "twitter"] },
    { label: "LinkedIn", keys: ["linkedin"] },
    { label: "YouTube", keys: ["youtube"] },
  ];

  function normalizeExternalUrl(raw: string): string {
    const value = raw.trim();
    if (!value) return "";
    if (value.startsWith("#")) return "";
    if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value) || /^tel:/i.test(value)) {
      return value;
    }
    return `https://${value}`;
  }

  const resolvedSocialLinks = socialPlatformConfig
    .map((platform) => {
      const rawValue = platform.keys
        .map((key) => String((socialLinks || {})[key] || "").trim())
        .find((value) => value.length > 0) || "";
      const href = normalizeExternalUrl(rawValue);
      return href ? { label: platform.label, href } : null;
    })
    .filter((item): item is { label: string; href: string } => item !== null);

  const hasSocialLinks = resolvedSocialLinks.length > 0;

  function renderSocialIcon(label: string): ReactNode {
    const baseProps = {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "currentColor",
      ariaHidden: true,
    } as const;

    switch (label) {
      case "Facebook":
        return (
          <svg width={baseProps.width} height={baseProps.height} viewBox={baseProps.viewBox} fill={baseProps.fill} aria-hidden={baseProps.ariaHidden}>
            <path d="M22 12a10 10 0 1 0-11.56 9.88V14.9H7.9V12h2.54V9.8c0-2.5 1.5-3.88 3.8-3.88 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.9h-2.33v6.98A10 10 0 0 0 22 12" />
          </svg>
        );
      case "Instagram":
        return (
          <svg width={baseProps.width} height={baseProps.height} viewBox={baseProps.viewBox} fill="none" aria-hidden={baseProps.ariaHidden}>
            <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
            <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
          </svg>
        );
      case "X":
        return (
          <svg width={baseProps.width} height={baseProps.height} viewBox={baseProps.viewBox} fill={baseProps.fill} aria-hidden={baseProps.ariaHidden}>
            <path d="M18.9 3H22l-6.77 7.74L23.2 21h-6.27l-4.91-6.43L6.4 21H3.3l7.24-8.28L2.8 3h6.43l4.44 5.86L18.9 3Zm-1.1 16h1.74L8.3 4.9H6.44L17.8 19Z" />
          </svg>
        );
      case "LinkedIn":
        return (
          <svg width={baseProps.width} height={baseProps.height} viewBox={baseProps.viewBox} fill={baseProps.fill} aria-hidden={baseProps.ariaHidden}>
            <path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0-.02-5ZM3 9h4v12H3V9Zm7 0h3.8v1.71h.05c.53-1 1.84-2.06 3.78-2.06 4.04 0 4.79 2.66 4.79 6.12V21h-4v-5.47c0-1.3-.02-2.98-1.82-2.98-1.82 0-2.1 1.42-2.1 2.88V21h-4V9Z" />
          </svg>
        );
      case "YouTube":
        return (
          <svg width={baseProps.width} height={baseProps.height} viewBox={baseProps.viewBox} fill={baseProps.fill} aria-hidden={baseProps.ariaHidden}>
            <path d="M23.5 7.1a3.02 3.02 0 0 0-2.12-2.14C19.49 4.5 12 4.5 12 4.5s-7.5 0-9.38.46A3.02 3.02 0 0 0 .5 7.1 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 4.9 3.02 3.02 0 0 0 2.12 2.14C4.5 19.5 12 19.5 12 19.5s7.49 0 9.38-.46a3.02 3.02 0 0 0 2.12-2.14A31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-4.9ZM9.6 15.2V8.8L15.8 12l-6.2 3.2Z" />
          </svg>
        );
      default:
        return <span style={{ fontSize: "0.65rem", fontWeight: 700 }}>{label.slice(0, 1)}</span>;
    }
  }

  function socialButtonStyle(color: string): Record<string, string | number> {
    return {
      width: 28,
      height: 28,
      borderRadius: 999,
      border: `1px solid ${color}`,
      color,
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      lineHeight: 1,
    };
  }

  function getSocialBrandColor(label: string): string {
    switch (label) {
      case "Facebook":
        return "#1877F2";
      case "Instagram":
        return "#E1306C";
      case "X":
        return "#111111";
      case "LinkedIn":
        return "#0A66C2";
      case "YouTube":
        return "#FF0000";
      default:
        return "#64748b";
    }
  }

  const socialIconButtonCss = `
    .twd-social-btn {
      transition: background-color 180ms ease, color 180ms ease, border-color 180ms ease, transform 180ms ease;
    }
    .twd-social-btn:hover {
      background: var(--social-accent, #64748b);
      border-color: var(--social-accent, #64748b) !important;
      color: #ffffff !important;
      transform: translateY(-1px);
    }
    .twd-social-btn:focus-visible {
      outline: 2px solid var(--social-accent, #64748b);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      .twd-social-btn { transition: none; }
    }
  `;
  const normalizedTemplateSlug = String(templateSlug || "").trim().toLowerCase();

  if (normalizedTemplateSlug === "local-plumbing-pro" && !footerProps) {
    const phoneHref = `tel:${footerPhone.replace(/\s/g, "")}`;
    const primaryColor = String(theme.primary_color || "#1a3a6b");
    const accentColor = String(theme.accent_color || "#00a8a8");
    const primaryText = String(theme.primary_text_color || "#ffffff");
    const effectiveLayoutVariant = footerLayoutVariant === "split-brand" ? "compact-inline" : footerLayoutVariant;
    const resolvedBackground = footerBackground === "default" ? primaryColor : footerBackground;
    const resolvedTextColor = footerTextColor === "default" ? primaryText : footerTextColor;
    const resolvedBorderColor = footerBorderColor === "default" ? "rgba(255,255,255,0.1)" : footerBorderColor;
    const mutedText = "rgba(255,255,255,0.7)";
    const mutedTextSoft = "rgba(255,255,255,0.6)";
    const servicesLinks = navItems.length > 0
      ? navItems.slice(0, 7)
      : [
          { label: "Leak Repair", href: "/services" },
          { label: "Taps & Mixers", href: "/services" },
          { label: "Toilets", href: "/services" },
          { label: "Showers", href: "/services" },
          { label: "Pipework", href: "/services" },
          { label: "Radiators", href: "/services" },
          { label: "Emergency Plumbing", href: "/emergency" },
        ];
    const quickLinks = navItems.length > 0
      ? navItems
      : [
          { label: "About Us", href: "/" },
          { label: "Areas Covered", href: "/areas" },
          { label: "Customer Reviews", href: "/reviews" },
          { label: "Photo Gallery", href: "/gallery" },
          { label: "Blog", href: "/blog" },
          { label: "Book Online", href: "/booking" },
          { label: "Contact Us", href: "/contact" },
        ];

    return (
      <footer style={{ background: resolvedBackground, color: resolvedTextColor }}>
        <style>{socialIconButtonCss}</style>
        {effectiveLayoutVariant === "compact-inline" ? (
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px", display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
            <div style={{ minWidth: 240 }}>
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: accentColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>💧</span>
                </div>
                <span style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "var(--font-display), system-ui, sans-serif" }}>{footerLogoText || displayName}</span>
              </div>
              {footerDescription ? <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.6, color: mutedText }}>{footerDescription}</p> : null}
            </div>
            <div style={{ minWidth: 200 }}>
              <h4 style={{ margin: "0 0 10px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Links</h4>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: "0.875rem", color: mutedTextSoft }}>
                {navItems.map((item) => (
                  <a key={`${item.label}-${item.href}`} href={item.href} style={{ color: "inherit", textDecoration: "none" }}>{item.label}</a>
                ))}
              </div>
            </div>
            <div style={{ minWidth: 200 }}>
              <h4 style={{ margin: "0 0 10px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Contact</h4>
              <div style={{ display: "grid", gap: 4, fontSize: "0.875rem", color: mutedText }}>
                {footerPhone ? <a href={phoneHref} style={{ color: "inherit", textDecoration: "none" }}>{footerPhone}</a> : null}
                {footerEmail ? <a href={`mailto:${footerEmail}`} style={{ color: "inherit", textDecoration: "none" }}>{footerEmail}</a> : null}
              </div>
            </div>
          </div>
        ) : effectiveLayoutVariant === "centered-stack" ? (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
            <div style={{ marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: accentColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>💧</span>
              </div>
              <span style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "var(--font-display), system-ui, sans-serif" }}>{footerLogoText || displayName}</span>
            </div>
            {footerDescription ? <p style={{ margin: "0 0 12px", fontSize: "0.875rem", lineHeight: 1.6, color: mutedText }}>{footerDescription}</p> : null}
            <div style={{ margin: "0 0 12px", display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", fontSize: "0.875rem", color: mutedTextSoft }}>
              {quickLinks.map((item) => (
                <a key={`${item.label}-${item.href}`} href={item.href} style={{ color: "inherit", textDecoration: "none" }}>{item.label}</a>
              ))}
            </div>
            <div style={{ display: "grid", gap: 6, justifyItems: "center", fontSize: "0.875rem", color: mutedText }}>
              {footerPhone ? <a href={phoneHref} style={{ color: accentColor, textDecoration: "none", fontWeight: 700 }}>{footerPhone}</a> : null}
              {footerEmail ? <a href={`mailto:${footerEmail}`} style={{ color: "inherit", textDecoration: "none" }}>{footerEmail}</a> : null}
            </div>
          </div>
        ) : effectiveLayoutVariant === "minimal-columns" ? (
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
            <div>
              <h4 style={{ margin: "0 0 12px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Quick Links</h4>
              <div style={{ display: "grid", gap: 6, fontSize: "0.875rem", color: mutedTextSoft }}>
                {quickLinks.map((item) => (
                  <a key={`${item.label}-${item.href}`} href={item.href} style={{ color: "inherit", textDecoration: "none" }}>{item.label}</a>
                ))}
              </div>
            </div>
            <div>
              <h4 style={{ margin: "0 0 12px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Contact</h4>
              <div style={{ display: "grid", gap: 6, fontSize: "0.875rem", color: mutedText }}>
                {footerPhone ? <a href={phoneHref} style={{ color: "inherit", textDecoration: "none" }}>{footerPhone}</a> : null}
                {footerEmail ? <a href={`mailto:${footerEmail}`} style={{ color: "inherit", textDecoration: "none" }}>{footerEmail}</a> : null}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 32 }}>
          <div>
            <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: accentColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>💧</span>
              </div>
              <span style={{ fontSize: "1.125rem", fontWeight: 700, fontFamily: "var(--font-display), system-ui, sans-serif" }}>{footerLogoText || displayName}</span>
            </div>
            {footerDescription ? (
              <p style={{ margin: "0 0 16px", fontSize: "0.875rem", lineHeight: 1.6, color: mutedText }}>{footerDescription}</p>
            ) : null}
            {footerPhone ? (
              <a href={phoneHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, color: accentColor, textDecoration: "none", fontWeight: 700 }}>
                <span aria-hidden="true">📞</span> {footerPhone}
              </a>
            ) : null}
          </div>

          <div>
            <h4 style={{ margin: "0 0 16px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Services</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8, fontSize: "0.875rem", color: mutedTextSoft }}>
              {servicesLinks.map((item) => (
                <li key={`${item.label}-${item.href}`}>
                  <a href={item.href} style={{ color: "inherit", textDecoration: "none" }}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ margin: "0 0 16px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Quick Links</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8, fontSize: "0.875rem", color: mutedTextSoft }}>
              {quickLinks.map((item) => (
                <li key={`${item.label}-${item.href}`}>
                  <a href={item.href} style={{ color: "inherit", textDecoration: "none" }}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ margin: "0 0 16px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>Contact</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12, fontSize: "0.875rem", color: mutedText }}>
              {footerPhone ? (
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ color: accentColor }} aria-hidden="true">📞</span>
                  <span>{footerPhone}</span>
                </li>
              ) : null}
              {footerEmail ? (
                <li style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ color: accentColor }} aria-hidden="true">✉</span>
                  <span>{footerEmail}</span>
                </li>
              ) : null}
              <li style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: accentColor }} aria-hidden="true">📍</span>
                <span>Reading, Berkshire &amp; surrounding areas within 20 miles</span>
              </li>
              <li style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: accentColor }} aria-hidden="true">🕒</span>
                <span>Mon-Sat 7am-8pm<br />Emergency cover 24/7</span>
              </li>
            </ul>
          </div>
        </div>
        )}

        <div style={{ borderTop: `1px solid ${resolvedBorderColor}` }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)" }}>
            <span>© {new Date().getFullYear()} {footerLogoText || displayName}. All rights reserved.</span>
            {hasSocialLinks ? (
              <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>Follow us:</span>
                {resolvedSocialLinks.map((item) => (
                  <a
                    key={`footer-social-${item.label}`}
                    href={item.href}
                    className="twd-social-btn"
                    style={{
                      ...socialButtonStyle("rgba(255,255,255,0.85)"),
                      ["--social-accent" as any]: getSocialBrandColor(item.label),
                    }}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    title={item.label}
                  >
                    {renderSocialIcon(item.label)}
                  </a>
                ))}
              </span>
            ) : null}
            <a href={poweredByHref} style={{ color: "inherit", textDecoration: "none" }}>{poweredByLabel}</a>
          </div>
          {footerLegalLinks.length > 0 ? (
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px 12px", display: "flex", gap: 12, flexWrap: "wrap", fontSize: "0.78rem", color: "rgba(255,255,255,0.7)" }}>
              {footerLegalLinks.map((item) => (
                <a key={`bottom-legal-${item.label}-${item.href}`} href={item.href} style={{ color: "inherit", textDecoration: "none" }}>{item.label}</a>
              ))}
            </div>
          ) : null}
        </div>
      </footer>
    );
  }

  const effectiveLayoutVariant = footerLayoutVariant === "split-brand" ? "compact-inline" : footerLayoutVariant;
  const resolvedBackground = footerBackground === "default" ? "#0f172a" : footerBackground;
  const resolvedTextColor = footerTextColor === "default" ? "#cbd5e1" : footerTextColor;
  const resolvedHeadingColor = footerHeadingColor === "default" ? "#ffffff" : footerHeadingColor;
  const resolvedBorderColor = footerBorderColor === "default" ? "rgba(255,255,255,0.12)" : footerBorderColor;
  const headingStyle = {
    color: resolvedHeadingColor,
    fontFamily: footerHeadingFont,
    fontSize: footerHeadingSize,
  };
  const bodyStyle = {
    color: resolvedTextColor,
    fontFamily: footerBodyFont,
    fontSize: footerBodySize,
    lineHeight: footerTone === "formal" ? 1.75 : 1.5,
  };
  const navLinks = navItems.length > 0 ? navItems : [
    { label: "Home", href: "/" },
    { label: "Services", href: "/services" },
    { label: "Contact", href: "/contact" },
  ];
  const legalLinks = footerLegalLinks.length > 0 ? footerLegalLinks : [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ];
  const linkStyle = { color: resolvedTextColor, textDecoration: "none", display: "inline-block" };
  const footerWidth = { maxWidth: 1200, margin: "0 auto" };

  return (
    <footer style={{ background: resolvedBackground, color: resolvedTextColor, padding: "48px 24px 14px" }}>
      <style>{socialIconButtonCss}</style>
      <div style={footerWidth}>
        {effectiveLayoutVariant === "centered-stack" ? (
          <div style={{ margin: "0 auto", maxWidth: 900, textAlign: "center", display: "grid", gap: 10 }}>
            <p style={{ ...headingStyle, fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{footerLogoText || displayName}</p>
            {footerDescription ? (
              <p style={{ ...bodyStyle, margin: 0 }}>{footerDescription}</p>
            ) : null}
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", ...bodyStyle }}>
              {navLinks.map((item) => (
                <a key={`center-nav-${item.href}`} href={item.href} style={linkStyle}>{item.label}</a>
              ))}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              {footerPhone ? <a href={`tel:${footerPhone.replace(/\s/g, "")}`} style={linkStyle}>{footerPhone}</a> : null}
              {footerEmail ? <a href={`mailto:${footerEmail}`} style={linkStyle}>{footerEmail}</a> : null}
            </div>
          </div>
        ) : effectiveLayoutVariant === "compact-inline" ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ minWidth: 240 }}>
              <p style={{ ...headingStyle, fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{footerLogoText || displayName}</p>
              {footerDescription ? <p style={{ margin: "8px 0 0", ...bodyStyle }}>{footerDescription}</p> : null}
            </div>
            <div style={{ minWidth: 220 }}>
              <p style={{ ...headingStyle, fontWeight: 600, margin: 0 }}>Links</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4, ...bodyStyle }}>
                {navLinks.map((item) => (
                  <a key={`compact-nav-${item.href}`} href={item.href} style={linkStyle}>{item.label}</a>
                ))}
              </div>
            </div>
            <div style={{ minWidth: 220 }}>
              <p style={{ ...headingStyle, fontWeight: 600, margin: 0 }}>Contact</p>
              <div style={{ marginTop: 4, display: "grid", gap: 4, ...bodyStyle }}>
                {footerPhone ? <a href={`tel:${footerPhone.replace(/\s/g, "")}`} style={linkStyle}>{footerPhone}</a> : null}
                {footerEmail ? <a href={`mailto:${footerEmail}`} style={linkStyle}>{footerEmail}</a> : null}
              </div>
            </div>
          </div>
        ) : effectiveLayoutVariant === "minimal-columns" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
            <div>
              <p style={{ ...headingStyle, fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{footerLogoText || displayName}</p>
              {footerDescription ? <p style={{ margin: "8px 0 0", ...bodyStyle }}>{footerDescription}</p> : null}
            </div>
            <div>
              <p style={{ ...headingStyle, fontWeight: 600, margin: 0 }}>Links</p>
              <div style={{ marginTop: 8, display: "grid", gap: 4, ...bodyStyle }}>
                {navLinks.map((item) => (
                  <a key={`min-nav-${item.href}`} href={item.href} style={linkStyle}>{item.label}</a>
                ))}
              </div>
            </div>
            <div>
              <p style={{ ...headingStyle, fontWeight: 600, margin: 0 }}>Contact</p>
              <div style={{ marginTop: 8, display: "grid", gap: 4, ...bodyStyle }}>
                {footerPhone ? <a href={`tel:${footerPhone.replace(/\s/g, "")}`} style={linkStyle}>{footerPhone}</a> : null}
                {footerEmail ? <a href={`mailto:${footerEmail}`} style={linkStyle}>{footerEmail}</a> : null}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
            <div>
              <p style={{ ...headingStyle, fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>{footerLogoText || displayName}</p>
              {footerDescription ? <p style={{ margin: "8px 0 0", ...bodyStyle }}>{footerDescription}</p> : null}
            </div>
            <div>
              <p style={{ ...headingStyle, fontWeight: 600, margin: 0 }}>Services & Pages</p>
              <nav style={{ marginTop: 8, display: "grid", gap: 4, ...bodyStyle }}>
                {navLinks.map((item) => (
                  <a key={`four-nav-${item.href}`} href={item.href} style={linkStyle}>{item.label}</a>
                ))}
              </nav>
            </div>
            <div>
              <p style={{ ...headingStyle, fontWeight: 600, margin: 0 }}>Contact</p>
              <div style={{ marginTop: 8, display: "grid", gap: 4, ...bodyStyle }}>
                {footerPhone ? <a href={`tel:${footerPhone.replace(/\s/g, "")}`} style={linkStyle}>{footerPhone}</a> : null}
                {footerEmail ? <a href={`mailto:${footerEmail}`} style={linkStyle}>{footerEmail}</a> : null}
              </div>
            </div>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${resolvedBorderColor}`, marginTop: 16, paddingTop: 10, ...bodyStyle, fontSize: "0.78rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {legalLinks.map((item) => (
                <a key={`footer-bottom-legal-${item.href}`} href={item.href} style={linkStyle}>{item.label}</a>
              ))}
            </div>
            {hasSocialLinks ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ opacity: 0.85 }}>Follow us:</span>
                {resolvedSocialLinks.map((item) => (
                  <a
                    key={`footer-bottom-social-${item.label}`}
                    href={item.href}
                    className="twd-social-btn"
                    style={{
                      ...socialButtonStyle(resolvedTextColor),
                      ["--social-accent" as any]: getSocialBrandColor(item.label),
                    }}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={item.label}
                    title={item.label}
                  >
                    {renderSocialIcon(item.label)}
                  </a>
                ))}
              </div>
            ) : null}
            <a href={poweredByHref} style={linkStyle}>{poweredByLabel}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
