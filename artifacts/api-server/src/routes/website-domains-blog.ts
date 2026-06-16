/**
 * Website builder API routes — domains, blog, forms, submissions, public renderer
 *
 * Domains:
 *   GET    /api/website/domains              — list domains
 *   POST   /api/website/domains              — add custom domain
 *   DELETE /api/website/domains/:id          — remove domain
 *   POST   /api/website/domains/:id/verify   — trigger verification check
 *
 * Blog:
 *   GET    /api/website/blog                 — list blog posts
 *   POST   /api/website/blog                 — create post
 *   GET    /api/website/blog/:id             — get post
 *   PATCH  /api/website/blog/:id             — update post
 *   DELETE /api/website/blog/:id             — delete post
 *   POST   /api/website/blog/:id/publish     — publish post
 *   GET    /api/website/blog/categories      — list categories
 *
 * Forms:
 *   GET    /api/website/forms                — list forms
 *   POST   /api/website/forms                — create form
 *   PATCH  /api/website/forms/:id            — update form
 *   GET    /api/website/forms/:id/submissions — list submissions
 *   POST   /api/website/forms/:id/submissions — submit form (public, no auth)
 *
 * Public renderer API (no auth — called by website-renderer service):
 *   GET    /api/public/website/by-domain/:domain — full site data for SSR
 */

import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import rateLimit from "express-rate-limit";
import {
  requireAuth,
  requireTenant,
  requireRole,
  requirePlanFeature,
  type AuthenticatedRequest,
} from "../middlewares/auth";
import {
  createCustomHostname,
  deleteCustomHostname,
  syncDomainStatus,
  getDnsInstructions,
} from "../lib/cloudflare-saas";

const router: IRouter = Router();
const db = supabaseAdmin as any;

const formSubmitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,                    // 5 submissions per IP per 10 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many form submissions. Please try again later." },
});

function requireWebsiteBuilder() {
  return requirePlanFeature("website_builder");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getWebsiteForTenant(tenantId: string): Promise<Record<string, unknown> | null> {
  const { data } = await db
    .from("websites")
    .select("id, status, tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle() as { data: Record<string, unknown> | null };
  return data;
}

// ─── Domains ──────────────────────────────────────────────────────────────────

router.get(
  "/website/domains",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { data } = await db
      .from("website_domains")
      .select("*")
      .eq("website_id", website.id)
      .order("created_at", { ascending: true }) as { data: Record<string, unknown>[] | null };

    const domains = (data || []).map((d: Record<string, unknown>) => {
      const instructions = getDnsInstructions(
        String(d.domain),
        d.verification_token ? String(d.verification_token) : undefined,
      );
      return { ...d, dns_instructions: instructions };
    });

    res.json(domains);
  }
);

router.post(
  "/website/domains",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { domain } = req.body as { domain?: string };

    if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

    // Normalise — strip protocol and trailing slash
    const normDomain = domain
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .trim();

    if (!/^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(normDomain)) {
      res.status(400).json({ error: "Invalid domain format" });
      return;
    }

    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    // Check not already claimed by another tenant
    const { data: existing } = await db
      .from("website_domains")
      .select("id, tenant_id")
      .eq("domain", normDomain)
      .maybeSingle() as { data: { id: string; tenant_id: string } | null };

    if (existing && existing.tenant_id !== req.tenantId) {
      res.status(409).json({ error: "This domain is already in use by another account" });
      return;
    }

    if (existing) {
      res.status(409).json({ error: "This domain is already connected to your website", domain_id: existing.id });
      return;
    }

    // Provision on Cloudflare
    const cf = await createCustomHostname(normDomain);

    const { data: domainRecord, error } = await db
      .from("website_domains")
      .insert({
        website_id: website.id,
        tenant_id: req.tenantId,
        domain: normDomain,
        verification_status: cf.ok ? "pending" : "failed",
        ssl_status: "pending",
        cf_hostname_id: cf.hostnameId || null,
        verification_token: cf.ownershipToken || null,
        is_primary: true,
        is_active: false,
      })
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !domainRecord) {
      res.status(500).json({ error: "Failed to add domain" });
      return;
    }

    const instructions = getDnsInstructions(
      normDomain,
      cf.ownershipToken,
    );

    res.status(201).json({
      ...domainRecord,
      cloudflare_configured: cf.ok,
      cloudflare_error: cf.ok ? undefined : cf.error,
      dns_instructions: instructions,
    });
  }
);

router.delete(
  "/website/domains/:id",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;

    const { data: domain } = await db
      .from("website_domains")
      .select("id, cf_hostname_id")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: { id: string; cf_hostname_id: string | null } | null };

    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

    // Remove from Cloudflare
    if (domain.cf_hostname_id) {
      await deleteCustomHostname(domain.cf_hostname_id);
    }

    await db.from("website_domains").delete().eq("id", id);
    res.sendStatus(204);
  }
);

router.post(
  "/website/domains/:id/verify",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;

    const { data: domain } = await db
      .from("website_domains")
      .select("id, cf_hostname_id")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: { id: string; cf_hostname_id: string | null } | null };

    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }
    if (!domain.cf_hostname_id) { res.status(400).json({ error: "Domain not yet provisioned on Cloudflare" }); return; }

    // Sync current status from Cloudflare
    await syncDomainStatus(String(id));

    const { data: updated } = await db
      .from("website_domains")
      .select("id, domain, verification_status, ssl_status, is_active, cf_ownership_verified, cf_ssl_verified")
      .eq("id", id)
      .single() as { data: Record<string, unknown> | null };

    res.json(updated);
  }
);

// ─── Blog ─────────────────────────────────────────────────────────────────────

router.get(
  "/website/blog/categories",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { data } = await db
      .from("website_blog_categories")
      .select("id, name, slug")
      .eq("website_id", website.id) as { data: Record<string, unknown>[] | null };

    res.json(data || []);
  }
);

router.get(
  "/website/blog",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { status } = req.query as { status?: string };

    let q = db
      .from("website_blog_posts")
      .select("id, slug, title, excerpt, status, featured_image_url, published_at, created_at, updated_at, ai_generated, website_blog_categories(name, slug)")
      .eq("website_id", website.id)
      .order("created_at", { ascending: false });

    if (status) q = q.eq("status", status);

    const { data } = await q as { data: Record<string, unknown>[] | null };
    res.json(data || []);
  }
);

router.post(
  "/website/blog",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { slug, title, excerpt, content = [], featured_image_url, category_id, meta_title, meta_description, author_name, ai_generated = false } = req.body as Record<string, unknown>;

    if (!slug || !title) { res.status(400).json({ error: "slug and title are required" }); return; }

    const { data, error } = await db
      .from("website_blog_posts")
      .insert({
        website_id: website.id,
        tenant_id: req.tenantId,
        slug: String(slug).toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        title,
        excerpt: excerpt || null,
        content,
        featured_image_url: featured_image_url || null,
        category_id: category_id || null,
        meta_title: meta_title || null,
        meta_description: meta_description || null,
        author_name: author_name || null,
        ai_generated: Boolean(ai_generated),
        status: "draft",
      })
      .select()
      .single() as { data: Record<string, unknown> | null; error: Record<string, unknown> };

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ error: `A blog post with slug '${slug}' already exists` });
      } else {
        res.status(500).json({ error: "Failed to create blog post" });
      }
      return;
    }

    res.status(201).json(data);
  }
);

router.get(
  "/website/blog/:id",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { data, error } = await db
      .from("website_blog_posts")
      .select("*")
      .eq("id", req.params.id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !data) { res.status(404).json({ error: "Post not found" }); return; }
    res.json(data);
  }
);

router.patch(
  "/website/blog/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const allowed = ["title", "slug", "excerpt", "content", "featured_image_url", "category_id", "meta_title", "meta_description", "author_name"];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    const { data, error } = await db
      .from("website_blog_posts")
      .update(updates)
      .eq("id", req.params.id)
      .eq("tenant_id", req.tenantId)
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !data) { res.status(404).json({ error: "Post not found" }); return; }
    res.json(data);
  }
);

router.post(
  "/website/blog/:id/publish",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { data, error } = await db
      .from("website_blog_posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .eq("tenant_id", req.tenantId)
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !data) { res.status(404).json({ error: "Post not found" }); return; }
    res.json(data);
  }
);

router.delete(
  "/website/blog/:id",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    await db.from("website_blog_posts").delete().eq("id", req.params.id).eq("tenant_id", req.tenantId);
    res.sendStatus(204);
  }
);

// ─── Forms ────────────────────────────────────────────────────────────────────

router.get(
  "/website/forms",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { data } = await db
      .from("website_forms")
      .select("id, name, form_type, notify_email, auto_create_enquiry, is_active, created_at")
      .eq("website_id", website.id) as { data: Record<string, unknown>[] | null };

    res.json(data || []);
  }
);

router.post(
  "/website/forms",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { name, form_type = "contact", fields = [], notify_email, auto_create_enquiry = false } = req.body as Record<string, unknown>;

    if (!name) { res.status(400).json({ error: "name is required" }); return; }

    const { data, error } = await db
      .from("website_forms")
      .insert({
        website_id: website.id,
        tenant_id: req.tenantId,
        name,
        form_type,
        fields,
        notify_email: notify_email || null,
        auto_create_enquiry: Boolean(auto_create_enquiry),
      })
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error) { res.status(500).json({ error: "Failed to create form" }); return; }
    res.status(201).json(data);
  }
);

// ─── Form submissions (public endpoint — no auth required) ────────────────────

router.post(
  "/website/forms/:id/submissions",
  formSubmitLimiter,
  async (req, res): Promise<void> => {
    const { id: formId } = req.params;

    const { data: form } = await db
      .from("website_forms")
      .select("id, website_id, tenant_id, form_type, fields, notify_email, auto_create_enquiry, is_active, websites(status)")
      .eq("id", formId)
      .single() as { data: Record<string, unknown> | null };

    if (!form || !form.is_active) {
      res.status(404).json({ error: "Form not found" });
      return;
    }

    // Don't accept submissions if the website is not published
    const websiteStatus = (form.websites as Record<string, unknown>)?.status;
    if (websiteStatus !== "published") {
      res.status(403).json({ error: "Website is not published" });
      return;
    }

    const { data: submissionData } = req.body as { data?: Record<string, unknown> };
    if (!submissionData || typeof submissionData !== "object") {
      res.status(400).json({ error: "data is required" });
      return;
    }

    const { data: submission, error } = await db
      .from("website_form_submissions")
      .insert({
        form_id: formId,
        website_id: form.website_id,
        tenant_id: form.tenant_id,
        data: submissionData,
        status: "new",
        ip_address: req.ip || null,
        user_agent: req.headers["user-agent"] || null,
      })
      .select("id")
      .single() as { data: { id: string } | null; error: unknown };

    if (error) {
      res.status(500).json({ error: "Failed to submit form" });
      return;
    }

    // If job management module is enabled and auto_create_enquiry is on, create an enquiry
    if (form.auto_create_enquiry) {
      void createEnquiryFromFormSubmission(
        String(form.tenant_id),
        submission!.id,
        form.form_type as string,
        submissionData,
      );
    }

    res.json({ ok: true, submission_id: submission?.id });
  }
);

router.get(
  "/website/forms/:id/submissions",
  requireAuth,
  requireTenant,
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { status } = req.query as { status?: string };

    let q = db
      .from("website_form_submissions")
      .select("id, data, status, enquiry_id, ip_address, created_at")
      .eq("form_id", req.params.id)
      .eq("tenant_id", req.tenantId)
      .order("created_at", { ascending: false });

    if (status) q = q.eq("status", status);

    const { data } = await q as { data: Record<string, unknown>[] | null };
    res.json(data || []);
  }
);

// ─── Public renderer API ──────────────────────────────────────────────────────
// Called by the website-renderer Next.js service to get full site data for SSR.
// No auth — protected by checking the domain is active and using an internal secret.

const RENDERER_SECRET = process.env.RENDERER_SECRET;

router.get(
  "/public/website/by-domain/:domain",
  async (req, res): Promise<void> => {
    // Verify internal renderer secret if configured
    if (RENDERER_SECRET) {
      const secret = req.headers["x-renderer-secret"];
      if (secret !== RENDERER_SECRET) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }

    const { domain } = req.params;

    // Find active domain
    const { data: domainRecord } = await db
      .from("website_domains")
      .select("id, website_id, tenant_id, is_active")
      .eq("domain", domain)
      .maybeSingle() as { data: { id: string; website_id: string; tenant_id: string; is_active: boolean } | null };

    if (!domainRecord?.is_active) {
      res.status(404).json({ error: "No active website for this domain" });
      return;
    }

    // Fetch full site data
    const [websiteRes, pagesRes, blogsRes, testimonialsRes, galleryRes] = await Promise.all([
      db.from("websites").select("*").eq("id", domainRecord.website_id).single(),
      db.from("website_pages").select("id, slug, page_type, title, status, meta_title, meta_description, og_image_url, canonical_url, no_index, schema_markup, show_in_nav, nav_label, nav_order, published_at").eq("website_id", domainRecord.website_id).eq("status", "published").order("nav_order", { ascending: true }),
      db.from("website_blog_posts").select("id, slug, title, excerpt, featured_image_url, published_at, meta_title, meta_description, website_blog_categories(name, slug)").eq("website_id", domainRecord.website_id).eq("status", "published").order("published_at", { ascending: false }).limit(20),
      db.from("website_testimonials").select("id, author_name, location, rating, body, sort_order").eq("website_id", domainRecord.website_id).eq("is_visible", true).order("sort_order", { ascending: true }),
      db.from("website_gallery_items").select("id, image_url, caption, alt_text, category, sort_order").eq("website_id", domainRecord.website_id).eq("is_visible", true).order("sort_order", { ascending: true }).limit(50),
    ]) as Array<{ data: unknown }>;

    // Fetch company settings for contact info
    const { data: companySettings } = await supabaseAdmin
      .from("company_settings")
      .select("name, trading_name, phone, email, website, address_line1, address_line2, city, county, postcode, gas_safe_number, oftec_number, logo_url")
      .eq("tenant_id", domainRecord.tenant_id)
      .eq("singleton_id", "default")
      .maybeSingle();

    res.json({
      website: websiteRes.data,
      pages: pagesRes.data || [],
      blog_posts: blogsRes.data || [],
      testimonials: testimonialsRes.data || [],
      gallery: galleryRes.data || [],
      company: companySettings,
    });
  }
);

// ─── Get page blocks for renderer ─────────────────────────────────────────────

router.get(
  "/public/website/pages/:websiteId/:slug",
  async (req, res): Promise<void> => {
    if (RENDERER_SECRET && req.headers["x-renderer-secret"] !== RENDERER_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { websiteId, slug } = req.params;

    const { data: page } = await db
      .from("website_pages")
      .select("*")
      .eq("website_id", websiteId)
      .eq("slug", slug)
      .eq("status", "published")
      .single() as { data: Record<string, unknown> | null };

    if (!page) { res.status(404).json({ error: "Page not found" }); return; }

    const { data: blocks } = await db
      .from("website_blocks")
      .select("id, block_type, content, sort_order")
      .eq("page_id", page.id)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null };

    res.json({ ...page, blocks: blocks || [] });
  }
);

// ─── Helper: create enquiry from form submission ──────────────────────────────

async function createEnquiryFromFormSubmission(
  tenantId: string,
  submissionId: string,
  formType: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    // Check if job_management feature is enabled for this tenant
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("plan_id, plans(features)")
      .eq("id", tenantId)
      .single();

    const features = (tenant as any)?.plans?.features || {};
    if (!features.job_management) return;

    // Build enquiry from form data
    const name = String(data.name || data.full_name || "Website enquiry");
    const email = String(data.email || "");
    const phone = String(data.phone || data.mobile || "");
    const message = String(data.message || data.description || data.notes || "");

    const { data: enquiry, error } = await (supabaseAdmin as any)
      .from("enquiries")
      .insert({
        tenant_id: tenantId,
        name,
        email: email || null,
        phone: phone || null,
        message,
        source: "website_form",
        status: "new",
        form_type: formType,
        notes: `Submitted via website contact form (submission: ${submissionId})`,
      })
      .select("id")
      .single();

    if (error || !enquiry) return;

    // Link submission to enquiry
    await (supabaseAdmin as any)
      .from("website_form_submissions")
      .update({ enquiry_id: (enquiry as Record<string, unknown>).id, status: "converted" })
      .eq("id", submissionId);

  } catch (err) {
    console.error("[website-form] Failed to create enquiry:", (err as Error).message);
  }
}

export default router;
