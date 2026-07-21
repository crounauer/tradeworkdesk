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
            <a href={poweredByHref} style={linkStyle}>{poweredByLabel}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
