import type { SitePage } from "@/lib/api";

export type HierarchyPage = SitePage & {
  normalizedSlug: string;
  depth: number;
  parentSlug: string | null;
  children: HierarchyPage[];
};

export function normalizePageSlug(value: string | null | undefined): string {
  if (!value || value === "/") return "/";
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  return withSlash.replace(/\/+/g, "/").replace(/\/+$/, "") || "/";
}

export function buildPageHierarchy(pages: SitePage[]): HierarchyPage[] {
  const map = new Map<string, HierarchyPage>();

  for (const page of pages) {
    const normalizedSlug = page.page_type === "home" ? "/" : normalizePageSlug(page.slug);
    const segments = normalizedSlug === "/" ? [] : normalizedSlug.replace(/^\//, "").split("/").filter(Boolean);
    const parentSlug = segments.length > 1 ? `/${segments.slice(0, -1).join("/")}` : null;
    map.set(normalizedSlug, {
      ...page,
      normalizedSlug,
      depth: segments.length,
      parentSlug,
      children: [],
    });
  }

  const roots: HierarchyPage[] = [];
  for (const page of map.values()) {
    if (page.parentSlug && map.has(page.parentSlug)) {
      map.get(page.parentSlug)!.children.push(page);
    } else {
      roots.push(page);
    }
  }

  const sortRecursively = (items: HierarchyPage[]) => {
    items.sort((a, b) => {
      if (a.nav_order !== b.nav_order) return a.nav_order - b.nav_order;
      return a.title.localeCompare(b.title);
    });
    for (const item of items) sortRecursively(item.children);
  };

  sortRecursively(roots);
  return roots;
}

export function flattenPageHierarchy(items: HierarchyPage[]): HierarchyPage[] {
  const out: HierarchyPage[] = [];
  const visit = (pages: HierarchyPage[]) => {
    for (const page of pages) {
      out.push(page);
      visit(page.children);
    }
  };
  visit(items);
  return out;
}

export function getPageBreadcrumbs(currentPage: SitePage, pages: SitePage[]): HierarchyPage[] {
  const hierarchy = buildPageHierarchy(pages);
  const flat = flattenPageHierarchy(hierarchy);
  const bySlug = new Map(flat.map((page) => [page.normalizedSlug, page]));
  const targetSlug = currentPage.page_type === "home" ? "/" : normalizePageSlug(currentPage.slug);
  const current = bySlug.get(targetSlug);
  if (!current) return [];

  const crumbs: HierarchyPage[] = [];
  let cursor: HierarchyPage | undefined = current;
  while (cursor) {
    crumbs.unshift(cursor);
    cursor = cursor.parentSlug ? bySlug.get(cursor.parentSlug) : undefined;
  }
  return crumbs;
}