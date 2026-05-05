import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";

interface TodoRow {
  id: string;
  user_id: string;
  tenant_id: string;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

const router: IRouter = Router();

// GET /todos — fetch the calling user's todos, newest first
router.get("/todos", requireAuth, requireTenant, requirePlanFeature("todo_list"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from("user_todos")
    .select("*")
    .eq("user_id", req.userId!)
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data as TodoRow[] || []);
});

// POST /todos — create a new todo
router.post("/todos", requireAuth, requireTenant, requirePlanFeature("todo_list"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { title } = req.body as { title?: unknown };

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "title is required" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("user_todos")
    .insert({
      user_id: req.userId!,
      tenant_id: req.tenantId!,
      title: title.trim(),
      completed: false,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(201).json(data as TodoRow);
});

// PATCH /todos/:id — update title and/or completed; user must own the item
router.patch("/todos/:id", requireAuth, requireTenant, requirePlanFeature("todo_list"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  if (!id) { res.status(400).json({ error: "Missing todo id" }); return; }

  const updates: Record<string, unknown> = {};
  const body = req.body as { title?: unknown; completed?: unknown };

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      res.status(400).json({ error: "title must be a non-empty string" }); return;
    }
    updates.title = body.title.trim();
  }

  if (body.completed !== undefined) {
    if (typeof body.completed !== "boolean") {
      res.status(400).json({ error: "completed must be a boolean" }); return;
    }
    updates.completed = body.completed;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" }); return;
  }

  // Ownership check — only update if the row belongs to this user
  let q = supabaseAdmin
    .from("user_todos")
    .update(updates)
    .eq("id", id)
    .eq("user_id", req.userId!);

  const { data, error } = await q.select().single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: "Todo not found" }); return; }
  res.json(data as TodoRow);
});

// DELETE /todos/:id — delete; user must own the item
router.delete("/todos/:id", requireAuth, requireTenant, requirePlanFeature("todo_list"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  if (!id) { res.status(400).json({ error: "Missing todo id" }); return; }

  const { error } = await supabaseAdmin
    .from("user_todos")
    .delete()
    .eq("id", id)
    .eq("user_id", req.userId!);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.sendStatus(204);
});

export default router;
