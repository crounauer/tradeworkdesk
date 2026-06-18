import type { CompanySettings, SitePage } from "@/lib/api";

interface Props {
  siteName: string;
  company: CompanySettings | null;
  socialLinks: Record<string, string> | null;
  theme: Record<string, string>;
  pages?: SitePage[];
  tagline?: string | null;
  logoUrl?: string | null;
}

const SOCIAL_ICONS: Record<string, string> = {
  facebook: "f", instagram: "ig", twitter: "𝕏", linkedin: "in",
  youtube: "▶", tiktok: "♪",
};

export default function SiteFooter({ siteName, company, socialLinks, theme, pages = [], tagline, logoUrl }: Props) {
  const footerBg = theme?.footer_background || "#111827";
  const footerText = theme?.footer_text || "#9ca3af";
  const accent = theme?.accent_color || "#f97316";
  const year = new Date().getFullYear();
  const displayName = company?.trading_name || company?.name || siteName;

  const navPages = pages.filter((p) => p.show_in_nav && p.page_type !== "home");

  return (
    <footer style={{ backgroundColor: footerBg, color: footerText }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 24px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40, marginBottom: 48 }}>

          {/* Col 1: Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={displayName} style={{ height: 40, objectFit: "contain" }} />
              ) : (
                <div style={{ width: 32, height: 32, backgroundColor: accent, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🔧</div>
              )}
              <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>{displayName}</span>
            </div>
            {tagline && <p style={{ fontSize: "0.875rem", lineHeight: 1.7, marginBottom: 20 }}>{tagline}</p>}
            {socialLinks && Object.keys(socialLinks).length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {Object.entries(socialLinks).filter(([, url]) => url).map(([platform, url]) => (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                    style={{ width: 34, height: 34, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", textDecoration: "none", fontSize: "0.75rem", fontWeight: 700 }}
                    title={platform}
                  >
                    {SOCIAL_ICONS[platform] || platform.slice(0, 2).toUpperCase()}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Col 2: Quick Links */}
          {navPages.length > 0 && (
            <div>
              <h4 style={{ color: "#fff", fontWeight: 700, marginBottom: 16, fontSize: "0.9375rem" }}>Quick Links</h4>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {navPages.map((page) => (
                  <li key={page.id}>
                    <a href={page.slug.startsWith("/") ? page.slug : `/${page.slug}`} style={{ color: footerText, textDecoration: "none", fontSize: "0.9rem" }}>
                      {page.nav_label || page.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Col 3: Accreditations */}
          {(company?.gas_safe_number || company?.oftec_number) && (
            <div>
              <h4 style={{ color: "#fff", fontWeight: 700, marginBottom: 16, fontSize: "0.9375rem" }}>Accreditations</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {company.gas_safe_number && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
                    <span style={{ color: accent, fontWeight: 700 }}>✓</span> Gas Safe No. {company.gas_safe_number}
                  </div>
                )}
                {company.oftec_number && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
                    <span style={{ color: accent, fontWeight: 700 }}>✓</span> OFTEC No. {company.oftec_number}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Col 4: Contact */}
          <div>
            <h4 style={{ color: "#fff", fontWeight: 700, marginBottom: 16, fontSize: "0.9375rem" }}>Contact Us</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.9rem" }}>
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
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", alignItems: "center", fontSize: "0.8125rem" }}>
          <span>&copy; {year} {displayName}. All rights reserved.</span>
          <span style={{ opacity: 0.4 }}>Powered by TradeWorkDesk</span>
        </div>
      </div>
    </footer>
  );
}
