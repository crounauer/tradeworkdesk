import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, requireRole, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { supabaseAdmin } from "../lib/supabase";
import { encryptCredentials } from "../lib/social-crypto";
import { dispatchPost } from "../lib/social-platforms";
import { generatePostSuggestions, generateSocialImage, type SuggestionItem } from "../lib/social-ai";

const SUPPORTED_PLATFORMS = ["x", "facebook", "instagram"] as const;
type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

function isSupportedPlatform(p: string): p is SupportedPlatform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(p);
}

function resolveTenantId(req: AuthenticatedRequest): string | undefined {
  if (req.userRole === "super_admin") {
    const qp = (req.query.tenant_id as string) || (req.body?.tenant_id as string);
    return qp || undefined;
  }
  return req.tenantId;
}

const router: IRouter = Router();

router.get(
  "/admin/social/accounts",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  requirePlanFeature("social_media"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const tenantId = resolveTenantId(req);

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
    const { platform, credentials, profileName, pageId, pageName, instagramBusinessId } = req.body;
    const tenantId = resolveTenantId(req);

    if (!tenantId) {
      res.status(400).json({ error: "tenant_id is required for super_admin requests" });
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
    const { id } = req.params;
    const { isActive, autoPost } = req.body;
    const tenantId = resolveTenantId(req);

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
    const { id } = req.params;
    const tenantId = resolveTenantId(req);

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
    const { status, platform, page = "1", limit = "20" } = req.query as Record<string, string>;
    const tenantId = resolveTenantId(req);
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
    const { platform, content, imageUrl, videoUrl, linkUrl, scheduledFor } = req.body;
    const tenantId = resolveTenantId(req);

    if (!tenantId) {
      res.status(400).json({ error: "tenant_id is required for super_admin requests" });
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

    const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
    const isScheduled = scheduledDate && scheduledDate > new Date();

    const { data: post, error: insertError } = await supabaseAdmin
      .from("social_posts")
      .insert({
        tenant_id: tenantId,
        platform,
        content,
        image_url: imageUrl || null,
        video_url: videoUrl || null,
        link_url: linkUrl || null,
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
    const { posts, intervalMinutes = 60 } = req.body;
    const tenantId = resolveTenantId(req);

    if (!tenantId) {
      res.status(400).json({ error: "tenant_id is required for super_admin requests" });
      return;
    }

    if (!Array.isArray(posts) || posts.length === 0) {
      res.status(400).json({ error: "posts array is required" });
      return;
    }

    const now = new Date();
    const rows = posts.map((p: Record<string, unknown>, i: number) => ({
      tenant_id: tenantId,
      platform: p.platform,
      content: p.content,
      image_url: p.imageUrl || null,
      video_url: p.videoUrl || null,
      link_url: p.linkUrl || null,
      scheduled_for: new Date(now.getTime() + i * (intervalMinutes as number) * 60 * 1000).toISOString(),
      status: "scheduled",
      entity_type: p.entityType || null,
      entity_id: p.entityId || null,
    }));

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
      const tenantId = resolveTenantId(req);
      if (!tenantId) {
        res.status(400).json({ error: "tenant_id is required for super_admin requests" });
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
            entityId: "boilertech-platform",
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
      res.json(suggestions);
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
    const tenantId = resolveTenantId(req);

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
