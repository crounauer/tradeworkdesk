import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, requireRole, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { supabaseAdmin } from "../lib/supabase";
import { encryptCredentials } from "../lib/social-crypto";
import { dispatchPost } from "../lib/social-platforms";
import { generatePostSuggestions, generateSocialImage, type SuggestionItem } from "../lib/social-ai";
import {
  SOCIAL_POST_TYPES,
  type SocialPostType,
  buildUtmTaggedUrl,
  listPromotionPages,
  resolvePromotionPageUrl,
} from "../lib/social-website-promotion";

const SUPPORTED_PLATFORMS = ["x", "facebook", "instagram", "google_business"] as const;
type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];
const SUPPORTED_SOCIAL_CHANNELS = ["facebook"] as const;

const FACEBOOK_POST_PERMISSIONS = [
  "facebook_post_create",
  "facebook_post_publish",
  "facebook_post_schedule",
  "facebook_post_manage_connections",
] as const;

type FacebookPostPermission = (typeof FACEBOOK_POST_PERMISSIONS)[number];

const FACEBOOK_ROLE_PERMISSIONS: Record<string, Set<FacebookPostPermission>> = {
  admin: new Set(FACEBOOK_POST_PERMISSIONS),
  super_admin: new Set(FACEBOOK_POST_PERMISSIONS),
};

function isSupportedPlatform(p: string): p is SupportedPlatform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(p);
}

function hasFacebookPermission(req: AuthenticatedRequest, permission: FacebookPostPermission): boolean {
  if (!req.userRole) return false;
  return FACEBOOK_ROLE_PERMISSIONS[req.userRole]?.has(permission) ?? false;
}

async function getPlatformMarketingTenantId(): Promise<string | null> {
  const { data: configured } = await supabaseAdmin
    .from("platform_settings")
    .select("value")
    .eq("key", "fallback_tenant_id")
    .maybeSingle();

  const configuredId = typeof configured?.value === "string" ? configured.value.trim() : "";
  if (configuredId) return configuredId;

  const { data: oldestTenant } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return oldestTenant?.id || null;
}

async function resolveTenantId(req: AuthenticatedRequest): Promise<string | undefined> {
  if (req.userRole === "super_admin") {
    const platformTenantId = await getPlatformMarketingTenantId();
    return platformTenantId ?? undefined;
  }
  return req.tenantId;
}

function coercePostType(value: unknown): SocialPostType {
  const raw = String(value || "business");
  return (SOCIAL_POST_TYPES as readonly string[]).includes(raw)
    ? (raw as SocialPostType)
    : "business";
}

function sanitizeCampaignValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function buildDefaultCampaign(tenantId: string, postType: SocialPostType): Promise<string> {
  const { data: company } = await supabaseAdmin
    .from("company_settings")
    .select("name, trading_name")
    .eq("tenant_id", tenantId)
    .eq("singleton_id", "default")
    .maybeSingle();

  const rawName = String(company?.name || company?.trading_name || "platform");
  const normalizedName = sanitizeCampaignValue(rawName) || "platform";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${postType}-${normalizedName}-${date}`;
}

const router: IRouter = Router();

router.get(
  "/admin/social/context",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: "Unable to resolve social tenant scope" });
      return;
    }

    const pages = await listPromotionPages(tenantId);
    const availablePromotionPages = pages.filter((p) => p.status === "published" && !!p.pageUrl);

    res.json({
      tenantId,
      scope: req.userRole === "super_admin" ? "platform_marketing" : "tenant_business",
      socialChannels: SUPPORTED_SOCIAL_CHANNELS,
      postTypes: SOCIAL_POST_TYPES,
      permissions: FACEBOOK_POST_PERMISSIONS.filter((permission) => hasFacebookPermission(req, permission)),
      websitePromotion: {
        enabled: availablePromotionPages.length > 0,
        disabledMessage: availablePromotionPages.length === 0
          ? "Website required to use Website Promotion Post"
          : null,
      },
    });
  },
);

router.get(
  "/admin/social/website-pages",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      res.status(400).json({ error: "Unable to resolve social tenant scope" });
      return;
    }

    const pages = await listPromotionPages(tenantId);
    const publishedPages = pages.filter((p) => p.status === "published" && !!p.pageUrl);

    res.json({
      enabled: publishedPages.length > 0,
      disabledMessage: publishedPages.length === 0
        ? "Website required to use Website Promotion Post"
        : null,
      pages: publishedPages,
    });
  },
);

router.get(
  "/admin/social/accounts",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const tenantId = await resolveTenantId(req);

    let query = supabaseAdmin
      .from("social_accounts")
      .select("id, platform, page_id, page_name, instagram_business_id, profile_name, expires_at, is_active, auto_post, created_at")
      .order("created_at", { ascending: false });

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  },
);

router.post(
  "/admin/social/accounts",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const { platform, credentials, profileName, pageId, pageName, instagramBusinessId } = req.body;
    const tenantId = await resolveTenantId(req);

    if (!tenantId) {
      res.status(400).json({ error: "Unable to resolve social tenant scope" });
      return;
    }

    if (!platform || !credentials || !profileName) {
      res.status(400).json({ error: "platform, credentials, and profileName are required" });
      return;
    }

    if (!isSupportedPlatform(platform)) {
      res.status(400).json({ error: `Platform "${platform}" is not supported. Supported: ${SUPPORTED_PLATFORMS.join(", ")}` });
      return;
    }

    const encrypted = encryptCredentials(credentials);

    const { data, error } = await supabaseAdmin
      .from("social_accounts")
      .insert({
        tenant_id: tenantId,
        platform,
        encrypted_credentials: encrypted,
        profile_name: profileName,
        page_id: pageId || null,
        page_name: pageName || null,
        instagram_business_id: instagramBusinessId || null,
      })
      .select("id, platform, profile_name, page_id, page_name, instagram_business_id, is_active, auto_post, created_at")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  },
);

router.patch(
  "/admin/social/accounts/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const { id } = req.params;
    const { isActive, autoPost } = req.body;
    const tenantId = await resolveTenantId(req);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (isActive !== undefined) updates.is_active = isActive;
    if (autoPost !== undefined) updates.auto_post = autoPost;

    let query = supabaseAdmin
      .from("social_accounts")
      .update(updates)
      .eq("id", id);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query
      .select("id, platform, profile_name, is_active, auto_post")
      .single();

    if (error) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    res.json(data);
  },
);

router.delete(
  "/admin/social/accounts/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_manage_connections")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const { id } = req.params;
    const tenantId = await resolveTenantId(req);

    let query = supabaseAdmin
      .from("social_accounts")
      .delete()
      .eq("id", id);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { error } = await query;

    if (error) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    res.json({ success: true });
  },
);

router.get(
  "/admin/social/posts",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { status, platform, page = "1", limit = "20", postType } = req.query as Record<string, string>;
    const tenantId = await resolveTenantId(req);
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from("social_posts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }
    if (status) query = query.eq("status", status);
    if (platform) query = query.eq("platform", platform);
    if (postType) query = query.eq("post_type", postType);

    const { data, error, count } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ posts: data, total: count ?? 0 });
  },
);

router.post(
  "/admin/social/post",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_create")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const {
      platform,
      content,
      imageUrl,
      videoUrl,
      linkUrl,
      scheduledFor,
      postType: rawPostType,
      websitePageId,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
    } = req.body;
    const tenantId = await resolveTenantId(req);

    if (!tenantId) {
      res.status(400).json({ error: "Unable to resolve social tenant scope" });
      return;
    }

    if (!platform || !content) {
      res.status(400).json({ error: "platform and content are required" });
      return;
    }

    if (!isSupportedPlatform(platform)) {
      res.status(400).json({ error: `Platform "${platform}" is not supported. Supported: ${SUPPORTED_PLATFORMS.join(", ")}` });
      return;
    }

    const postType = coercePostType(rawPostType);
    if (postType === "website_promotion" && platform !== "facebook") {
      res.status(400).json({ error: "Website Promotion Post is currently supported for Facebook only" });
      return;
    }

    const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
    const isScheduled = scheduledDate && scheduledDate > new Date();

    if (isScheduled && !hasFacebookPermission(req, "facebook_post_schedule")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    if (!isScheduled && !hasFacebookPermission(req, "facebook_post_publish")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const campaignDefault = await buildDefaultCampaign(tenantId, postType);
    const normalizedUtm = {
      source: String(utmSource || "facebook").trim() || "facebook",
      medium: String(utmMedium || "social").trim() || "social",
      campaign: String(utmCampaign || campaignDefault).trim() || campaignDefault,
      content: utmContent ? String(utmContent).trim() : null,
    };

    let resolvedWebsitePageId: string | null = null;
    let resolvedWebsitePageUrl: string | null = null;
    let finalLinkUrl: string | null = linkUrl ? String(linkUrl) : null;

    if (postType === "website_promotion") {
      if (!websitePageId) {
        res.status(400).json({ error: "websitePageId is required for Website Promotion Post" });
        return;
      }

      const page = await resolvePromotionPageUrl({
        tenantId,
        websitePageId: String(websitePageId),
        requirePublished: true,
      });

      resolvedWebsitePageId = page.pageId;
      resolvedWebsitePageUrl = page.pageUrl;
      finalLinkUrl = buildUtmTaggedUrl(page.pageUrl, normalizedUtm);
    }

    const { data: post, error: insertError } = await supabaseAdmin
      .from("social_posts")
      .insert({
        tenant_id: tenantId,
        created_by_user_id: req.userId || null,
        platform,
        content,
        image_url: imageUrl || null,
        video_url: videoUrl || null,
        link_url: finalLinkUrl,
        post_type: postType,
        website_page_id: resolvedWebsitePageId,
        website_page_url: resolvedWebsitePageUrl,
        final_link_url: finalLinkUrl,
        utm_source: normalizedUtm.source,
        utm_medium: normalizedUtm.medium,
        utm_campaign: normalizedUtm.campaign,
        utm_content: normalizedUtm.content,
        scheduled_for: scheduledDate ? scheduledDate.toISOString() : null,
        status: isScheduled ? "scheduled" : "draft",
      })
      .select()
      .single();

    if (insertError || !post) {
      res.status(500).json({ error: insertError?.message ?? "Failed to create post" });
      return;
    }

    if (!isScheduled) {
      const { data: account } = await supabaseAdmin
        .from("social_accounts")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("platform", platform)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!account) {
        await supabaseAdmin
          .from("social_posts")
          .update({ status: "failed", error: `No active ${platform} account found`, updated_at: new Date().toISOString() })
          .eq("id", post.id);
        res.status(400).json({ error: `No active ${platform} account connected` });
        return;
      }

      try {
        const result = await dispatchPost(post, account);
        const { data: updated } = await supabaseAdmin
          .from("social_posts")
          .update({
            status: "posted",
            post_id: result.postId || null,
            post_url: result.postUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id)
          .select()
          .single();
        res.json(updated);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await supabaseAdmin
          .from("social_posts")
          .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
          .eq("id", post.id);
        res.status(500).json({ error: message });
        return;
      }
    }

    res.json(post);
  },
);

router.post(
  "/admin/social/bulk-schedule",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    if (!hasFacebookPermission(req, "facebook_post_schedule")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    const { posts, intervalMinutes = 60 } = req.body;
    const tenantId = await resolveTenantId(req);

    if (!tenantId) {
      res.status(400).json({ error: "Unable to resolve social tenant scope" });
      return;
    }

    if (!Array.isArray(posts) || posts.length === 0) {
      res.status(400).json({ error: "posts array is required" });
      return;
    }

    const now = new Date();
    const rows: Array<Record<string, unknown>> = [];
    for (let i = 0; i < posts.length; i += 1) {
      const p = posts[i] as Record<string, unknown>;
      const postType = coercePostType(p.postType);
      const platform = String(p.platform || "");
      const websitePageId = p.websitePageId ? String(p.websitePageId) : null;
      const campaignDefault = await buildDefaultCampaign(tenantId, postType);
      const normalizedUtm = {
        source: String(p.utmSource || "facebook").trim() || "facebook",
        medium: String(p.utmMedium || "social").trim() || "social",
        campaign: String(p.utmCampaign || campaignDefault).trim() || campaignDefault,
        content: p.utmContent ? String(p.utmContent).trim() : null,
      };

      let resolvedWebsitePageId: string | null = null;
      let resolvedWebsitePageUrl: string | null = null;
      let finalLinkUrl: string | null = p.linkUrl ? String(p.linkUrl) : null;

      if (postType === "website_promotion") {
        if (platform !== "facebook") {
          res.status(400).json({ error: "Website Promotion Post is currently supported for Facebook only" });
          return;
        }
        if (!websitePageId) {
          res.status(400).json({ error: "websitePageId is required for Website Promotion Post" });
          return;
        }

        const page = await resolvePromotionPageUrl({
          tenantId,
          websitePageId,
          requirePublished: true,
        });
        resolvedWebsitePageId = page.pageId;
        resolvedWebsitePageUrl = page.pageUrl;
        finalLinkUrl = buildUtmTaggedUrl(page.pageUrl, normalizedUtm);
      }

      rows.push({
        tenant_id: tenantId,
        created_by_user_id: req.userId || null,
        platform,
        content: p.content,
        image_url: p.imageUrl || null,
        video_url: p.videoUrl || null,
        link_url: finalLinkUrl,
        post_type: postType,
        website_page_id: resolvedWebsitePageId,
        website_page_url: resolvedWebsitePageUrl,
        final_link_url: finalLinkUrl,
        utm_source: normalizedUtm.source,
        utm_medium: normalizedUtm.medium,
        utm_campaign: normalizedUtm.campaign,
        utm_content: normalizedUtm.content,
        scheduled_for: new Date(now.getTime() + i * (intervalMinutes as number) * 60 * 1000).toISOString(),
        status: "scheduled",
        entity_type: p.entityType || null,
        entity_id: p.entityId || null,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("social_posts")
      .insert(rows)
      .select();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ scheduled: data?.length ?? 0, posts: data });
  },
);

router.get(
  "/admin/social/suggestions",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const tenantId = await resolveTenantId(req);
      if (!tenantId) {
        res.status(400).json({ error: "Unable to resolve social tenant scope" });
        return;
      }

      const items: SuggestionItem[] = [];

      const { data: recentJobs } = await supabaseAdmin
        .from("jobs")
        .select("id, job_type, description, status")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);

      for (const job of recentJobs ?? []) {
        items.push({
          entityType: "article",
          entityId: `job-${job.id}`,
          title: `${job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)} Job ${job.status === "completed" ? "Completed" : "Update"}`,
          description: job.description || `A ${job.job_type} job is ${job.status}`,
        });
      }

      const { data: recentCustomers } = await supabaseAdmin
        .from("customers")
        .select("id, first_name, last_name, city")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);

      for (const customer of recentCustomers ?? []) {
        const fullName = `${customer.first_name} ${customer.last_name}`;
        items.push({
          entityType: "article",
          entityId: `customer-${customer.id}`,
          title: `Customer Spotlight: ${fullName}`,
          description: `Highlight the work done for ${fullName}${customer.city ? ` in ${customer.city}` : ""}`,
        });
      }

      if (items.length === 0) {
        items.push(
          {
            entityType: "product",
            entityId: "tradeworkdesk-platform",
            title: "TradeWorkDesk Platform",
            description: "Manage jobs, create certificates, and track service records digitally",
          },
          {
            entityType: "article",
            entityId: "boiler-service-tips",
            title: "Essential Boiler Maintenance Tips",
            description: "Key maintenance tips to keep boilers running efficiently",
          },
        );
      }

      const platforms = (req.query.platforms as string)?.split(",") || ["x", "facebook", "instagram"];
      const suggestions = await generatePostSuggestions(items, platforms);

      // Attach a recent gallery photo to each suggestion
      const { data: photoRows } = await supabaseAdmin
        .from("file_attachments")
        .select("storage_path")
        .eq("tenant_id", tenantId)
        .like("file_type", "image/%")
        .order("created_at", { ascending: false })
        .limit(10);

      const photoUrls = (photoRows ?? []).flatMap((p) => {
        const { data } = supabaseAdmin.storage
          .from("service-photos")
          .getPublicUrl((p as { storage_path: string }).storage_path);
        return data.publicUrl ? [data.publicUrl] : [];
      });

      res.json(
        suggestions.map((s) =>
          photoUrls.length > 0
            ? { ...s, imageUrl: photoUrls[Math.floor(Math.random() * photoUrls.length)] }
            : s,
        ),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[social] Suggestions error:", message);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  },
);

router.post(
  "/admin/social/generate-image",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    try {
      const url = await generateSocialImage(prompt);
      res.json({ url });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[social] Image generation error:", message);
      res.status(500).json({ error: "Failed to generate image" });
    }
  },
);

router.patch(
  "/admin/social/posts/:id/dismiss",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;
    const tenantId = await resolveTenantId(req);

    let query = supabaseAdmin
      .from("social_posts")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json(data);
  },
);

export default router;
