
"use client";

import { useState } from "react";
import type { SitePage } from "@/lib/api";
import Link from "next/link";

interface Props {
  siteName: string;
  logoUrl: string | null;
  pages: SitePage[];
  theme: Record<string, string>;
  basePath?: string; // e.g. "/preview/{websiteId}" — rewrites nav links for in-app preview
  previewToken?: string; // HMAC token — kept in all preview nav links
}

export default function SiteHeader({ siteName, logoUrl, pages, theme, basePath, previewToken }: Props) {
  const navBg = theme?.nav_background || "#1f2937";
  const navText = theme?.nav_text || "#ffffff";
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

  const homeHref = basePath
    ? (previewToken ? `${basePath}?token=${previewToken}` : basePath)
    : "/";

  const linkStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 4,
    textDecoration: "none",
    color: navText,
    fontWeight: 500,
    fontSize: "0.9375rem",
    display: "block",
  };

  return (
    <header style={{ backgroundColor: navBg, color: navText, position: "sticky", top: 0, zIndex: 50, boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        {/* Logo / Site name */}
        <Link href={homeHref} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: navText }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={siteName} style={{ height: 40, objectFit: "contain" }} />
          )}
          <span style={{ fontWeight: 700, fontSize: "1.25rem" }}>{siteName}</span>
        </Link>

        {/* Desktop nav */}
        <nav style={{ display: "flex" }} className="site-nav-desktop">
          <ul style={{ display: "flex", gap: 8, listStyle: "none", margin: 0, padding: 0 }}>
            {pages.map((page) => (
              <li key={page.id}>
                <Link href={pageHref(page)} style={linkStyle}>
                  {page.nav_label || page.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile hamburger button */}
        <button
          className="site-nav-hamburger"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            color: navText,
            display: "none",
          }}
        >
          {menuOpen ? (
            // X icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            // Hamburger icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          className="site-nav-mobile"
          style={{ backgroundColor: navBg, borderTop: "1px solid rgba(255,255,255,0.1)", padding: "8px 0 16px" }}
        >
          {pages.map((page) => (
            <Link
              key={page.id}
              href={pageHref(page)}
              onClick={() => setMenuOpen(false)}
              style={{ ...linkStyle, padding: "12px 24px", borderRadius: 0 }}
            >
              {page.nav_label || page.title}
            </Link>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .site-nav-desktop { display: none !important; }
          .site-nav-hamburger { display: block !important; }
        }
      `}</style>
    </header>
  );
}
