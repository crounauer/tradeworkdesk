
"use client";

import { useState } from "react";
import type { SitePage } from "@/lib/api";
import Link from "next/link";
import { ensureAccessibleTextColor } from "@/lib/theme";
import { resolveSiteTheme } from "@/lib/siteTheme";

interface CompanyInfo {
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  county?: string | null;
  gas_safe_number?: string | null;
  oftec_number?: string | null;
}

interface Props {
  siteName: string;
  logoUrl: string | null;
  pages: SitePage[];
  theme: Record<string, unknown>;
  templateSlug?: string;
  company?: CompanyInfo | null;
  basePath?: string;
  previewToken?: string;
  showTopBar?: boolean;
}

export default function SiteHeader({ siteName, logoUrl, pages, theme, templateSlug, company, basePath, previewToken, showTopBar = true }: Props) {
  const isModernTrade = String(templateSlug || "").toLowerCase() === "modern-trade";
  const isLocalPlumbingPro = String(templateSlug || "").toLowerCase() === "local-plumbing-pro";
  const normalizedTheme = resolveSiteTheme(theme, templateSlug);
  const navBg = normalizedTheme.navBackground;
  const navText = ensureAccessibleTextColor(navBg, normalizedTheme.navText);
  const accent = normalizedTheme.accentColor;
  const [menuOpen, setMenuOpen] = useState(false);

  function pageHref(page: SitePage): string {
    if (basePath) {
      const slug = page.page_type === "home" ? "/" : (page.slug.startsWith("/") ? page.slug.slice(1) : page.slug);
      const tokenParam = previewToken ? `&token=${previewToken}` : "";
      if (slug === "/") return previewToken ? `${basePath}?token=${previewToken}` : basePath;
      return `${basePath}?page=${encodeURIComponent(slug)}${tokenParam}`;
    }
    return page.slug.startsWith("/") ? page.slug : `/${page.slug}`;
  }

  const homeHref = basePath ? (previewToken ? `${basePath}?token=${previewToken}` : basePath) : "/";
  const contactPage = pages.find((p) => p.page_type === "contact" || p.slug?.includes("contact"));
  const ctaHref = contactPage ? pageHref(contactPage) : (basePath ? `${basePath}?page=contact` : "/contact");

  // Slightly darker shade for top bar
  const topBarBg = navBg + "dd";

  const hasTopBar = !isModernTrade && showTopBar && !!(company?.phone || company?.email || company?.gas_safe_number || company?.oftec_number);

  if (isLocalPlumbingPro) {
    const topBarBg = "rgba(223,236,255,0.95)";
    const topBarText = "#1a3a6b";
    const mainNavText = "#334155";
    const ctaBg = "#00a8a8";
    const ctaBorder = "rgba(26, 58, 107, 0.12)";

    return (
      <header style={{ position: "sticky", top: 0, zIndex: 50 }}>
        <style>{`
          .snav-desktop { display: flex !important; }
          .snav-phone { display: flex !important; }
          .snav-hamburger { display: none !important; }
          .snav-mobile { display: none; }
          @media (max-width: 900px) {
            .snav-desktop { display: none !important; }
            .snav-phone { display: none !important; }
            .snav-hamburger { display: block !important; }
            .snav-mobile.open { display: block !important; }
          }
        `}</style>

        <div style={{ backgroundColor: topBarBg, color: topBarText, borderBottom: "1px solid rgba(26,58,107,0.12)" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "6px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: "14px", lineHeight: "20px", fontWeight: 400 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 24, color: "rgba(26,58,107,0.82)" }}>
              <span>Mon-Sat 7am-8pm | Emergency 24/7</span>
              <span>Reading & Surrounding Areas</span>
            </div>
            <div style={{ color: "#00A8A8", fontWeight: 700 }}>
              {company?.phone ? (
                <a href={`tel:${company.phone.replace(/\s/g, "")}`} style={{ color: "inherit", textDecoration: "none", fontWeight: "inherit" }}>
                  {company.phone}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: "#eef5ff", color: "#0f1f3d", borderBottom: "1px solid rgba(26, 58, 107, 0.16)", boxShadow: "0 1px 0 rgba(26,58,107,0.06)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
            <Link href={homeHref} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#0f1f3d", flexShrink: 0 }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={siteName} style={{ height: 42, objectFit: "contain" }} />
              ) : (
                <div style={{ fontWeight: 800, fontSize: "1.25rem", letterSpacing: "-0.02em", color: "#0f1f3d" }}>🔧 {siteName}</div>
              )}
            </Link>

            <nav className="snav-desktop" aria-label="Main navigation" style={{ flex: 1, justifyContent: "center" }}>
              <ul style={{ display: "flex", gap: 2, listStyle: "none", margin: 0, padding: 0 }}>
                {pages.map((page) => (
                  <li key={page.id}>
                    <Link href={pageHref(page)} style={{ padding: "8px 13px", borderRadius: 4, textDecoration: "none", color: mainNavText, fontWeight: 600, fontSize: "0.9375rem", display: "block" }}>
                      {page.nav_label || page.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="snav-phone" style={{ alignItems: "center", gap: 14, flexShrink: 0 }}>
              <a href={ctaHref} style={{ padding: "8px 16px", backgroundColor: ctaBg, color: "#ffffff", borderRadius: 10, textDecoration: "none", fontWeight: 700, fontSize: "0.875rem", border: `1px solid ${ctaBorder}` }}>
                Call Now
              </a>
            </div>

            <button
              className="snav-hamburger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: "#0f1f3d", fontSize: "1.5rem" }}
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>

          <nav role="navigation" aria-label="Mobile navigation" className={`snav-mobile${menuOpen ? " open" : ""}`} style={{ backgroundColor: "#ffffff", borderTop: "1px solid rgba(26, 58, 107, 0.12)" }}>
            <ul style={{ listStyle: "none", margin: 0, padding: "8px 0 16px" }}>
              {pages.map((page) => (
                <li key={page.id}>
                  <Link href={pageHref(page)} onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "12px 24px", color: "#334155", textDecoration: "none", fontWeight: 600 }}>
                    {page.nav_label || page.title}
                  </Link>
                </li>
              ))}
              <li style={{ padding: "12px 24px" }}>
                <a href={ctaHref} onClick={() => setMenuOpen(false)} style={{ display: "inline-block", padding: "10px 20px", backgroundColor: ctaBg, color: "#fff", borderRadius: 10, textDecoration: "none", fontWeight: 700 }}>
                  Call Now
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header style={{ position: isModernTrade ? "relative" : "sticky", top: 0, zIndex: 50 }}>
      <style>{`
        .snav-desktop { display: flex !important; }
        .snav-phone { display: flex !important; }
        .snav-hamburger { display: none !important; }
        .snav-mobile { display: none; }
        @media (max-width: 900px) {
          .snav-desktop { display: none !important; }
          .snav-phone { display: none !important; }
          .snav-hamburger { display: block !important; }
          .snav-mobile.open { display: block !important; }
        }
      `}</style>

      {/* Top info bar */}
      {hasTopBar && (
        <div style={{ backgroundColor: topBarBg, color: navText, fontSize: "0.8rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "5px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: 0.8 }}>
              {company?.email && (
                <a href={`mailto:${company.email}`} style={{ color: navText, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                  <span>✉</span> {company.email}
                </a>
              )}
                            {company?.phone && (
                              <a href={`tel:${company.phone.replace(/\s/g, "")}`} style={{ color: navText, textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                                <span>📞</span> {company.phone}
                              </a>
                            )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, opacity: 0.8 }}>
              {company?.gas_safe_number && <span>Gas Safe: {company.gas_safe_number}</span>}
              {company?.gas_safe_number && company?.oftec_number && <span>·</span>}
              {company?.oftec_number && <span>OFTEC: {company.oftec_number}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Main nav */}
      <div style={{ backgroundColor: navBg, color: navText, boxShadow: isModernTrade ? "0 1px 0 rgba(15,23,42,0.08)" : "0 2px 10px rgba(0,0,0,0.25)", borderBottom: isModernTrade ? "1px solid #e2e8f0" : "none" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>

          {/* Logo */}
          <Link href={homeHref} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: navText, flexShrink: 0 }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={siteName} style={{ height: 44, objectFit: "contain" }} />
            ) : (
              <div style={{ width: 36, height: 36, backgroundColor: accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.125rem", color: isModernTrade ? "#0f172a" : "#fff" }}>🔧</div>
            )}
            <span style={{ fontWeight: 700, fontSize: "1.0625rem", lineHeight: 1.2, maxWidth: 200 }}>{siteName}</span>
          </Link>

          {/* Desktop nav links */}
          <nav className="snav-desktop" aria-label="Main navigation" style={{ flex: 1, justifyContent: "center" }}>
            <ul style={{ display: "flex", gap: 2, listStyle: "none", margin: 0, padding: 0 }}>
              {pages.map((page) => (
                <li key={page.id}>
                  <Link href={pageHref(page)} style={{ padding: "8px 13px", borderRadius: 4, textDecoration: "none", color: navText, fontWeight: 500, fontSize: "0.9375rem", display: "block", opacity: 0.9 }}>
                    {page.nav_label || page.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Phone + CTA */}
          <div className="snav-phone" style={{ alignItems: "center", gap: 14, flexShrink: 0 }}>
            {company?.phone && (
              <a href={`tel:${company.phone.replace(/\s/g, "")}`} style={{ color: navText, textDecoration: "none", fontWeight: 600, fontSize: "0.875rem", whiteSpace: "nowrap", opacity: 0.9 }}>
                {company.phone}
              </a>
            )}
            <a href={ctaHref} style={{ padding: "9px 20px", backgroundColor: accent, color: isModernTrade ? "#0f172a" : "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 700, fontSize: "0.9375rem", whiteSpace: "nowrap" }}>
              Request a Quote
            </a>
          </div>

          {/* Hamburger */}
          <button
            className="snav-hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 8, color: navText, fontSize: "1.5rem" }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu */}
        <nav role="navigation" aria-label="Mobile navigation" className={`snav-mobile${menuOpen ? " open" : ""}`} style={{ backgroundColor: navBg, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <ul style={{ listStyle: "none", margin: 0, padding: "8px 0 16px" }}>
            {pages.map((page) => (
              <li key={page.id}>
                <Link href={pageHref(page)} onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "12px 24px", color: navText, textDecoration: "none", fontWeight: 500 }}>
                  {page.nav_label || page.title}
                </Link>
              </li>
            ))}
            {company?.phone && (
              <li style={{ padding: "12px 24px" }}>
                <a href={`tel:${company.phone.replace(/\s/g, "")}`} style={{ color: accent, fontWeight: 700, textDecoration: "none", fontSize: "1.125rem" }}>
                  📞 {company.phone}
                </a>
              </li>
            )}
            <li style={{ padding: "12px 24px" }}>
              <a href={ctaHref} onClick={() => setMenuOpen(false)} style={{ display: "inline-block", padding: "10px 20px", backgroundColor: accent, color: "#fff", borderRadius: 6, textDecoration: "none", fontWeight: 600 }}>
                Request a Quote
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
