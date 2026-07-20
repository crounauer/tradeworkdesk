import type { CompanySettings, SitePage } from "@/lib/api";
import { ensureAccessibleTextColor } from "@/lib/theme";
import { resolveSiteTheme } from "@/lib/siteTheme";
import { buildPageHierarchy, flattenPageHierarchy } from "@/lib/page-hierarchy";

interface Props {
  siteName: string;
  company: CompanySettings | null;
  socialLinks: Record<string, string> | null;
  theme: Record<string, unknown>;
  pages?: SitePage[];
  tagline?: string | null;
  logoUrl?: string | null;
  footerContent?: Record<string, unknown> | null;
}

const SOCIAL_ICONS: Record<string, string> = {
  facebook: "f", instagram: "ig", twitter: "X", linkedin: "in",
  youtube: ">", tiktok: "♪",
};

export default function SiteFooter({ siteName, company, socialLinks, theme, pages = [], tagline, logoUrl, footerContent }: Props) {
  function normalizeFooterLayoutVariant(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (normalized === "default") return "four-column";
    if (normalized === "traditional") return "minimal-columns";
    return normalized;
  }

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

  const normalizedTheme = resolveSiteTheme(theme);
  const footerBg = String(theme.footer_background || theme.footerBackground || normalizedTheme.footerBackground);
  const footerText = ensureAccessibleTextColor(footerBg, String(theme.footer_text || theme.footerText || normalizedTheme.footerText));
  const accent = String(theme.accent_color || theme.accentColor || normalizedTheme.accentColor);

  const headingColor = String(theme.footer_heading_color || "#ffffff");
  const borderColor = String(theme.footer_border_color || "rgba(255,255,255,0.08)");
  const headingFont = String(theme.footer_heading_font_family || theme.global_heading_font_family || "inherit");
  const bodyFont = String(theme.footer_body_font_family || theme.global_body_font_family || "inherit");
  const headingSize = String(theme.footer_heading_size || "0.9375rem");
  const bodySize = String(theme.footer_body_size || "0.9rem");
  const layoutVariant = String(theme.footer_layout_variant || theme.footer_layout || "four-column").toLowerCase();
  const savedFooter = footerContent && typeof footerContent === "object" ? footerContent : null;

  const year = new Date().getFullYear();
  const displayName = company?.trading_name || company?.name || siteName;
  const footerLogoText = readFooterString(savedFooter, ["logoText", "logo_text"], displayName);
  const footerDescription = readFooterString(savedFooter, ["description"], tagline || "");
  const footerPhone = readFooterString(savedFooter, ["phone"], company?.phone || "");
  const footerEmail = readFooterString(savedFooter, ["email"], company?.email || "");
  const footerLayoutVariant = normalizeFooterLayoutVariant(readFooterString(savedFooter, ["layout_variant", "layout"], layoutVariant));
  const footerBackground = readFooterString(savedFooter, ["background_color", "background"], footerBg);
  const footerTextColor = readFooterString(savedFooter, ["text_color"], footerText);
  const footerHeadingColor = readFooterString(savedFooter, ["heading_color"], headingColor);
  const footerAccentColor = readFooterString(savedFooter, ["accent_color"], accent);
  const footerBorderColor = readFooterString(savedFooter, ["border_color"], borderColor);
  const footerHeadingFont = readFooterString(savedFooter, ["heading_font_family"], headingFont);
  const footerBodyFont = readFooterString(savedFooter, ["body_font_family"], bodyFont);
  const footerHeadingSize = readFooterString(savedFooter, ["heading_size"], headingSize);
  const footerBodySize = readFooterString(savedFooter, ["body_size"], bodySize);
  const footerNavItems = readFooterArray<Record<string, unknown>>(savedFooter, ["navItems"], [])
    .map((item) => ({
      label: String(item.label ?? "").trim(),
      href: String(item.href ?? "").trim(),
    }))
    .filter((item) => item.label || item.href);
  const footerLegalLinks = readFooterArray<Record<string, unknown>>(savedFooter, ["legalLinks"], [])
    .map((item) => ({
      label: String(item.label ?? "").trim(),
      href: String(item.href ?? "").trim(),
    }))
    .filter((item) => item.label || item.href);

  const navPages = pages.filter((p) => p.show_in_nav && p.page_type !== "home");
  const navHierarchy = flattenPageHierarchy(buildPageHierarchy(navPages)).filter((page) => page.page_type !== "home");
  const quickLinks = [
    ...navHierarchy.map((page) => ({ key: page.id, href: page.slug.startsWith("/") ? page.slug : `/${page.slug}`, label: page.nav_label || page.title, depth: page.depth })),
    { key: "blog", href: "/blog", label: "Blog" },
  ].filter((link, index, arr) => arr.findIndex((item) => item.href === link.href) === index);

  const infoSection = (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={displayName} style={{ height: 40, objectFit: "contain" }} />
        ) : (
          <div style={{ width: 32, height: 32, backgroundColor: accent, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🔧</div>
        )}
        <span style={{ color: footerHeadingColor, fontWeight: 700, fontSize: "1rem", fontFamily: footerHeadingFont }}>{footerLogoText || displayName}</span>
      </div>
      {footerDescription && <p style={{ fontSize: footerBodySize, lineHeight: 1.7, marginBottom: 16, fontFamily: footerBodyFont }}>{footerDescription}</p>}
      {socialLinks && Object.keys(socialLinks).length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(socialLinks).filter(([, url]) => url).map(([platform, url]) => (
            <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
              style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: footerHeadingColor, textDecoration: "none", fontSize: "0.75rem", fontWeight: 700, fontFamily: footerBodyFont }}
              title={platform}
              aria-label={`${platform.charAt(0).toUpperCase()}${platform.slice(1)} profile`}
            >
              {SOCIAL_ICONS[platform] || platform.slice(0, 2).toUpperCase()}
            </a>
          ))}
        </div>
      )}
    </div>
  );

  const resolvedQuickLinks = footerNavItems.length > 0
    ? footerNavItems.map((item, index) => ({ key: `custom-${index}`, href: item.href, label: item.label, depth: 0 }))
    : quickLinks;

  const linksSection = resolvedQuickLinks.length > 0 ? (
    <div>
      <p style={{ color: footerHeadingColor, fontWeight: 700, marginBottom: 12, fontSize: footerHeadingSize, fontFamily: footerHeadingFont }}>Quick Links</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
        {resolvedQuickLinks.map((link) => (
          <li key={link.key}>
            <a href={link.href} style={{ color: footerTextColor, textDecoration: "none", fontSize: footerBodySize, fontFamily: footerBodyFont, paddingLeft: `${Math.max(0, ((link as { depth?: number }).depth || 1) - 1) * 12}px`, display: "inline-block" }}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  const accreditationSection = (company?.gas_safe_number || company?.oftec_number) ? (
    <div>
      <p style={{ color: footerHeadingColor, fontWeight: 700, marginBottom: 12, fontSize: footerHeadingSize, fontFamily: footerHeadingFont }}>Accreditations</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {company?.gas_safe_number && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: footerBodySize, fontFamily: footerBodyFont }}>
            <span style={{ color: footerAccentColor, fontWeight: 700 }}>✓</span> Gas Safe No. {company.gas_safe_number}
          </div>
        )}
        {company?.oftec_number && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: footerBodySize, fontFamily: footerBodyFont }}>
            <span style={{ color: footerAccentColor, fontWeight: 700 }}>✓</span> OFTEC No. {company.oftec_number}
          </div>
        )}
      </div>
    </div>
  ) : null;

  const contactSection = (
    <div>
      <p style={{ color: footerHeadingColor, fontWeight: 700, marginBottom: 12, fontSize: footerHeadingSize, fontFamily: footerHeadingFont }}>Contact Us</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: footerBodySize, fontFamily: footerBodyFont }}>
        {footerPhone && (
          <a href={`tel:${footerPhone.replace(/\s/g, "")}`} style={{ color: footerTextColor, textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>📞</span> {footerPhone}
          </a>
        )}
        {footerEmail && (
          <a href={`mailto:${footerEmail}`} style={{ color: footerTextColor, textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>✉</span> {footerEmail}
          </a>
        )}
        {company?.address_line1 && (
          <address style={{ fontStyle: "normal", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>📍</span>
            <span>
              {company.address_line1}{company.address_line2 ? `, ${company.address_line2}` : ""}{company.city ? `, ${company.city}` : ""}{company.postcode ? ` ${company.postcode}` : ""}
            </span>
          </address>
        )}
      </div>
    </div>
  );

  const documentLinksSection = (company?.rates_url || company?.trading_terms_url) ? (
    <div>
      <p style={{ color: footerHeadingColor, fontWeight: 700, marginBottom: 12, fontSize: footerHeadingSize, fontFamily: footerHeadingFont }}>Customer Documents</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: footerBodySize, fontFamily: footerBodyFont }}>
        {company?.rates_url && (
          <a href={company.rates_url} target="_blank" rel="noopener noreferrer" style={{ color: footerTextColor, textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>📄</span> Pricing &amp; Rates
          </a>
        )}
        {company?.trading_terms_url && (
          <a href={company.trading_terms_url} target="_blank" rel="noopener noreferrer" style={{ color: footerTextColor, textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>📘</span> Trading Terms
          </a>
        )}
      </div>
    </div>
  ) : null;

  const customLegalLinks = footerLegalLinks.length > 0 ? footerLegalLinks : null;

  const sections = [infoSection, linksSection, accreditationSection, contactSection, documentLinksSection].filter(Boolean);

  const activeLayoutVariant = footerLayoutVariant || normalizeFooterLayoutVariant(layoutVariant);

  const topLayout =
    activeLayoutVariant === "centered-stack" ? (
      <div style={{ display: "grid", gap: 26, textAlign: "center", justifyItems: "center", marginBottom: 32 }}>
        {sections}
      </div>
    ) : activeLayoutVariant === "compact-inline" ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 28, alignItems: "start", justifyContent: "space-between" }}>
        {sections}
      </div>
    ) : activeLayoutVariant === "minimal-columns" ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 26, marginBottom: 32 }}>
        {[linksSection, contactSection, accreditationSection, documentLinksSection].filter(Boolean)}
      </div>
    ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 34, marginBottom: 40 }}>
        {sections}
      </div>
    );

  return (
    <footer style={{ backgroundColor: footerBackground, color: footerTextColor }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 24px 32px" }}>
        {topLayout}

        <div style={{ borderTop: `1px solid ${footerBorderColor}`, paddingTop: 20, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center", fontSize: "0.8125rem", fontFamily: footerBodyFont }}>
          <span>&copy; {year} {displayName}. All rights reserved.</span>
          {customLegalLinks && customLegalLinks.length > 0 ? (
            <span>{customLegalLinks.map((item) => item.label).filter(Boolean).join(" • ")}</span>
          ) : null}
          <a
            href="https://www.tradeworkdesk.co.uk"
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            style={{ opacity: 0.4, color: "inherit", textDecoration: "none" }}
            aria-label="Powered by TradeWorkDesk"
          >
            Powered by TradeWorkDesk
          </a>
        </div>
      </div>
    </footer>
  );
}
