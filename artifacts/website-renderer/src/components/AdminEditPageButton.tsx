"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { SitePage } from "@/lib/api";

const ADMIN_SESSION_COOKIE = "twd_admin_session=1";

function normalizeSlug(value: string): string {
  if (!value || value === "/") return "/";
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

function resolvePageForPath(pathname: string, pages: SitePage[]): SitePage | null {
  const normalizedPath = normalizeSlug(pathname);
  if (normalizedPath === "/") {
    return pages.find((page) => page.page_type === "home" || normalizeSlug(page.slug) === "/") || null;
  }

  return pages.find((page) => normalizeSlug(page.slug) === normalizedPath) || null;
}

export default function AdminEditPageButton({ pages, appBaseUrl }: { pages: SitePage[]; appBaseUrl: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editModeEnabled, setEditModeEnabled] = useState(false);

  useEffect(() => {
    const mode = searchParams.get("twd_edit");
    const hasAdminSession = document.cookie.includes(ADMIN_SESSION_COOKIE);
    setEditModeEnabled(mode === "1" && hasAdminSession);
  }, [searchParams]);

  const page = useMemo(() => resolvePageForPath(pathname || "/", pages), [pathname, pages]);

  if (!editModeEnabled) return null;

  const isBlogPath = (pathname || "").startsWith("/blog");
  const editHref = isBlogPath
    ? `${appBaseUrl}/website/blog`
    : page
      ? `${appBaseUrl}/website/pages/${page.id}`
      : `${appBaseUrl}/website/pages`;

  return (
    <a
      href={editHref}
      style={{
        position: "fixed",
        right: "16px",
        bottom: "16px",
        zIndex: 2147483647,
        background: "#1d4ed8",
        color: "#ffffff",
        borderRadius: "999px",
        padding: "10px 14px",
        fontFamily: "system-ui, sans-serif",
        fontSize: "0.88rem",
        fontWeight: 700,
        textDecoration: "none",
        boxShadow: "0 10px 20px rgba(0,0,0,0.25)",
      }}
      aria-label="Edit page"
      title="Edit this page in TradeWorkDesk"
    >
      Edit Page
    </a>
  );
}
