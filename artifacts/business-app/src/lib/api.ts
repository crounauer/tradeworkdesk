const API_BASE = `${import.meta.env.BASE_URL}api`;

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
  content: unknown;
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
  template_id: string | null;
  template_slug: string | null;
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
  service_area: string | null;
  coverage_radius_miles: number | null;
  gas_safe_number: string | null;
  oftec_number: string | null;
  logo_url: string | null;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: string;
  starts_at: string;
  ends_at: string | null;
}

export interface SiteData {
  website: Website;
  pages: SitePage[];
  blog_posts: BlogPost[];
  testimonials: Testimonial[];
  gallery: GalleryItem[];
  company: CompanySettings | null;
  platform_announcements?: PlatformAnnouncement[];
}

export async function submitForm(
  formId: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/website/forms/${formId}/submissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ data }),
    });

    const json = await res.json() as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: json.error || "Submission failed" };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}

export async function uploadFormPhotos(
  formId: string,
  files: File[],
): Promise<string[]> {
  try {
    const body = new FormData();
    for (const file of files) body.append("photos", file);

    const res = await fetch(`${API_BASE}/public/website/forms/${formId}/upload-photos`, {
      method: "POST",
      credentials: "include",
      body,
    });

    if (!res.ok) return [];
    const json = await res.json() as { urls?: string[] };
    return json.urls ?? [];
  } catch {
    return [];
  }
}
