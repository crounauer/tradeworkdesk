import type { CompanySettings, SitePage } from "@/lib/api";
import { ensureAccessibleTextColor } from "@/lib/theme";
import { resolveSiteTheme } from "@/lib/siteTheme";

interface Props {
  siteName: string;
  company: CompanySettings | null;
  socialLinks: Record<string, string> | null;
  theme: Record<string, unknown>;
  pages?: SitePage[];
  tagline?: string | null;
  logoUrl?: string | null;
}

const SOCIAL_ICONS: Record<string, string> = {
  facebook: "f", instagram: "ig", twitter: "X", linkedin: "in",
  youtube: ">", tiktok: "♪",
};

export default function SiteFooter({ siteName, company, socialLinks, theme, pages = [], tagline, logoUrl }: Props) {
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

  const year = new Date().getFullYear();
  const displayName = company?.trading_name || company?.name || siteName;

  const navPages = pages.filter((p) => p.show_in_nav && p.page_type !== "home");
  const quickLinks = [
    ...navPages.map((page) => ({ key: page.id, href: page.slug.startsWith("/") ? page.slug : `/${page.slug}`, label: page.nav_label || page.title })),
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
        <span style={{ color: headingColor, fontWeight: 700, fontSize: "1rem", fontFamily: headingFont }}>{displayName}</span>
      </div>
      {tagline && <p style={{ fontSize: bodySize, lineHeight: 1.7, marginBottom: 16, fontFamily: bodyFont }}>{tagline}</p>}
      {socialLinks && Object.keys(socialLinks).length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {Object.entries(socialLinks).filter(([, url]) => url).map(([platform, url]) => (
            <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
              style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: headingColor, textDecoration: "none", fontSize: "0.75rem", fontWeight: 700, fontFamily: bodyFont }}
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

  const linksSection = quickLinks.length > 0 ? (
    <div>
      <p style={{ color: headingColor, fontWeight: 700, marginBottom: 12, fontSize: headingSize, fontFamily: headingFont }}>Quick Links</p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
        {quickLinks.map((link) => (
          <li key={link.key}>
            <a href={link.href} style={{ color: footerText, textDecoration: "none", fontSize: bodySize, fontFamily: bodyFont }}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  const accreditationSection = (company?.gas_safe_number || company?.oftec_number) ? (
    <div>
      <p style={{ color: headingColor, fontWeight: 700, marginBottom: 12, fontSize: headingSize, fontFamily: headingFont }}>Accreditations</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {company?.gas_safe_number && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: bodySize, fontFamily: bodyFont }}>
            <span style={{ color: accent, fontWeight: 700 }}>✓</span> Gas Safe No. {company.gas_safe_number}
          </div>
        )}
        {company?.oftec_number && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: bodySize, fontFamily: bodyFont }}>
            <span style={{ color: accent, fontWeight: 700 }}>✓</span> OFTEC No. {company.oftec_number}
          </div>
        )}
      </div>
    </div>
  ) : null;

  const contactSection = (
    <div>
      <p style={{ color: headingColor, fontWeight: 700, marginBottom: 12, fontSize: headingSize, fontFamily: headingFont }}>Contact Us</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: bodySize, fontFamily: bodyFont }}>
        {company?.phone && (
          <a href={`tel:${company.phone.replace(/\s/g, "")}`} style={{ color: footerText, textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>📞</span> {company.phone}
          </a>
        )}
        {company?.email && (
          <a href={`mailto:${company.email}`} style={{ color: footerText, textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>✉</span> {company.email}
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
      <p style={{ color: headingColor, fontWeight: 700, marginBottom: 12, fontSize: headingSize, fontFamily: headingFont }}>Customer Documents</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: bodySize, fontFamily: bodyFont }}>
        {company?.rates_url && (
          <a href={company.rates_url} target="_blank" rel="noopener noreferrer" style={{ color: footerText, textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>📄</span> Pricing &amp; Rates
          </a>
        )}
        {company?.trading_terms_url && (
          <a href={company.trading_terms_url} target="_blank" rel="noopener noreferrer" style={{ color: footerText, textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span>📘</span> Trading Terms
          </a>
        )}
      </div>
    </div>
  ) : null;

  const sections = [infoSection, linksSection, accreditationSection, contactSection, documentLinksSection].filter(Boolean);

  const topLayout =
    layoutVariant === "centered-stack" ? (
      <div style={{ display: "grid", gap: 26, textAlign: "center", justifyItems: "center", marginBottom: 32 }}>
        {sections}
      </div>
    ) : layoutVariant === "compact-inline" ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 28, alignItems: "start", justifyContent: "space-between" }}>
        {sections}
      </div>
    ) : layoutVariant === "minimal-columns" ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 26, marginBottom: 32 }}>
        {[linksSection, contactSection, accreditationSection, documentLinksSection].filter(Boolean)}
      </div>
    ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 34, marginBottom: 40 }}>
        {sections}
      </div>
    );

  return (
    <footer style={{ backgroundColor: footerBg, color: footerText }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 24px 32px" }}>
        {topLayout}

        <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 20, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center", fontSize: "0.8125rem", fontFamily: bodyFont }}>
          <span>&copy; {year} {displayName}. All rights reserved.</span>
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
