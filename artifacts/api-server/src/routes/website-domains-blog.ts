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
import { resolveCname, resolve4 } from "node:dns/promises";
import { getDnsInstructions } from "../lib/cloudflare-saas";
import { addDomainToVercel, removeDomainFromVercel } from "../lib/vercel";
import { sendSimpleNotification } from "../lib/email";

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
      // Platform subdomains don't need DNS instructions — they're always active
      if (d.is_platform_subdomain) return { ...d, dns_instructions: null };
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

    const { data: domainRecord, error } = await db
      .from("website_domains")
      .insert({
        website_id: website.id,
        tenant_id: req.tenantId,
        domain: normDomain,
        verification_status: "pending",
        ssl_status: "pending",
        is_primary: true,
        is_active: false,
      })
      .select()
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !domainRecord) {
      res.status(500).json({ error: "Failed to add domain" });
      return;
    }

    const instructions = getDnsInstructions(normDomain);

    res.status(201).json({ ...domainRecord, dns_instructions: instructions });
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
      .select("id, domain")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: { id: string; domain: string } | null };

    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

    // Remove from Vercel (releases the SSL cert)
    removeDomainFromVercel(domain.domain).catch((e) =>
      console.error("[vercel] removeDomainFromVercel failed:", e)
    );

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
      .select("id, domain")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: { id: string; domain: string } | null };

    if (!domain) { res.status(404).json({ error: "Domain not found" }); return; }

    // DNS-based verification: accept either
    //   • CNAME → sites.tradeworkdesk.co.uk  (works for www subdomains)
    //   • A     → 76.76.21.21                 (needed for apex domains — most registrars
    //                                          won't allow CNAME at @)
    const PLATFORM_TARGET = (process.env.PLATFORM_CNAME_TARGET || "sites.tradeworkdesk.co.uk").toLowerCase();
    const VERCEL_APEX_IP = process.env.VERCEL_APEX_IP || "76.76.21.21";
    let dnsOk = false;
    try {
      const cnameAddresses = await resolveCname(domain.domain).catch(() => [] as string[]);
      dnsOk = cnameAddresses.some((a) => a.toLowerCase() === PLATFORM_TARGET || a.toLowerCase().endsWith(`.${PLATFORM_TARGET}`));
    } catch { /* ignore */ }

    if (!dnsOk) {
      try {
        const aRecords = await resolve4(domain.domain).catch(() => [] as string[]);
        dnsOk = aRecords.includes(VERCEL_APEX_IP);
      } catch { /* ignore */ }
    }

    const updates: Record<string, unknown> = {
      dns_checked_at: new Date().toISOString(),
    };

    if (dnsOk) {
      updates.verification_status = "verified";
      updates.ssl_status = "active";  // SSL handled by Railway/platform
      updates.is_active = true;
      updates.activated_at = new Date().toISOString();
      // Provision SSL cert on Vercel renderer
      addDomainToVercel(domain.domain).catch((e) =>
        console.error("[vercel] addDomainToVercel failed:", e)
      );
    } else {
      updates.verification_status = "pending";
    }

    await db.from("website_domains").update(updates).eq("id", id);

    const { data: updated } = await db
      .from("website_domains")
      .select("id, domain, verification_status, ssl_status, is_active")
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

router.patch(
  "/website/forms/:id",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;
    const { auto_create_enquiry, notify_email, name, is_active } = req.body as Record<string, unknown>;

    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const updates: Record<string, unknown> = {};
    if (typeof auto_create_enquiry === "boolean") updates.auto_create_enquiry = auto_create_enquiry;
    if (notify_email !== undefined) updates.notify_email = notify_email || null;
    if (name !== undefined) updates.name = name;
    if (typeof is_active === "boolean") updates.is_active = is_active;

    const { data, error } = await db
      .from("website_forms")
      .update(updates)
      .eq("id", id)
      .eq("website_id", website.id)
      .select("id, name, form_type, notify_email, auto_create_enquiry, is_active, created_at")
      .single() as { data: Record<string, unknown> | null; error: unknown };

    if (error || !data) { res.status(404).json({ error: "Form not found" }); return; }
    res.json(data);
  }
);

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

    // Send notification email to the configured address (or fall back to company email)
    void sendFormSubmissionNotification(
      String(form.tenant_id),
      String(form.notify_email || ""),
      String(form.form_type || "contact"),
      submissionData,
      submission!.id,
    );

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
      db.from("websites").select("*, website_templates(slug)").eq("id", domainRecord.website_id).single(),
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

    // Flatten template slug onto website object
    const websiteData = websiteRes.data as Record<string, unknown> | null;
    const templateSlug = (websiteData?.website_templates as { slug?: string } | null)?.slug ?? null;
    const websiteOut = websiteData ? { ...websiteData, template_slug: templateSlug, website_templates: undefined } : null;

    res.json({
      website: websiteOut,
      pages: pagesRes.data || [],
      blog_posts: blogsRes.data || [],
      testimonials: testimonialsRes.data || [],
      gallery: galleryRes.data || [],
      company: companySettings,
    });
  }
);

// ─── Preview by websiteId (no domain required) ───────────────────────────────
// Used by the renderer's /preview/[websiteId] route so tenants can preview
// their site before connecting a custom domain. Returns all pages (incl. draft).

router.get(
  "/public/website/preview-data/:websiteId",
  async (req, res): Promise<void> => {
    if (RENDERER_SECRET && req.headers["x-renderer-secret"] !== RENDERER_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { websiteId } = req.params;

    const { data: website } = await db
      .from("websites")
      .select("*, website_templates(slug)")
      .eq("id", websiteId)
      .single() as { data: Record<string, unknown> | null };

    if (!website) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    const [pagesRes, testimonialsRes, galleryRes] = await Promise.all([
      // Include draft pages — this is a preview
      db.from("website_pages")
        .select("id, slug, page_type, title, status, meta_title, meta_description, og_image_url, canonical_url, no_index, schema_markup, show_in_nav, nav_label, nav_order, published_at")
        .eq("website_id", websiteId)
        .order("nav_order", { ascending: true }),
      db.from("website_testimonials")
        .select("id, author_name, location, rating, body, sort_order")
        .eq("website_id", websiteId)
        .eq("is_visible", true)
        .order("sort_order", { ascending: true }),
      db.from("website_gallery_items")
        .select("id, image_url, caption, alt_text, category, sort_order")
        .eq("website_id", websiteId)
        .eq("is_visible", true)
        .order("sort_order", { ascending: true })
        .limit(50),
    ]) as Array<{ data: unknown }>;

    const { data: companySettings } = await supabaseAdmin
      .from("company_settings")
      .select("name, trading_name, phone, email, website, address_line1, address_line2, city, county, postcode, gas_safe_number, oftec_number, logo_url")
      .eq("tenant_id", String(website.tenant_id))
      .eq("singleton_id", "default")
      .maybeSingle();

    const templateSlug2 = (website?.website_templates as { slug?: string } | null)?.slug ?? null;
    const websiteOut2 = { ...website, template_slug: templateSlug2, website_templates: undefined };

    res.json({
      website: websiteOut2,
      pages: (pagesRes.data as unknown[]) || [],
      blog_posts: [],
      testimonials: (testimonialsRes.data as unknown[]) || [],
      gallery: (galleryRes.data as unknown[]) || [],
      company: companySettings,
    });
  }
);

// ─── Canonical domain redirect check ─────────────────────────────────────────
// Called by the renderer middleware to detect whether a platform subdomain
// should 301-redirect to the tenant's active custom domain.

router.get(
  "/public/website/canonical-domain/:domain",
  async (req, res): Promise<void> => {
    if (RENDERER_SECRET && req.headers["x-renderer-secret"] !== RENDERER_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { domain } = req.params;

    // Find the website this domain belongs to
    const { data: thisDomain } = await db
      .from("website_domains")
      .select("website_id, is_platform_subdomain")
      .eq("domain", domain)
      .maybeSingle() as { data: { website_id: string; is_platform_subdomain: boolean } | null };

    if (!thisDomain?.is_platform_subdomain) {
      // Not a platform subdomain — no redirect needed
      res.json({ canonical: null });
      return;
    }

    // Look for an active custom (non-platform) domain on the same website
    const { data: customDomain } = await db
      .from("website_domains")
      .select("domain")
      .eq("website_id", thisDomain.website_id)
      .eq("is_platform_subdomain", false)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle() as { data: { domain: string } | null };

    res.json({ canonical: customDomain?.domain ?? null });
  }
);

// ─── Get page blocks for renderer ─────────────────────────────────────────────

router.get(
  "/public/website/preview-blocks/:pageId",
  async (req, res): Promise<void> => {
    if (RENDERER_SECRET && req.headers["x-renderer-secret"] !== RENDERER_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { pageId } = req.params;

    const { data: blocks } = await db
      .from("website_blocks")
      .select("id, block_type, content, sort_order")
      .eq("page_id", pageId)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null };

    res.json(blocks || []);
  }
);

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

// ─── Helper: notify tenant of new form submission ────────────────────────────

async function sendFormSubmissionNotification(
  tenantId: string,
  formNotifyEmail: string,
  formType: string,
  data: Record<string, unknown>,
  submissionId: string,
): Promise<void> {
  try {
    // Resolve notification email: form-level override → company_settings.email
    let toEmail = formNotifyEmail.trim();
    if (!toEmail) {
      const { data: cs } = await (supabaseAdmin as any)
        .from("company_settings")
        .select("email, name, trading_name")
        .eq("tenant_id", tenantId)
        .eq("singleton_id", "default")
        .maybeSingle() as { data: { email: string | null; name: string | null; trading_name: string | null } | null };
      toEmail = cs?.email?.trim() || "";
    }
    if (!toEmail) return; // nowhere to send — skip silently

    const subject = `New ${formType} form submission on your website`;

    const lines: string[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (!val) continue;
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`${label}: ${String(val)}`);
    }

    const body = [
      `You have received a new ${formType} enquiry from your website.`,
      "",
      lines.join("\n"),
      "",
      `Submission ID: ${submissionId}`,
      "",
      "Log in to TradeWorkDesk to view and manage this enquiry:",
      "https://app.tradeworkdesk.co.uk/enquiries",
    ].join("\n");

    await sendSimpleNotification(toEmail, subject, body);
  } catch (err) {
    console.error("[website-form] Failed to send notification email:", (err as Error).message);
  }
}

// ─── Helper: create enquiry from form submission ──────────────────────────────

async function createEnquiryFromFormSubmission(
  tenantId: string,
  submissionId: string,
  formType: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    // Map common form field names to enquiry fields
    const contactName = String(
      data.name || data.full_name || data.contact_name || "Website enquiry"
    ).trim();
    const email = String(data.email || data.contact_email || "").trim() || null;
    const phone = String(data.phone || data.mobile || data.contact_phone || "").trim() || null;

    // Build a rich description from all submitted fields
    const skip = new Set(["name", "full_name", "contact_name", "email", "contact_email", "phone", "mobile", "contact_phone"]);
    const extraLines: string[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (skip.has(key) || !val) continue;
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      extraLines.push(`${label}: ${String(val)}`);
    }
    const description = extraLines.length > 0
      ? `Website enquiry (${formType})\n\n${extraLines.join("\n")}`
      : `Website enquiry (${formType})`;

    const postcode = String(data.postcode || data.address || "").trim() || null;

    const { data: enquiry, error } = await (supabaseAdmin as any)
      .from("enquiries")
      .insert({
        tenant_id: tenantId,
        contact_name: contactName,
        contact_email: email,
        contact_phone: phone,
        source: "website",
        description,
        address: postcode,
        status: "new",
        notes: `Submitted via website contact form (submission ID: ${submissionId})`,
      })
      .select("id")
      .single();

    if (error || !enquiry) {
      console.error("[website-form] Failed to create enquiry:", error?.message);
      return;
    }

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
