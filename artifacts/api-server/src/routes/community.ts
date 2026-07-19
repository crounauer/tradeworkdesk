import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { supabaseAdmin } from "../lib/supabase";
import { sendPushToUser } from "../lib/push-notifications";

const router: IRouter = Router();

type Role = "admin" | "office_staff" | "technician" | "super_admin";

function canManage(role: string | undefined): role is Role {
  return role === "admin" || role === "office_staff" || role === "super_admin";
}

function canComment(role: string | undefined): role is Role {
  return role === "admin" || role === "office_staff" || role === "technician" || role === "super_admin";
}

router.get("/community/categories", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("community_categories")
    .select("*")
    .eq("tenant_id", req.tenantId!)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data || []);
});

router.post("/community/categories", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!canManage(req.userRole)) {
    res.status(403).json({ error: "Only admins and office staff can manage categories" });
    return;
  }

  const { name, description = null, sort_order = 0 } = req.body as {
    name?: unknown;
    description?: unknown;
    sort_order?: unknown;
  };

  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("community_categories")
    .insert({
      tenant_id: req.tenantId,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() || null : null,
      sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
      created_by: req.userId,
    })
    .select()
    .single();

  if (error || !data) {
    res.status(500).json({ error: error?.message || "Failed to create category" });
    return;
  }

  res.status(201).json(data);
});

router.get("/community/threads", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const categoryId = typeof req.query.category_id === "string" ? req.query.category_id : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : "open";

  let q = supabaseAdmin
    .from("community_threads")
    .select("*")
    .eq("tenant_id", req.tenantId!)
    .order("updated_at", { ascending: false });

  if (categoryId) q = q.eq("category_id", categoryId);
  if (status === "open") {
    q = q.eq("is_locked", false);
  }

  const { data, error } = await q;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data || []);
});

router.post("/community/threads", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!canManage(req.userRole)) {
    res.status(403).json({ error: "Only admins and office staff can create threads" });
    return;
  }

  const { category_id, title, body } = req.body as { category_id?: unknown; title?: unknown; body?: unknown };

  if (typeof category_id !== "string" || !category_id) {
    res.status(400).json({ error: "category_id is required" });
    return;
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const { data: category } = await supabaseAdmin
    .from("community_categories")
    .select("id")
    .eq("id", category_id)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const { data: thread, error: threadErr } = await supabaseAdmin
    .from("community_threads")
    .insert({
      tenant_id: req.tenantId,
      category_id,
      title: title.trim(),
      created_by: req.userId,
      is_pinned: false,
      is_locked: false,
      last_activity_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (threadErr || !thread) {
    res.status(500).json({ error: threadErr?.message || "Failed to create thread" });
    return;
  }

  const { data: post, error: postErr } = await supabaseAdmin
    .from("community_posts")
    .insert({
      tenant_id: req.tenantId,
      thread_id: (thread as { id: string }).id,
      author_id: req.userId,
      body: body.trim(),
      is_deleted: false,
    })
    .select()
    .single();

  if (postErr || !post) {
    res.status(500).json({ error: postErr?.message || "Thread created but failed to create opening post" });
    return;
  }

  res.status(201).json({ thread, opening_post: post });
});

router.get("/community/threads/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const threadId = String(req.params.id || "");
  if (!threadId) {
    res.status(400).json({ error: "Missing thread id" });
    return;
  }

  const { data: thread, error: threadErr } = await supabaseAdmin
    .from("community_threads")
    .select("*")
    .eq("id", threadId)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (threadErr) {
    res.status(500).json({ error: threadErr.message });
    return;
  }
  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  const { data: posts, error: postsErr } = await supabaseAdmin
    .from("community_posts")
    .select("id, thread_id, tenant_id, author_id, body, is_deleted, created_at, updated_at")
    .eq("thread_id", threadId)
    .eq("tenant_id", req.tenantId!)
    .order("created_at", { ascending: true });

  if (postsErr) {
    res.status(500).json({ error: postsErr.message });
    return;
  }

  res.json({ thread, posts: posts || [] });
});

router.patch("/community/threads/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!canManage(req.userRole)) {
    res.status(403).json({ error: "Only admins and office staff can manage threads" });
    return;
  }

  const threadId = String(req.params.id || "");
  if (!threadId) {
    res.status(400).json({ error: "Missing thread id" });
    return;
  }

  const { is_pinned, is_locked, title } = req.body as { is_pinned?: unknown; is_locked?: unknown; title?: unknown };
  const updates: Record<string, unknown> = {};

  if (is_pinned !== undefined) {
    if (typeof is_pinned !== "boolean") {
      res.status(400).json({ error: "is_pinned must be boolean" });
      return;
    }
    updates.is_pinned = is_pinned;
  }

  if (is_locked !== undefined) {
    if (typeof is_locked !== "boolean") {
      res.status(400).json({ error: "is_locked must be boolean" });
      return;
    }
    updates.is_locked = is_locked;
  }

  if (title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "title must be a non-empty string" });
      return;
    }
    updates.title = title.trim();
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("community_threads")
    .update(updates)
    .eq("id", threadId)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  res.json(data);
});

router.post("/community/threads/:id/posts", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!canComment(req.userRole)) {
    res.status(403).json({ error: "Not authorized to comment" });
    return;
  }

  const threadId = String(req.params.id || "");
  const { body } = req.body as { body?: unknown };

  if (!threadId) {
    res.status(400).json({ error: "Missing thread id" });
    return;
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const { data: thread } = await supabaseAdmin
    .from("community_threads")
    .select("id, is_locked, title, created_by")
    .eq("id", threadId)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (!thread) {
    res.status(404).json({ error: "Thread not found" });
    return;
  }

  if ((thread as { is_locked: boolean }).is_locked) {
    res.status(400).json({ error: "Thread is locked" });
    return;
  }

  const { data: post, error } = await supabaseAdmin
    .from("community_posts")
    .insert({
      tenant_id: req.tenantId,
      thread_id: threadId,
      author_id: req.userId,
      body: body.trim(),
      is_deleted: false,
    })
    .select()
    .single();

  if (error || !post) {
    res.status(500).json({ error: error?.message || "Failed to add comment" });
    return;
  }

  await supabaseAdmin
    .from("community_threads")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", threadId)
    .eq("tenant_id", req.tenantId!);

  // Best-effort push notification to thread owner for new replies.
  const threadOwnerId = (thread as { created_by?: string | null }).created_by;
  if (threadOwnerId && threadOwnerId !== req.userId) {
    void sendPushToUser(req.tenantId!, threadOwnerId, {
      title: "New community reply",
      body: `New reply on: ${(thread as { title?: string }).title || "a thread"}`,
      url: `/community`,
      tag: `community-thread-${threadId}`,
      data: { threadId, postId: (post as { id: string }).id },
    }).catch((err) => {
      console.error("[community] Failed to send reply push notification:", err instanceof Error ? err.message : String(err));
    });
  }

  res.status(201).json(post);
});

router.patch("/community/posts/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const postId = String(req.params.id || "");
  const { body } = req.body as { body?: unknown };

  if (!postId) {
    res.status(400).json({ error: "Missing post id" });
    return;
  }
  if (typeof body !== "string" || body.trim().length === 0) {
    res.status(400).json({ error: "body is required" });
    return;
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("community_posts")
    .select("id, author_id")
    .eq("id", postId)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (existingErr) {
    res.status(500).json({ error: existingErr.message });
    return;
  }
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const isOwner = (existing as { author_id: string }).author_id === req.userId;
  if (!isOwner && !canManage(req.userRole)) {
    res.status(403).json({ error: "Not authorized to edit this post" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("community_posts")
    .update({ body: body.trim() })
    .eq("id", postId)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error || !data) {
    res.status(500).json({ error: error?.message || "Failed to update post" });
    return;
  }

  res.json(data);
});

router.delete("/community/posts/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const postId = String(req.params.id || "");
  if (!postId) {
    res.status(400).json({ error: "Missing post id" });
    return;
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from("community_posts")
    .select("id, author_id")
    .eq("id", postId)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (existingErr) {
    res.status(500).json({ error: existingErr.message });
    return;
  }
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const isOwner = (existing as { author_id: string }).author_id === req.userId;
  if (!isOwner && !canManage(req.userRole)) {
    res.status(403).json({ error: "Not authorized to delete this post" });
    return;
  }

  const { error } = await supabaseAdmin
    .from("community_posts")
    .update({ is_deleted: true, body: "[deleted]" })
    .eq("id", postId)
    .eq("tenant_id", req.tenantId!);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.sendStatus(204);
});

router.post("/community/posts/:id/report", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const postId = String(req.params.id || "");
  const { reason = "inappropriate" } = req.body as { reason?: unknown };

  if (!postId) {
    res.status(400).json({ error: "Missing post id" });
    return;
  }

  const { data: post } = await supabaseAdmin
    .from("community_posts")
    .select("id")
    .eq("id", postId)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("community_post_reports")
    .insert({
      tenant_id: req.tenantId,
      post_id: postId,
      reported_by: req.userId,
      reason: typeof reason === "string" ? reason.trim() || "inappropriate" : "inappropriate",
      status: "open",
    })
    .select()
    .single();

  if (error || !data) {
    res.status(500).json({ error: error?.message || "Failed to report post" });
    return;
  }

  res.status(201).json(data);
});

router.get("/community/reports", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!canManage(req.userRole)) {
    res.status(403).json({ error: "Only admins and office staff can view moderation reports" });
    return;
  }

  const status = typeof req.query.status === "string" ? req.query.status : "open";

  let q = supabaseAdmin
    .from("community_post_reports")
    .select("id, tenant_id, post_id, reported_by, reason, status, created_at, updated_at")
    .eq("tenant_id", req.tenantId!)
    .order("created_at", { ascending: false });

  if (status !== "all") q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = (data || []) as Array<{ id: string; post_id: string }>;
  const postIds = [...new Set(rows.map((r) => r.post_id).filter(Boolean))];

  let postMap = new Map<string, { id: string; body: string; thread_id: string; author_id: string }>();
  if (postIds.length > 0) {
    const { data: posts } = await supabaseAdmin
      .from("community_posts")
      .select("id, body, thread_id, author_id")
      .in("id", postIds)
      .eq("tenant_id", req.tenantId!);
    for (const post of (posts || []) as Array<{ id: string; body: string; thread_id: string; author_id: string }>) {
      postMap.set(post.id, post);
    }
  }

  res.json((data || []).map((r) => {
    const post = postMap.get((r as { post_id: string }).post_id);
    return {
      ...r,
      post,
    };
  }));
});

router.patch("/community/reports/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!canManage(req.userRole)) {
    res.status(403).json({ error: "Only admins and office staff can update moderation reports" });
    return;
  }

  const reportId = String(req.params.id || "");
  const { status } = req.body as { status?: unknown };

  if (!reportId) {
    res.status(400).json({ error: "Missing report id" });
    return;
  }

  const allowed = new Set(["open", "reviewed", "dismissed", "actioned"]);
  if (typeof status !== "string" || !allowed.has(status)) {
    res.status(400).json({ error: "Invalid report status" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("community_post_reports")
    .update({ status })
    .eq("id", reportId)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json(data);
});

export default router;
