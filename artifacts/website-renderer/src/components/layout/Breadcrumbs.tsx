import Link from "next/link";
import type { SitePage } from "@/lib/api";
import { getPageBreadcrumbs } from "@/lib/page-hierarchy";

interface Props {
  currentPage: SitePage;
  pages: SitePage[];
  basePath?: string;
  previewToken?: string;
}

function pageHref(page: SitePage, basePath?: string, previewToken?: string): string {
  if (basePath) {
    const slug = page.page_type === "home" ? "/" : (page.slug.startsWith("/") ? page.slug.slice(1) : page.slug);
    const tokenParam = previewToken ? `&token=${previewToken}` : "";
    if (slug === "/") return previewToken ? `${basePath}?token=${previewToken}` : basePath;
    return `${basePath}?page=${encodeURIComponent(slug)}${tokenParam}`;
  }
  if (page.page_type === "home") return "/";
  return page.slug.startsWith("/") ? page.slug : `/${page.slug}`;
}

export default function Breadcrumbs({ currentPage, pages, basePath, previewToken }: Props) {
  const breadcrumbs = getPageBreadcrumbs(currentPage, pages);
  if (breadcrumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" style={{ maxWidth: 1200, margin: "0 auto", padding: "18px 24px 0" }}>
      <ol style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, listStyle: "none", margin: 0, padding: 0, fontSize: "0.9rem", color: "#64748b" }}>
        {breadcrumbs.map((page, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <li key={page.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isLast ? (
                <span style={{ color: "#0f172a", fontWeight: 600 }}>{page.nav_label || page.title}</span>
              ) : (
                <Link href={pageHref(page, basePath, previewToken)} style={{ color: "inherit", textDecoration: "none" }}>
                  {page.nav_label || page.title}
                </Link>
              )}
              {!isLast ? <span aria-hidden="true">/</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}