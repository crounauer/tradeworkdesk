import type { CompanySettings, SitePage } from "@/lib/api";
import { resolveSiteTheme } from "@/lib/siteTheme";

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

export default function SiteFooter({ siteName, company, socialLinks, theme, pages = [], tagline, logoUrl, footerContent }: Props) {
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
  const savedFooter = footerContent && typeof footerContent === "object" ? footerContent : null;

  const displayName = company?.trading_name || company?.name || siteName;
  const footerLogoText = readFooterString(savedFooter, ["logoText", "logo_text"], displayName);
  const footerDescription = readFooterString(savedFooter, ["description"], tagline || "");
  const footerPhone = readFooterString(savedFooter, ["phone"], company?.phone || "");
  const footerEmail = readFooterString(savedFooter, ["email"], company?.email || "");
  const footerLayoutVariant = readFooterString(savedFooter, ["layout_variant", "layout"], String(theme.footer_layout_variant || theme.footer_layout || "four-column")).toLowerCase();
  const footerBackground = readFooterString(savedFooter, ["background_color", "background"], String(theme.footer_background || theme.footerBackground || normalizedTheme.footerBackground));
  const footerTextColor = readFooterString(savedFooter, ["text_color"], String(theme.footer_text || theme.footerText || normalizedTheme.footerText));
  const footerHeadingColor = readFooterString(savedFooter, ["heading_color"], String(theme.footer_heading_color || "#ffffff"));
  const footerBorderColor = readFooterString(savedFooter, ["border_color"], String(theme.footer_border_color || "rgba(255,255,255,0.08)"));
  const footerHeadingFont = readFooterString(savedFooter, ["heading_font_family"], String(theme.footer_heading_font_family || theme.global_heading_font_family || "inherit"));
  const footerBodyFont = readFooterString(savedFooter, ["body_font_family"], String(theme.footer_body_font_family || theme.global_body_font_family || "inherit"));
  const footerHeadingSize = readFooterString(savedFooter, ["heading_size"], String(theme.footer_heading_size || "0.9375rem"));
  const footerBodySize = readFooterString(savedFooter, ["body_size"], String(theme.footer_body_size || "0.9rem"));
  const footerVariant = readFooterString(savedFooter, ["variant"], "default").toLowerCase();
  const footerTone = readFooterString(savedFooter, ["tone"], "default").toLowerCase();
  const isClassic = footerVariant === "classic";
  const isTraditional = footerLayoutVariant === "traditional" || footerLayoutVariant === "minimal-columns";
  const useNavy = readFooterString(savedFooter, ["background"], "default") === "navy" || isClassic;

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
  const navItems = footerNavItems.length > 0
    ? footerNavItems
    : pages
        .filter((p) => p.show_in_nav && p.page_type !== "home")
        .map((page) => ({
          label: page.nav_label || page.title,
          href: page.slug.startsWith("/") ? page.slug : `/${page.slug}`,
        }));

  const sectionClassName = useNavy
    ? "px-6 py-12 text-white lg:px-8"
    : "bg-slate-950 px-6 py-12 text-white lg:px-8";
  const gridClassName = isTraditional
    ? "mx-auto grid max-w-7xl gap-8 md:grid-cols-4"
    : "mx-auto grid max-w-7xl gap-8 md:grid-cols-3";

  const year = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: footerBackground, color: footerTextColor }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 24px 32px" }}>
        <div className={gridClassName}>
          <div>
            <p style={{ color: footerHeadingColor, fontSize: "1.25rem", fontWeight: 700, fontFamily: footerHeadingFont }}>{footerLogoText || displayName}</p>
            {footerDescription ? (
              <p style={{ marginTop: 12, fontSize: footerBodySize, color: footerTextColor, fontFamily: footerBodyFont, lineHeight: footerTone === "formal" ? 1.75 : 1.5 }}>
                {footerDescription}
              </p>
            ) : null}
          </div>

          <div>
            <p style={{ color: footerHeadingColor, fontWeight: 600, fontFamily: footerHeadingFont }}>Services & Pages</p>
            <nav style={{ marginTop: 12, display: "grid", gap: 8, fontSize: footerBodySize, color: footerTextColor, fontFamily: footerBodyFont }}>
              {navItems.map((item) => (
                <a key={item.href} href={item.href} style={{ color: footerTextColor, textDecoration: "none" }}>{item.label}</a>
              ))}
            </nav>
          </div>

          {isTraditional ? (
            <div>
              <p style={{ color: footerHeadingColor, fontWeight: 600, fontFamily: footerHeadingFont }}>Areas</p>
              <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: footerBodySize, color: footerTextColor, fontFamily: footerBodyFont }}>
                <span>Aberdeen</span>
                <span>Ellon</span>
                <span>Inverurie</span>
              </div>
            </div>
          ) : null}

          <div>
            <p style={{ color: footerHeadingColor, fontWeight: 600, fontFamily: footerHeadingFont }}>Contact</p>
            <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: footerBodySize, color: footerTextColor, fontFamily: footerBodyFont }}>
              {footerPhone ? <a href={`tel:${footerPhone.replace(/\s/g, "")}`} style={{ color: footerTextColor, textDecoration: "none" }}>{footerPhone}</a> : null}
              {footerEmail ? <a href={`mailto:${footerEmail}`} style={{ color: footerTextColor, textDecoration: "none" }}>{footerEmail}</a> : null}
            </div>

            <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 16, fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>
              {footerLegalLinks.map((link) => (
                <a key={link.href} href={link.href} style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>{link.label}</a>
              ))}
            </div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${footerBorderColor}`, marginTop: 24, paddingTop: 16, fontSize: "0.75rem", color: footerTextColor }}>
          <span>&copy; {year} {displayName}. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
