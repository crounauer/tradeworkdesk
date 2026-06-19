/**
 * Website builder API routes — domains, blog, forms, submissions, public renderer
 *
 * Domains:
 *   GET    /api/website/domains              — list domains
 *   POST   /api/website/domains              — add custom domain
 *   POST   /api/website/domains/onboard      — one-click onboarding (add + verify + activate)
 *   DELETE /api/website/domains/:id          — remove domain
 *   POST   /api/website/domains/:id/offboard — one-click safe offboarding (fallback + deactivate)
 *   POST   /api/website/domains/:id/verify   — trigger verification check
 *   POST   /api/website/domains/jobs/reconcile — process pending domain onboarding tasks
 *
 * Blog:
 *   GET    /api/website/blog                 — list blog posts
 *   POST   /api/website/blog                 — create post
 *   GET    /api/website/blog/:id             — get post
 *   PATCH  /api/website/blog/:id             — update post
 *   DELETE /api/website/blog/:id             — delete post
 *   POST   /api/website/blog/:id/publish     — publish post
 *   POST   /api/website/blog/:id/generate-featured-image — generate featured image with AI
 *   POST   /api/website/blog/:id/generate-inline-images  — generate in-post images from [IMAGE: ...] placeholders
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
import { geocodeAddress } from "../lib/geocode";
import rateLimit from "express-rate-limit";
import multer from "multer";
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
import { hasActiveAddon, getAddonCredits, deductAddonCreditsAmount } from "../lib/tenant-limits";
import { runBlogAi, generateBlogFeaturedImage, generateBlogInlineImage, BLOG_IMAGE_CREDITS_ESTIMATE, type BlogAiOperation } from "../lib/blog-ai";

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

// Multer: store uploaded photos in memory, 5 MB per file, max 5 files
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

const photoUploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many uploads. Please try again later." },
});

// ─── Public: upload form photos ───────────────────────────────────────────────
// Called client-side from ContactFormBlock before submitting.
// Returns an array of public URLs stored in Supabase storage.
router.post(
  "/public/website/forms/:formId/upload-photos",
  photoUploadLimiter,
  photoUpload.array("photos", 5),
  async (req, res): Promise<void> => {
    try {
      const { formId } = req.params;

      // Verify the form exists and is active
      const { data: form } = await db
        .from("website_forms")
        .select("id, is_active, tenant_id, websites(status)")
        .eq("id", formId)
        .single() as { data: Record<string, unknown> | null };

      if (!form?.is_active) {
        res.status(404).json({ error: "Form not found" });
        return;
      }

      const files = (req.files as Express.Multer.File[]) ?? [];
      if (files.length === 0) {
        res.json({ urls: [] });
        return;
      }

      const urls: string[] = [];
      const uploadErrors: string[] = [];
      let ensuredPublicUploadsBucket = false;

      for (const file of files) {
        const ext = file.originalname.split(".").pop()?.toLowerCase() || "jpg";
        const path = `form-submissions/${form.tenant_id}/${formId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const uploadToPublicUploads = async () =>
          supabaseAdmin.storage
            .from("public-uploads")
            .upload(path, file.buffer, { contentType: file.mimetype, upsert: false });

        let { error } = await uploadToPublicUploads();

        if (
          error &&
          /bucket/i.test(error.message || "") &&
          /(not found|does not exist)/i.test(error.message || "")
        ) {
          if (!ensuredPublicUploadsBucket) {
            const { error: createBucketError } = await supabaseAdmin.storage.createBucket("public-uploads", {
              public: true,
              fileSizeLimit: "5242880",
            });
            if (createBucketError && !/already exists/i.test(createBucketError.message || "")) {
              console.error("[form-upload] create bucket error:", createBucketError.message);
            }
            ensuredPublicUploadsBucket = true;
          }

          const retry = await uploadToPublicUploads();
          error = retry.error;
        }

        if (error) {
          console.error("[form-upload] storage error:", error.message);
          uploadErrors.push(`${file.originalname}: ${error.message}`);
          continue;
        }

        const { data: urlData } = supabaseAdmin.storage
          .from("public-uploads")
          .getPublicUrl(path);

        if (urlData?.publicUrl) urls.push(urlData.publicUrl);
      }

      if (files.length > 0 && urls.length === 0) {
        res.status(500).json({
          error: "Failed to upload photos",
          details: uploadErrors.length > 0 ? uploadErrors : undefined,
        });
        return;
      }

      res.json({ urls });
    } catch (error) {
      console.error("[form-upload] unexpected error:", error);
      res.status(500).json({ error: "Failed to upload photos" });
    }
  }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getWebsiteForTenant(tenantId: string): Promise<Record<string, unknown> | null> {
  const { data } = await db
    .from("websites")
    .select("id, status, tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle() as { data: Record<string, unknown> | null };
  return data;
}

async function getContactFormServiceOptions(websiteId: string): Promise<string[]> {
  const { data: form } = await db
    .from("website_forms")
    .select("fields")
    .eq("website_id", websiteId)
    .eq("form_type", "contact")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle() as { data: { fields: unknown } | null };

  const fields = Array.isArray(form?.fields) ? (form!.fields as Array<Record<string, unknown>>) : [];
  const serviceField = fields.find((field) => field?.name === "service" && field?.type === "select");
  const options = Array.isArray(serviceField?.options) ? (serviceField!.options as unknown[]) : [];

  return options
    .map((option) => String(option || "").trim())
    .filter(Boolean);
}

function applyServiceOptionsToBlocks(blocks: Record<string, unknown>[], serviceOptions: string[]): Record<string, unknown>[] {
  if (!serviceOptions.length) return blocks;

  return blocks.map((block) => {
    if (block.block_type !== "contact_form") return block;

    const content = (block.content || {}) as Record<string, unknown>;
    const fields = Array.isArray(content.fields) ? (content.fields as Record<string, unknown>[]) : null;
    if (!fields) return block;

    const nextFields = fields.map((field) => {
      if (field.name !== "service" || field.type !== "select") return field;
      return { ...field, options: serviceOptions };
    });

    const hasServiceField = nextFields.some((field) => field.name === "service" && field.type === "select");
    if (!hasServiceField) {
      nextFields.push({
        name: "service",
        label: "Service required",
        type: "select",
        required: true,
        options: serviceOptions,
      });
    }

    return { ...block, content: { ...content, fields: nextFields } };
  });
}

function normalizeDomainInput(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();
}

function isValidDomainFormat(domain: string): boolean {
  return /^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+$/.test(domain);
}

async function checkDomainPointsToPlatform(domain: string): Promise<boolean> {
  const PLATFORM_TARGET = (process.env.PLATFORM_CNAME_TARGET || "sites.tradeworkdesk.co.uk").toLowerCase();
  const VERCEL_APEX_IP = process.env.VERCEL_APEX_IP || "76.76.21.21";

  let dnsOk = false;
  try {
    const cnameAddresses = await resolveCname(domain).catch(() => [] as string[]);
    dnsOk = cnameAddresses.some((a) => a.toLowerCase() === PLATFORM_TARGET || a.toLowerCase().endsWith(`.${PLATFORM_TARGET}`));
  } catch {
    // ignore CNAME lookup failures
  }

  if (!dnsOk) {
    try {
      const aRecords = await resolve4(domain).catch(() => [] as string[]);
      dnsOk = aRecords.includes(VERCEL_APEX_IP);
    } catch {
      // ignore A record lookup failures
    }
  }

  return dnsOk;
}

async function ensurePlatformFallbackDomain(websiteId: string, tenantId: string): Promise<{ domain: string; created: boolean }> {
  const { data: existingPlatform } = await db
    .from("website_domains")
    .select("id, domain")
    .eq("website_id", websiteId)
    .eq("tenant_id", tenantId)
    .eq("is_platform_subdomain", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle() as { data: { id: string; domain: string } | null };

  if (existingPlatform?.domain) {
    return { domain: existingPlatform.domain, created: false };
  }

  const base = process.env.PLATFORM_SUBDOMAIN_BASE || "tradeworkdesk.co.uk";
  const idSlug = websiteId.replace(/-/g, "").slice(0, 10) || tenantId.replace(/-/g, "").slice(0, 10) || "site";
  const baseSlug = `site-${idSlug}`;
  let slug = baseSlug;

  for (let counter = 2; counter < 100; counter++) {
    const { data: used } = await db
      .from("website_domains")
      .select("id")
      .eq("domain", `${slug}.${base}`)
      .maybeSingle() as { data: { id: string } | null };
    if (!used) break;
    slug = `${baseSlug}-${counter}`;
  }

  const fallbackDomain = `${slug}.${base}`;
  await db.from("website_domains").insert({
    website_id: websiteId,
    tenant_id: tenantId,
    domain: fallbackDomain,
    is_platform_subdomain: true,
    is_primary: false,
    is_active: true,
    verification_status: "verified",
    ssl_status: "active",
    activated_at: new Date().toISOString(),
  });

  await addDomainToVercel(fallbackDomain);
  return { domain: fallbackDomain, created: true };
}

async function activateCustomDomain(opts: { domainId: string; websiteId: string; domain: string; setPrimary: boolean }): Promise<void> {
  const now = new Date().toISOString();
  await db.from("website_domains").update({
    verification_status: "verified",
    ssl_status: "active",
    is_active: true,
    is_primary: opts.setPrimary,
    dns_checked_at: now,
    activated_at: now,
  }).eq("id", opts.domainId);

  if (opts.setPrimary) {
    await db
      .from("website_domains")
      .update({ is_primary: false })
      .eq("website_id", opts.websiteId)
      .eq("is_platform_subdomain", false)
      .neq("id", opts.domainId);
  }

  await addDomainToVercel(opts.domain);
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

router.post(
  "/website/domains/onboard",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { domain, verify_now = true, set_primary = true } = req.body as {
      domain?: string;
      verify_now?: boolean;
      set_primary?: boolean;
    };

    if (!domain) { res.status(400).json({ error: "domain is required" }); return; }

    const normDomain = normalizeDomainInput(domain);
    if (!isValidDomainFormat(normDomain)) {
      res.status(400).json({ error: "Invalid domain format" });
      return;
    }

    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const { data: existing } = await db
      .from("website_domains")
      .select("id, tenant_id, website_id, domain, is_platform_subdomain")
      .eq("domain", normDomain)
      .maybeSingle() as { data: { id: string; tenant_id: string; website_id: string; domain: string; is_platform_subdomain: boolean } | null };

    if (existing && existing.tenant_id !== req.tenantId) {
      res.status(409).json({ error: "This domain is already in use by another account" });
      return;
    }

    if (existing?.is_platform_subdomain) {
      res.status(400).json({ error: "Platform subdomains are managed automatically and cannot be onboarded as custom domains" });
      return;
    }

    let domainId = existing?.id;
    if (!domainId) {
      const { data: inserted, error } = await db
        .from("website_domains")
        .insert({
          website_id: website.id,
          tenant_id: req.tenantId,
          domain: normDomain,
          verification_status: "pending",
          ssl_status: "pending",
          is_primary: false,
          is_active: false,
        })
        .select("id")
        .single() as { data: { id: string } | null; error: unknown };

      if (error || !inserted?.id) {
        res.status(500).json({ error: "Failed to create domain onboarding record" });
        return;
      }
      domainId = inserted.id;
    }

    if (!verify_now) {
      const instructions = getDnsInstructions(normDomain);
      res.status(202).json({
        ok: true,
        status: "pending_dns",
        domain_id: domainId,
        domain: normDomain,
        dns_instructions: instructions,
      });
      return;
    }

    const dnsOk = await checkDomainPointsToPlatform(normDomain);
    if (dnsOk) {
      await activateCustomDomain({
        domainId,
        websiteId: String(website.id),
        domain: normDomain,
        setPrimary: Boolean(set_primary),
      });
    } else {
      await db
        .from("website_domains")
        .update({
          verification_status: "pending",
          ssl_status: "pending",
          is_active: false,
          dns_checked_at: new Date().toISOString(),
        })
        .eq("id", domainId);
    }

    const { data: updated } = await db
      .from("website_domains")
      .select("id, domain, verification_status, ssl_status, is_active, is_primary")
      .eq("id", domainId)
      .single() as { data: Record<string, unknown> | null };

    res.status(dnsOk ? 200 : 202).json({
      ok: true,
      status: dnsOk ? "active" : "pending_dns",
      dns_ok: dnsOk,
      domain: updated,
      dns_instructions: dnsOk ? null : getDnsInstructions(normDomain),
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
  "/website/domains/:id/offboard",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;
    const { delete_record = false } = req.body as { delete_record?: boolean };

    const { data: domain } = await db
      .from("website_domains")
      .select("id, website_id, domain, is_platform_subdomain")
      .eq("id", id)
      .eq("tenant_id", req.tenantId)
      .single() as { data: { id: string; website_id: string; domain: string; is_platform_subdomain: boolean } | null };

    if (!domain) {
      res.status(404).json({ error: "Domain not found" });
      return;
    }

    if (domain.is_platform_subdomain) {
      res.status(400).json({ error: "Platform subdomains cannot be offboarded" });
      return;
    }

    const fallback = await ensurePlatformFallbackDomain(domain.website_id, req.tenantId!);

    if (delete_record) {
      await db.from("website_domains").delete().eq("id", domain.id);
    } else {
      await db
        .from("website_domains")
        .update({
          is_active: false,
          is_primary: false,
          verification_status: "pending",
          ssl_status: "pending",
          activated_at: null,
        })
        .eq("id", domain.id);
    }

    const vercelResult = await removeDomainFromVercel(domain.domain);

    res.json({
      ok: true,
      offboarded_domain: domain.domain,
      deleted_record: Boolean(delete_record),
      fallback_domain: fallback.domain,
      fallback_created: fallback.created,
      vercel: vercelResult,
    });
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

router.post(
  "/website/domains/jobs/reconcile",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const website = await getWebsiteForTenant(req.tenantId!);
    if (!website) { res.status(404).json({ error: "Website not found" }); return; }

    const fallback = await ensurePlatformFallbackDomain(String(website.id), req.tenantId!);

    const { data: customDomains } = await db
      .from("website_domains")
      .select("id, domain, verification_status, is_active, is_primary")
      .eq("website_id", website.id)
      .eq("is_platform_subdomain", false)
      .order("created_at", { ascending: true }) as {
        data: Array<{ id: string; domain: string; verification_status: string; is_active: boolean; is_primary: boolean }> | null;
      };

    let activated = 0;
    let pending = 0;
    let alreadyActive = 0;

    const activeCustomDomains: Array<{ id: string; domain: string; is_primary: boolean }> = [];

    for (const d of customDomains || []) {
      if (d.is_active) {
        alreadyActive += 1;
        activeCustomDomains.push({ id: d.id, domain: d.domain, is_primary: d.is_primary });
        continue;
      }

      const dnsOk = await checkDomainPointsToPlatform(d.domain);
      if (!dnsOk) {
        pending += 1;
        await db
          .from("website_domains")
          .update({
            verification_status: "pending",
            ssl_status: "pending",
            dns_checked_at: new Date().toISOString(),
          })
          .eq("id", d.id);
        continue;
      }

      const hasPrimary = activeCustomDomains.some((x) => x.is_primary);
      await activateCustomDomain({
        domainId: d.id,
        websiteId: String(website.id),
        domain: d.domain,
        setPrimary: !hasPrimary,
      });
      activated += 1;
      activeCustomDomains.push({ id: d.id, domain: d.domain, is_primary: !hasPrimary });
    }

    const selectedPrimary = activeCustomDomains.find((d) => d.is_primary)?.domain || null;

    res.json({
      ok: true,
      website_id: website.id,
      fallback_domain: fallback.domain,
      fallback_created: fallback.created,
      summary: {
        activated,
        already_active: alreadyActive,
        pending_dns: pending,
        active_custom_domains: activeCustomDomains.length,
        primary_custom_domain: selectedPrimary,
      },
    });
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

// ─── AI Blog Assist ───────────────────────────────────────────────────────────

const AI_BLOG_FEATURE = "ai_blog_writing";

function getContentText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => {
      if (typeof block === "string") return block.trim();
      const value = block as Record<string, unknown>;
      return String(value.text || value.body || value.content || "").trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

function extractImagePlaceholders(content: string): Array<{ raw: string; description: string }> {
  const placeholders: Array<{ raw: string; description: string }> = [];
  const regex = /\[IMAGE:\s*([^\]]+?)\]/gi;
  for (const match of content.matchAll(regex)) {
    const raw = match[0]?.trim();
    const description = match[1]?.trim();
    if (raw && description) placeholders.push({ raw, description });
  }
  return placeholders;
}

router.post(
  "/website/blog/ai-assist",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { operation, title, existingContent, contentOptions } = req.body as {
      operation?: string;
      title?: string;
      existingContent?: string;
      contentOptions?: string[];
    };

    if (!operation || !["generate", "improve", "excerpt", "meta_description"].includes(operation)) {
      res.status(400).json({ error: "operation must be one of: generate, improve, excerpt, meta_description" });
      return;
    }
    if (!title?.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if ((operation === "improve" || operation === "excerpt" || operation === "meta_description") && !existingContent?.trim()) {
      res.status(400).json({ error: "existingContent is required for this operation" });
      return;
    }

    // ── Check addon is active ─────────────────────────────────────────────────
    const addonActive = await hasActiveAddon(req.tenantId!, AI_BLOG_FEATURE);
    if (!addonActive) {
      res.status(402).json({
        error: "AI Blog Writing add-on is not active. Go to Billing → Add-on Packages to enable it.",
        code: "addon_not_active",
      });
      return;
    }

    // ── Check credit balance ──────────────────────────────────────────────────
    const credits = await getAddonCredits(req.tenantId!, AI_BLOG_FEATURE);
    if (!credits || credits.credits_remaining <= 0) {
      res.status(402).json({
        error: "You have no AI writing credits remaining. Purchase more on the Billing page.",
        code: "no_credits",
        credits_remaining: 0,
        bundle_price: credits?.bundle_price ?? 25,
      });
      return;
    }

    // ── Fetch company context for better prompts ──────────────────────────────
    const { data: company } = await supabaseAdmin
      .from("company_settings")
      .select("name, trading_name, trade_types")
      .eq("tenant_id", req.tenantId!)
      .eq("singleton_id", "default")
      .maybeSingle() as { data: { name?: string; trading_name?: string; trade_types?: string } | null };

    const companyName = company?.trading_name ?? company?.name ?? undefined;
    const tradeType = (company as { trade_types?: string } | null)?.trade_types?.split(",")[0]?.trim();

    // ── Run AI ────────────────────────────────────────────────────────────────
    let result;
    try {
      result = await runBlogAi({
        operation: operation as BlogAiOperation,
        title: title.trim(),
        existingContent: existingContent?.trim(),
        companyName,
        tradeType,
        contentOptions: Array.isArray(contentOptions) ? contentOptions : [],
        tenantId: req.tenantId!,
        userId: req.userId,
      });
    } catch (err) {
      console.error("[blog-ai] AI generation error:", err);
      res.status(500).json({ error: "AI generation failed. Please try again." });
      return;
    }

    // ── Deduct credits ────────────────────────────────────────────────────────
    const deducted = await deductAddonCreditsAmount(req.tenantId!, AI_BLOG_FEATURE, result.creditsUsed);
    if (!deducted) {
      // Extremely unlikely (race condition) — still return the result but warn
      console.warn("[blog-ai] Credit deduction failed after successful generation — tenant:", req.tenantId);
    }

    const updatedCredits = await getAddonCredits(req.tenantId!, AI_BLOG_FEATURE);

    res.json({
      content: result.content,
      credits_used: result.creditsUsed,
      credits_remaining: updatedCredits?.credits_remaining ?? credits.credits_remaining - result.creditsUsed,
    });
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

// ─── Blog Image Generation ────────────────────────────────────────────────

router.post(
  "/website/blog/:id/generate-featured-image",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id: postId } = req.params;
    const { prompt } = req.body as { prompt?: string };

    if (!prompt?.trim()) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    // Check if blog addon is active and has credits
    const hasAddon = await hasActiveAddon(req.tenantId!, "ai_blog_writing");
    if (!hasAddon) {
      res.status(403).json({ error: "AI Blog Writing addon not active" });
      return;
    }

    const credits = await getAddonCredits(req.tenantId!, "ai_blog_writing");
    if (!credits || credits.credits_remaining < BLOG_IMAGE_CREDITS_ESTIMATE) {
      res.status(403).json({ error: "Insufficient credits to generate image" });
      return;
    }

    try {
      // Generate image
      const result = await generateBlogFeaturedImage(prompt, {
        tenantId: req.tenantId,
        userId: req.userId,
      });

      // Deduct credits
      await deductAddonCreditsAmount(req.tenantId!, "ai_blog_writing", result.creditsUsed);

      // Update blog post with featured image URL
      const { error: updateError } = await db
        .from("website_blog_posts")
        .update({ featured_image_url: result.imageUrl })
        .eq("id", postId)
        .eq("tenant_id", req.tenantId);

      if (updateError) {
        console.error("Failed to update featured image URL:", updateError);
        res.status(500).json({ error: "Failed to save image URL to post" });
        return;
      }

      res.json({
        imageUrl: result.imageUrl,
        costUsd: result.costUsd,
        creditsUsed: result.creditsUsed,
      });
    } catch (error) {
      console.error("Failed to generate featured image:", error);
      res.status(500).json({ error: "Failed to generate featured image" });
    }
  }
);

router.post(
  "/website/blog/:id/generate-inline-images",
  requireAuth,
  requireTenant,
  requireRole("admin", "office_staff"),
  requireWebsiteBuilder(),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id: postId } = req.params;
    const { count, content } = req.body as { count?: number; content?: string };
    const requestedCount = Math.max(1, Math.min(10, Number(count) || 1));

    const hasAddon = await hasActiveAddon(req.tenantId!, AI_BLOG_FEATURE);
    if (!hasAddon) {
      res.status(403).json({ error: "AI Blog Writing addon not active" });
      return;
    }

    const { data: post, error: postError } = await db
      .from("website_blog_posts")
      .select("id, title, content")
      .eq("id", postId)
      .eq("tenant_id", req.tenantId)
      .single() as { data: { id: string; title: string; content: unknown } | null; error: unknown };

    if (postError || !post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const contentText = typeof content === "string" && content.trim().length > 0
      ? content
      : getContentText(post.content);
    const placeholders = extractImagePlaceholders(contentText);
    if (placeholders.length === 0) {
      res.status(400).json({ error: "No [IMAGE: ...] placeholders found in this post" });
      return;
    }

    const targetCount = Math.min(requestedCount, placeholders.length);
    const neededCredits = targetCount * BLOG_IMAGE_CREDITS_ESTIMATE;
    const credits = await getAddonCredits(req.tenantId!, AI_BLOG_FEATURE);
    if (!credits || credits.credits_remaining < neededCredits) {
      res.status(403).json({
        error: `Insufficient credits. Need ${neededCredits} credits to generate ${targetCount} image${targetCount === 1 ? "" : "s"}.`,
        needed_credits: neededCredits,
        credits_remaining: credits?.credits_remaining ?? 0,
      });
      return;
    }

    let updatedContent = contentText;
    let totalCreditsUsed = 0;
    let totalCostUsd = 0;
    const generatedImages: Array<{ description: string; imageUrl: string }> = [];

    for (let i = 0; i < targetCount; i += 1) {
      const placeholder = placeholders[i];
      const result = await generateBlogInlineImage(placeholder.description, {
        tenantId: req.tenantId,
        userId: req.userId,
      });

      const creditDeducted = await deductAddonCreditsAmount(req.tenantId!, AI_BLOG_FEATURE, result.creditsUsed);
      if (!creditDeducted) {
        res.status(403).json({ error: "Insufficient credits while generating images. Please top up and retry." });
        return;
      }

      updatedContent = updatedContent.replace(
        placeholder.raw,
        `\n![${placeholder.description}](${result.imageUrl})\n`,
      );
      totalCreditsUsed += result.creditsUsed;
      totalCostUsd += result.costUsd;
      generatedImages.push({ description: placeholder.description, imageUrl: result.imageUrl });
    }

    const { error: updateError } = await db
      .from("website_blog_posts")
      .update({ content: updatedContent })
      .eq("id", postId)
      .eq("tenant_id", req.tenantId);

    if (updateError) {
      res.status(500).json({ error: "Failed to save generated images to post content" });
      return;
    }

    const updatedCredits = await getAddonCredits(req.tenantId!, AI_BLOG_FEATURE);

    res.json({
      content: updatedContent,
      generated_count: generatedImages.length,
      generated_images: generatedImages,
      credits_used: totalCreditsUsed,
      credits_remaining: updatedCredits?.credits_remaining ?? 0,
      cost_usd: totalCostUsd,
    });
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
      .select("id, name, form_type, fields, notify_email, auto_create_enquiry, is_active, created_at")
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
    const { auto_create_enquiry, notify_email, name, is_active, fields } = req.body as Record<string, unknown>;

    const { data: existingForm } = await db
      .from("website_forms")
      .select("id, tenant_id, website_id")
      .eq("id", id)
      .maybeSingle() as { data: { id: string; tenant_id: string | null; website_id: string | null } | null };

    if (!existingForm) {
      res.status(404).json({ error: "Form not found" });
      return;
    }

    const isOwnedByTenant = existingForm.tenant_id
      ? existingForm.tenant_id === req.tenantId
      : false;

    let isOwnedByTenantWebsite = false;
    if (!isOwnedByTenant && existingForm.website_id) {
      const { data: ownedWebsite } = await db
        .from("websites")
        .select("id")
        .eq("id", existingForm.website_id)
        .eq("tenant_id", req.tenantId)
        .maybeSingle() as { data: { id: string } | null };
      isOwnedByTenantWebsite = Boolean(ownedWebsite);
    }

    if (!isOwnedByTenant && !isOwnedByTenantWebsite) {
      res.status(404).json({ error: "Form not found" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (typeof auto_create_enquiry === "boolean") updates.auto_create_enquiry = auto_create_enquiry;
    if (notify_email !== undefined) updates.notify_email = notify_email || null;
    if (name !== undefined) updates.name = name;
    if (typeof is_active === "boolean") updates.is_active = is_active;
    if (fields !== undefined && Array.isArray(fields)) updates.fields = fields;

    const { data, error } = await db
      .from("website_forms")
      .update(updates)
      .eq("id", id)
      .select("id, name, form_type, fields, notify_email, auto_create_enquiry, is_active, created_at")
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

    // If auto_create_enquiry is enabled, create enquiry first so notifications
    // can include a direct deep-link URL.
    let enquiryId: string | null = null;
    if (form.auto_create_enquiry) {
      enquiryId = await createEnquiryFromFormSubmission(
        String(form.tenant_id),
        submission!.id,
        form.form_type as string,
        submissionData,
      );
    }

    // Send notifications (email + optional SMS) based on company settings
    void sendFormSubmissionNotifications(
      String(form.tenant_id),
      String(form.notify_email || ""),
      String(form.form_type || "contact"),
      submissionData,
      submission!.id,
      enquiryId,
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
      db.from("website_blog_posts").select("id, slug, title, excerpt, content, featured_image_url, published_at, meta_title, meta_description, website_blog_categories(name, slug)").eq("website_id", domainRecord.website_id).eq("status", "published").order("published_at", { ascending: false }).limit(20),
      db.from("website_testimonials").select("id, author_name, location, rating, body, sort_order").eq("website_id", domainRecord.website_id).eq("is_visible", true).order("sort_order", { ascending: true }),
      db.from("website_gallery_items").select("id, image_url, caption, alt_text, category, sort_order").eq("website_id", domainRecord.website_id).eq("is_visible", true).order("sort_order", { ascending: true }).limit(50),
    ]) as Array<{ data: unknown }>;

    // Fetch company settings for contact info
    const { data: companySettings } = await supabaseAdmin
      .from("company_settings")
      .select("name, trading_name, phone, email, website, address_line1, address_line2, city, county, postcode, service_area, coverage_radius_miles, gas_safe_number, oftec_number, logo_url, website_closure_notice_enabled, website_closure_notice_message, website_closure_notice_start_date, website_closure_notice_end_date")
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
      .select("name, trading_name, phone, email, website, address_line1, address_line2, city, county, postcode, service_area, coverage_radius_miles, gas_safe_number, oftec_number, logo_url, website_closure_notice_enabled, website_closure_notice_message, website_closure_notice_start_date, website_closure_notice_end_date")
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

router.post(
  "/public/website/postcode-coverage/:websiteId",
  async (req, res): Promise<void> => {
    if (RENDERER_SECRET && req.headers["x-renderer-secret"] !== RENDERER_SECRET) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { websiteId } = req.params;
    const postcode = typeof req.body?.postcode === "string"
      ? req.body.postcode.trim().toUpperCase().replace(/\s+/g, "")
      : "";

    if (!postcode) {
      res.status(400).json({ error: "Postcode is required" });
      return;
    }

    const { data: website } = await supabaseAdmin
      .from("websites")
      .select("tenant_id")
      .eq("id", websiteId)
      .maybeSingle() as { data: { tenant_id: string } | null };

    if (!website?.tenant_id) {
      res.status(404).json({ error: "Website not found" });
      return;
    }

    const { data: company } = await supabaseAdmin
      .from("company_settings")
      .select("postcode, service_area, coverage_radius_miles")
      .eq("tenant_id", website.tenant_id)
      .eq("singleton_id", "default")
      .maybeSingle() as { data: { postcode: string | null; service_area: string | null; coverage_radius_miles: number | null } | null };

    const originPostcode = (company?.postcode || "").trim();
    if (!originPostcode) {
      res.json({ covered: null, mode: "radius", reason: "Add your business postcode in admin to enable postcode checks." });
      return;
    }

    const configuredRadius = Number(company?.coverage_radius_miles ?? 0);
    const fallbackRadius = Number(process.env.DEFAULT_POSTCODE_COVERAGE_RADIUS_MILES ?? 20);
    const radius = configuredRadius > 0 ? configuredRadius : fallbackRadius;

    if (!radius || radius <= 0) {
      res.json({ covered: null, mode: "text-only", reason: company?.service_area || "Postcode coverage has not been configured yet." });
      return;
    }

    const [origin, target] = await Promise.all([
      geocodeAddress(originPostcode),
      geocodeAddress(postcode),
    ]);

    if (!origin || !target) {
      res.json({ covered: null, mode: "radius", reason: "We could not verify that postcode right now." });
      return;
    }

    const toRad = (value: number) => (value * Math.PI) / 180;
    const earthRadiusMiles = 3958.8;
    const dLat = toRad(target.latitude - origin.latitude);
    const dLon = toRad(target.longitude - origin.longitude);
    const lat1 = toRad(origin.latitude);
    const lat2 = toRad(target.latitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const distanceMiles = 2 * earthRadiusMiles * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const covered = distanceMiles <= radius;

    res.json({
      covered,
      mode: "radius",
      default_radius_applied: configuredRadius <= 0,
      origin_latitude: origin.latitude,
      origin_longitude: origin.longitude,
      target_latitude: target.latitude,
      target_longitude: target.longitude,
      distance_miles: Number(distanceMiles.toFixed(1)),
      radius_miles: radius,
      reason: covered ? "This postcode is within your service area." : "This postcode is outside your service area.",
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

    const { data: page } = await db
      .from("website_pages")
      .select("website_id")
      .eq("id", pageId)
      .maybeSingle() as { data: { website_id: string } | null };

    const serviceOptions = page?.website_id
      ? await getContactFormServiceOptions(page.website_id)
      : [];

    const { data: blocks } = await db
      .from("website_blocks")
      .select("id, block_type, content, sort_order")
      .eq("page_id", pageId)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null };

    res.json(applyServiceOptionsToBlocks(blocks || [], serviceOptions));
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

    const serviceOptions = websiteId
      ? await getContactFormServiceOptions(websiteId)
      : [];

    const { data: blocks } = await db
      .from("website_blocks")
      .select("id, block_type, content, sort_order")
      .eq("page_id", page.id)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true }) as { data: Record<string, unknown>[] | null };

    res.json({ ...page, blocks: applyServiceOptionsToBlocks(blocks || [], serviceOptions) });
  }
);

// ─── Helper: notify tenant of new form submission (email + optional SMS) ─────

async function sendFormSubmissionNotifications(
  tenantId: string,
  formNotifyEmail: string,
  formType: string,
  data: Record<string, unknown>,
  submissionId: string,
  enquiryId: string | null,
): Promise<void> {
  try {
    // Fetch company settings for notification prefs + contact info
    const { data: cs } = await (supabaseAdmin as any)
      .from("company_settings")
      .select("email, name, trading_name, phone, website_enquiry_email_notify, website_enquiry_sms_notify, sms_sender_name")
      .eq("tenant_id", tenantId)
      .eq("singleton_id", "default")
      .maybeSingle() as { data: {
        email: string | null;
        name: string | null;
        trading_name: string | null;
        phone: string | null;
        website_enquiry_email_notify: boolean | null;
        website_enquiry_sms_notify: boolean | null;
        sms_sender_name: string | null;
      } | null };

    const emailEnabled = cs?.website_enquiry_email_notify !== false; // default true
    const smsEnabled   = cs?.website_enquiry_sms_notify === true;

    // Build notification body lines
    const lines: string[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (!val || key === "photos") continue;
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`${label}: ${String(val)}`);
    }
    const photoUrls = extractPhotoUrls(data);
    const enquiryUrl = enquiryId
      ? `https://www.tradeworkdesk.co.uk/enquiries/${enquiryId}`
      : "https://www.tradeworkdesk.co.uk/enquiries";

    // ── Email ─────────────────────────────────────────────────────────────────
    if (emailEnabled) {
      let toEmail = (formNotifyEmail || "").trim();
      if (!toEmail) toEmail = cs?.email?.trim() || "";
      if (toEmail) {
        const subject = `New ${formType} form submission on your website`;
        const photoSection = photoUrls.length > 0
          ? [`\nAttached photos (${photoUrls.length}):`, ...photoUrls.map((u, i) => `  Photo ${i + 1}: ${u}`)]
          : [];
        const body = [
          `You have received a new ${formType} enquiry from your website.`,
          "",
          lines.join("\n"),
          ...photoSection,
          "",
          `Submission ID: ${submissionId}`,
          enquiryId ? `Enquiry ID: ${enquiryId}` : "",
          "",
          "Open this enquiry directly:",
          enquiryUrl,
        ].join("\n");
        await sendSimpleNotification(toEmail, subject, body).catch((e) =>
          console.error("[website-form] Failed to send notification email:", (e as Error).message)
        );
      }
    }

    // ── SMS ───────────────────────────────────────────────────────────────────
    if (smsEnabled && cs?.phone) {
      try {
        const { data: platformSettings } = await (supabaseAdmin as any)
          .from("platform_settings")
          .select("key, value")
          .in("key", ["sms_works_api_key", "sms_works_secret"]);

        const creds: Record<string, string> = {};
        for (const s of (platformSettings ?? []) as { key: string; value: string }[]) creds[s.key] = s.value;

        if (creds["sms_works_api_key"] && creds["sms_works_secret"]) {
          const submitterName = String(data.name || data.full_name || "Someone").trim();
          const submitterPhone = String(data.phone || data.mobile || "").trim();
          const smsBody = `New ${formType} enquiry from ${submitterName}${submitterPhone ? " (" + submitterPhone + ")" : ""}. ${enquiryUrl}`;
          const senderName = cs.sms_sender_name || cs.trading_name || cs.name || "TradeWork";

          // Authenticate with SMS Works
          const authRes = await fetch("https://api.thesmsworks.co.uk/v1/auth/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: creds["sms_works_api_key"], secret: creds["sms_works_secret"] }),
          });
          if (authRes.ok) {
            const { token } = await authRes.json() as { token: string };
            await fetch("https://api.thesmsworks.co.uk/v1/message/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: token },
              body: JSON.stringify({
                sender: senderName.slice(0, 11),
                destination: cs.phone.replace(/\s/g, ""),
                content: smsBody,
              }),
            });
          }
        }
      } catch (smsErr) {
        console.error("[website-form] SMS notification failed:", (smsErr as Error).message);
      }
    }
  } catch (err) {
    console.error("[website-form] Failed to send notifications:", (err as Error).message);
  }
}

// ─── Helper: create enquiry from form submission ──────────────────────────────

async function createEnquiryFromFormSubmission(
  tenantId: string,
  submissionId: string,
  formType: string,
  data: Record<string, unknown>,
): Promise<string | null> {
  try {
    const formKind = String(data.form_kind || "contact").trim();
    const source = formKind === "free_survey"
      ? "website_free_survey"
      : formKind === "contact"
        ? "website_contact_form"
        : "website";

    // Map common form field names to enquiry fields
    const contactName = String(
      data.name || data.full_name || data.contact_name || "Website enquiry"
    ).trim();
    const email = String(data.email || data.contact_email || "").trim() || null;
    const phone = String(data.phone || data.mobile || data.contact_phone || "").trim() || null;

    // Build a rich description from all submitted fields
    const skip = new Set(["name", "full_name", "contact_name", "email", "contact_email", "phone", "mobile", "contact_phone", "photos", "form_kind"]);
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
        source,
        description,
        address: postcode,
        status: "new",
        notes: `Submitted via website ${formKind === "free_survey" ? "free survey" : "contact form"} (submission ID: ${submissionId})`,
      })
      .select("id")
      .single();

    if (error || !enquiry) {
      console.error("[website-form] Failed to create enquiry:", error?.message);
      return null;
    }

    const enquiryId = String((enquiry as Record<string, unknown>).id || "");

    // Resolve a real tenant user for uploaded_by to satisfy stricter DB setups.
    const uploadedBy = await resolveAttachmentUploaderId(tenantId);

    // Mirror uploaded public website photos into enquiry attachments so they
    // appear in the tenant dashboard photo panel.
    await attachSubmissionPhotosToEnquiry(tenantId, enquiryId, data, uploadedBy);

    // Link submission to enquiry
    await (supabaseAdmin as any)
      .from("website_form_submissions")
      .update({ enquiry_id: (enquiry as Record<string, unknown>).id, status: "converted" })
      .eq("id", submissionId);

    return enquiryId;

  } catch (err) {
    console.error("[website-form] Failed to create enquiry:", (err as Error).message);
    return null;
  }
}

function publicUploadsPathFromUrl(url: string): string | null {
  const marker = "/storage/v1/object/public/public-uploads/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const encodedPath = url.slice(idx + marker.length).split("?")[0] || "";
  if (!encodedPath) return null;
  return decodeURIComponent(encodedPath);
}

async function attachSubmissionPhotosToEnquiry(
  tenantId: string,
  enquiryId: string,
  data: Record<string, unknown>,
  uploadedBy: string | null,
): Promise<void> {
  const photoUrls = extractPhotoUrls(data);
  if (photoUrls.length === 0) return;

  for (let i = 0; i < photoUrls.length; i++) {
    const photo = photoUrls[i];
    if (!photo || !photo.trim()) continue;

    const photoUrl = photo.trim();
    let buffer: Buffer | null = null;
    let mimeType = "image/jpeg";

    try {
      const srcPath = publicUploadsPathFromUrl(photoUrl);
      if (srcPath) {
        const urlFileName = srcPath.split("/").pop() || `website-photo-${i + 1}.jpg`;
        const ext = (urlFileName.split(".").pop() || "").toLowerCase();
        const inferredMime = ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "gif"
              ? "image/gif"
              : "image/jpeg";

        const { error: directInsertErr } = await (supabaseAdmin as any)
          .from("file_attachments")
          .insert({
            tenant_id: tenantId,
            file_name: urlFileName,
            file_type: inferredMime,
            file_size: null,
            storage_path: srcPath,
            entity_type: "enquiry",
            entity_id: enquiryId,
            uploaded_by: uploadedBy,
            description: "Uploaded from website contact form",
          });

        if (!directInsertErr) {
          // Attachment row created using original public-uploads object.
          continue;
        }

        console.error("[website-form] Direct attachment insert failed; falling back to copy:", directInsertErr.message);
      }

      if (!buffer) {
        const resp = await fetch(photoUrl);
        if (!resp.ok) continue;
        mimeType = resp.headers.get("content-type") || mimeType;
        const arr = await resp.arrayBuffer();
        buffer = Buffer.from(arr);
      }

      const urlFileName = photoUrl.split("/").pop()?.split("?")[0] || `website-photo-${i + 1}.jpg`;
      const storagePath = `enquiry/${enquiryId}/${Date.now()}-${i + 1}-${urlFileName}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from("service-photos")
        .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

      if (uploadErr) {
        console.error("[website-form] Failed to copy photo to enquiry attachments:", uploadErr.message);
        continue;
      }

      const { error: insertErr } = await (supabaseAdmin as any)
        .from("file_attachments")
        .insert({
          tenant_id: tenantId,
          file_name: urlFileName,
          file_type: mimeType,
          file_size: buffer.length,
          storage_path: storagePath,
          entity_type: "enquiry",
          entity_id: enquiryId,
          uploaded_by: uploadedBy,
          description: "Uploaded from website contact form",
        });

      if (insertErr) {
        console.error("[website-form] Failed to insert enquiry photo attachment:", insertErr.message);
      }
    } catch (photoErr) {
      console.error("[website-form] Failed to attach submission photo:", (photoErr as Error).message);
    }
  }
}

async function resolveAttachmentUploaderId(tenantId: string): Promise<string | null> {
  // Prefer admin/office users; fall back to any tenant profile.
  const { data: adminOrOffice } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .in("role", ["admin", "office_staff"])
    .limit(1)
    .maybeSingle();

  if (adminOrOffice?.id) return String(adminOrOffice.id);

  const { data: anyProfile } = await (supabaseAdmin as any)
    .from("profiles")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();

  return anyProfile?.id ? String(anyProfile.id) : null;
}

function extractPhotoUrls(data: Record<string, unknown>): string[] {
  const raw = data.photos;
  if (!raw) return [];

  // Current renderer sends string[]
  if (Array.isArray(raw)) {
    return raw
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((v) => /^https?:\/\//i.test(v));
  }

  // Backward compatibility: older clients may send comma/newline-separated string
  if (typeof raw === "string") {
    return raw
      .split(/[\n,]/g)
      .map((v) => v.trim())
      .filter((v) => /^https?:\/\//i.test(v));
  }

  return [];
}

export default router;
