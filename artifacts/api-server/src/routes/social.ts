import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { db } from "@workspace/db";
import { socialAccounts, socialPosts, jobs, customers } from "@workspace/db";
import { eq, and, desc, lte, sql } from "drizzle-orm";
import { encryptCredentials } from "../lib/social-crypto";
import { dispatchPost } from "../lib/social-platforms";
import { generatePostSuggestions, generateSocialImage, type SuggestionItem } from "../lib/social-ai";

const SUPPORTED_PLATFORMS = ["x", "facebook", "instagram"] as const;
type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

function isSupportedPlatform(p: string): p is SupportedPlatform {
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(p);
}

const router: IRouter = Router();

router.get(
  "/admin/social/accounts",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const accounts = await db
      .select({
        id: socialAccounts.id,
        platform: socialAccounts.platform,
        page_id: socialAccounts.page_id,
        page_name: socialAccounts.page_name,
        instagram_business_id: socialAccounts.instagram_business_id,
        profile_name: socialAccounts.profile_name,
        expires_at: socialAccounts.expires_at,
        is_active: socialAccounts.is_active,
        auto_post: socialAccounts.auto_post,
        created_at: socialAccounts.created_at,
      })
      .from(socialAccounts)
      .where(eq(socialAccounts.tenant_id, req.tenantId!))
      .orderBy(desc(socialAccounts.created_at));

    res.json(accounts);
  },
);

router.post(
  "/admin/social/accounts",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { platform, credentials, profileName, pageId, pageName, instagramBusinessId } = req.body;

    if (!platform || !credentials || !profileName) {
      res.status(400).json({ error: "platform, credentials, and profileName are required" });
      return;
    }

    if (!isSupportedPlatform(platform)) {
      res.status(400).json({ error: `Platform "${platform}" is not supported. Supported: ${SUPPORTED_PLATFORMS.join(", ")}` });
      return;
    }

    const encrypted = encryptCredentials(credentials);

    const [account] = await db
      .insert(socialAccounts)
      .values({
        tenant_id: req.tenantId!,
        platform,
        encrypted_credentials: encrypted,
        profile_name: profileName,
        page_id: pageId || null,
        page_name: pageName || null,
        instagram_business_id: instagramBusinessId || null,
      })
      .returning();

    res.json({
      id: account.id,
      platform: account.platform,
      profile_name: account.profile_name,
      page_id: account.page_id,
      page_name: account.page_name,
      instagram_business_id: account.instagram_business_id,
      is_active: account.is_active,
      auto_post: account.auto_post,
      created_at: account.created_at,
    });
  },
);

router.patch(
  "/admin/social/accounts/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;
    const { isActive, autoPost } = req.body;

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (isActive !== undefined) updates.is_active = isActive;
    if (autoPost !== undefined) updates.auto_post = autoPost;

    const [updated] = await db
      .update(socialAccounts)
      .set(updates)
      .where(and(eq(socialAccounts.id, id), eq(socialAccounts.tenant_id, req.tenantId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    res.json({
      id: updated.id,
      platform: updated.platform,
      profile_name: updated.profile_name,
      is_active: updated.is_active,
      auto_post: updated.auto_post,
    });
  },
);

router.delete(
  "/admin/social/accounts/:id",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;

    const [deleted] = await db
      .delete(socialAccounts)
      .where(and(eq(socialAccounts.id, id), eq(socialAccounts.tenant_id, req.tenantId!)))
      .returning();

    if (!deleted) {
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
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { status, platform, page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const conditions = [eq(socialPosts.tenant_id, req.tenantId!)];
    if (status) conditions.push(eq(socialPosts.status, status as "draft" | "scheduled" | "posted" | "failed" | "dismissed"));
    if (platform) conditions.push(eq(socialPosts.platform, platform as "x" | "facebook" | "instagram" | "pinterest" | "linkedin" | "tiktok" | "youtube"));

    const posts = await db
      .select()
      .from(socialPosts)
      .where(and(...conditions))
      .orderBy(desc(socialPosts.created_at))
      .limit(parseInt(limit, 10))
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(socialPosts)
      .where(and(...conditions));

    res.json({ posts, total: Number(count) });
  },
);

router.post(
  "/admin/social/post",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { platform, content, imageUrl, videoUrl, linkUrl, scheduledFor } = req.body;

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

    const [post] = await db
      .insert(socialPosts)
      .values({
        tenant_id: req.tenantId!,
        platform,
        content,
        image_url: imageUrl || null,
        video_url: videoUrl || null,
        link_url: linkUrl || null,
        scheduled_for: scheduledDate,
        status: isScheduled ? "scheduled" : "draft",
      })
      .returning();

    if (!isScheduled) {
      const [account] = await db
        .select()
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.tenant_id, req.tenantId!),
            eq(socialAccounts.platform, platform),
            eq(socialAccounts.is_active, true),
          ),
        )
        .limit(1);

      if (!account) {
        await db
          .update(socialPosts)
          .set({ status: "failed", error: `No active ${platform} account found`, updated_at: new Date() })
          .where(eq(socialPosts.id, post.id));
        res.status(400).json({ error: `No active ${platform} account connected` });
        return;
      }

      try {
        const result = await dispatchPost(post, account);
        const [updated] = await db
          .update(socialPosts)
          .set({
            status: "posted",
            post_id: result.postId || null,
            post_url: result.postUrl || null,
            updated_at: new Date(),
          })
          .where(eq(socialPosts.id, post.id))
          .returning();
        res.json(updated);
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(socialPosts)
          .set({ status: "failed", error: message, updated_at: new Date() })
          .where(eq(socialPosts.id, post.id));
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
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { posts, intervalMinutes = 60 } = req.body;

    if (!Array.isArray(posts) || posts.length === 0) {
      res.status(400).json({ error: "posts array is required" });
      return;
    }

    const now = new Date();
    const results = [];

    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const scheduledFor = new Date(now.getTime() + i * intervalMinutes * 60 * 1000);

      const [created] = await db
        .insert(socialPosts)
        .values({
          tenant_id: req.tenantId!,
          platform: p.platform,
          content: p.content,
          image_url: p.imageUrl || null,
          video_url: p.videoUrl || null,
          link_url: p.linkUrl || null,
          scheduled_for: scheduledFor,
          status: "scheduled",
          entity_type: p.entityType || null,
          entity_id: p.entityId || null,
        })
        .returning();

      results.push(created);
    }

    res.json({ scheduled: results.length, posts: results });
  },
);

router.get(
  "/admin/social/suggestions",
  requireAuth,
  requireTenant,
  requireRole("admin", "super_admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const tenantId = req.tenantId!;
      const items: SuggestionItem[] = [];

      const recentJobs = await db
        .select({
          id: jobs.id,
          job_type: jobs.job_type,
          description: jobs.description,
          status: jobs.status,
        })
        .from(jobs)
        .where(and(eq(jobs.is_active, true), sql`${jobs.id} IN (SELECT id FROM jobs WHERE tenant_id = ${tenantId})`))
        .orderBy(desc(jobs.created_at))
        .limit(5);

      for (const job of recentJobs) {
        items.push({
          entityType: "article",
          entityId: `job-${job.id}`,
          title: `${job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)} Job ${job.status === "completed" ? "Completed" : "Update"}`,
          description: job.description || `A ${job.job_type} job is ${job.status}`,
        });
      }

      const recentCustomers = await db
        .select({
          id: customers.id,
          first_name: customers.first_name,
          last_name: customers.last_name,
          city: customers.city,
        })
        .from(customers)
        .where(and(eq(customers.is_active, true), sql`${customers.id} IN (SELECT id FROM customers WHERE tenant_id = ${tenantId})`))
        .orderBy(desc(customers.created_at))
        .limit(3);

      for (const customer of recentCustomers) {
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
            title: "BoilerTech Platform",
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
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const { id } = req.params;

    const [updated] = await db
      .update(socialPosts)
      .set({ status: "dismissed", updated_at: new Date() })
      .where(and(eq(socialPosts.id, id), eq(socialPosts.tenant_id, req.tenantId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json(updated);
  },
);

export default router;
