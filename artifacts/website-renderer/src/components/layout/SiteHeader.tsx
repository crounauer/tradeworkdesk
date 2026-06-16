import type { SitePage } from "@/lib/api";
import Link from "next/link";

interface Props {
  siteName: string;
  logoUrl: string | null;
  pages: SitePage[];
  theme: Record<string, string>;
}

export default function SiteHeader({ siteName, logoUrl, pages, theme }: Props) {
  const navBg = theme?.nav_background || "#1f2937";
  const navText = theme?.nav_text || "#ffffff";

  return (
    <header
      style={{
        backgroundColor: navBg,
        color: navText,
        position: "sticky",
        top: 0,
        zIndex: 50,
        boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        {/* Logo / Site name */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: navText }}>
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={siteName} style={{ height: 40, objectFit: "contain" }} />
          )}
          <span style={{ fontWeight: 700, fontSize: "1.25rem" }}>{siteName}</span>
        </Link>

        {/* Navigation */}
        <nav>
          <ul
            style={{
              display: "flex",
              gap: 8,
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {pages.map((page) => (
              <li key={page.id}>
                <Link
                  href={page.slug.startsWith("/") ? page.slug : `/${page.slug}`}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 4,
                    textDecoration: "none",
                    color: navText,
                    fontWeight: 500,
                    fontSize: "0.9375rem",
                  }}
                >
                  {page.nav_label || page.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
