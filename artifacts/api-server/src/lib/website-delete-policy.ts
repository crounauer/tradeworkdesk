export const WEBSITE_DELETE_TABLE_ORDER = [
  "website_blocks",
  "website_page_versions",
  "website_pages",
  "website_domains",
  "websites",
] as const;

export type WebsiteDeleteTable = (typeof WEBSITE_DELETE_TABLE_ORDER)[number];

export function retainsMediaLibraryOnWebsiteDelete(): boolean {
  return true;
}
