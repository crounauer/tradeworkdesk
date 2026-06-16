/**
 * API client for fetching site data from the platform API server.
 * Used in server components for ISR (Incremental Static Regeneration).
 */

const API_BASE = process.env.API_BASE_URL || "https://api.tradeworkdesk.co.uk";
const RENDERER_SECRET = process.env.RENDERER_SECRET || "";

// Revalidation TTL: 60 seconds for published sites, 0 for drafts
const REVALIDATE_SECONDS = 60;

export interface SiteBlock {
  id: string;
  block_type: string;
  content: Record<string, unknown>;
  sort_order: number;
}

export interface SitePage {
  id: string;
  slug: string;
  page_type: string;
  title: string;
  status: "published" | "draft";
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  no_index: boolean;
  schema_markup: Record<string, unknown> | null;
  show_in_nav: boolean;
  nav_label: string | null;
  nav_order: number;
  published_at: string | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  website_blog_categories: { name: string; slug: string } | null;
}

export interface Testimonial {
  id: string;
  author_name: string;
  location: string | null;
  rating: number | null;
  body: string;
  sort_order: number;
}

export interface GalleryItem {
  id: string;
  image_url: string;
  caption: string | null;
  alt_text: string | null;
  category: string | null;
  sort_order: number;
}

export interface Website {
  id: string;
  tenant_id: string;
  site_name: string;
  tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  theme: Record<string, unknown>;
  default_meta_title: string | null;
  default_meta_description: string | null;
  google_analytics_id: string | null;
  social_links: Record<string, string> | null;
  status: "draft" | "published";
}

export interface CompanySettings {
  name: string;
  trading_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  gas_safe_number: string | null;
  oftec_number: string | null;
  logo_url: string | null;
}

export interface SiteData {
  website: Website;
  pages: SitePage[];
  blog_posts: BlogPost[];
  testimonials: Testimonial[];
  gallery: GalleryItem[];
  company: CompanySettings | null;
}

function apiHeaders(): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (RENDERER_SECRET) {
    headers["x-renderer-secret"] = RENDERER_SECRET;
  }
  return headers;
}

/**
 * Fetch all site data for a domain.
 * Returns null if the domain is not found or not active.
 */
export async function getSiteByDomain(domain: string): Promise<SiteData | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/website/by-domain/${encodeURIComponent(domain)}`,
      {
        headers: apiHeaders(),
        next: { revalidate: REVALIDATE_SECONDS },
      },
    );

    if (res.status === 404) return null;
    if (!res.ok) {
      console.error(`[renderer] getSiteByDomain(${domain}) → ${res.status}`);
      return null;
    }

    return res.json() as Promise<SiteData>;
  } catch (err) {
    console.error(`[renderer] getSiteByDomain error:`, err);
    return null;
  }
}

/**
 * Fetch a single page's blocks.
 * Returns null if the page is not found or not published.
 */
export async function getPageBySlug(
  websiteId: string,
  slug: string,
): Promise<(SitePage & { blocks: SiteBlock[] }) | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/public/website/pages/${encodeURIComponent(websiteId)}/${encodeURIComponent(slug)}`,
      {
        headers: apiHeaders(),
        next: { revalidate: REVALIDATE_SECONDS },
      },
    );

    if (res.status === 404) return null;
    if (!res.ok) return null;

    return res.json() as Promise<SitePage & { blocks: SiteBlock[] }>;
  } catch {
    return null;
  }
}

/**
 * Submit a form on the public website.
 * Called client-side from contact forms.
 */
export async function submitForm(
  formId: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/website/forms/${formId}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    const json = await res.json() as { ok?: boolean; error?: string };

    if (!res.ok) return { ok: false, error: json.error || "Submission failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}
