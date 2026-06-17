import type { CompanySettings } from "@/lib/api";

interface Props {
  siteName: string;
  company: CompanySettings | null;
  socialLinks: Record<string, string> | null;
  theme: Record<string, string>;
}

export default function SiteFooter({ siteName, company, socialLinks, theme }: Props) {
  const footerBg = theme?.footer_background || "#111827";
  const footerText = theme?.footer_text || "#9ca3af";

  const year = new Date().getFullYear();

  return (
    <footer style={{ backgroundColor: footerBg, color: footerText, padding: "48px 24px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40, marginBottom: 40 }}>
          {/* Company info */}
          <div>
            <h4 style={{ color: "#fff", fontWeight: 700, marginBottom: 16, fontSize: "1rem" }}>
              {company?.trading_name || company?.name || siteName}
            </h4>
            {company?.address_line1 && (
              <address style={{ fontStyle: "normal", lineHeight: 1.7 }}>
                <div>{company.address_line1}</div>
                {company.address_line2 && <div>{company.address_line2}</div>}
                {company.city && <div>{company.city}</div>}
                {company.postcode && <div>{company.postcode}</div>}
              </address>
            )}
          </div>

          {/* Contact */}
          {(company?.phone || company?.email) && (
            <div>
              <h4 style={{ color: "#fff", fontWeight: 700, marginBottom: 16, fontSize: "1rem" }}>Contact</h4>
              {company.phone && (
                <div style={{ marginBottom: 8 }}>
                  <a href={`tel:${company.phone}`} style={{ color: footerText, textDecoration: "none" }}>
                    {company.phone}
                  </a>
                </div>
              )}
              {company.email && (
                <div>
                  <a href={`mailto:${company.email}`} style={{ color: footerText, textDecoration: "none" }}>
                    {company.email}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Accreditations */}
          {(company?.gas_safe_number || company?.oftec_number) && (
            <div>
              <h4 style={{ color: "#fff", fontWeight: 700, marginBottom: 16, fontSize: "1rem" }}>Accreditations</h4>
              {company.gas_safe_number && (
                <div style={{ marginBottom: 8 }}>Gas Safe: {company.gas_safe_number}</div>
              )}
              {company.oftec_number && (
                <div>OFTEC: {company.oftec_number}</div>
              )}
            </div>
          )}

          {/* Social */}
          {socialLinks && Object.keys(socialLinks).length > 0 && (
            <div>
              <h4 style={{ color: "#fff", fontWeight: 700, marginBottom: 16, fontSize: "1rem" }}>Follow Us</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(socialLinks).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: footerText, textDecoration: "none", textTransform: "capitalize" }}
                  >
                    {platform}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 24, textAlign: "center", fontSize: "0.875rem" }}>
          &copy; {year} {company?.trading_name || company?.name || siteName}. All rights reserved.
          <span style={{ marginLeft: 16, opacity: 0.5 }}>Powered by TradeWorkDesk</span>
        </div>
      </div>
    </footer>
  );
}
