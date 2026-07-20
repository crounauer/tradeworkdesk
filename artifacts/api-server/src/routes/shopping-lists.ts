import { Router, type IRouter } from "express";
import { requireAuth, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { supabaseAdmin } from "../lib/supabase";

type UserRole = "admin" | "office_staff" | "technician" | "super_admin";
type AssignmentMode = "unassigned" | "specific_technician" | "all_technicians";

interface ShoppingListRow {
  id: string;
  tenant_id: string;
  title: string;
  status: "draft" | "active" | "partially_purchased" | "complete" | "archived";
  assignment_mode?: AssignmentMode;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

interface ShoppingListItemRow {
  id: string;
  shopping_list_id: string;
  tenant_id: string;
  item_name: string;
  quantity: string | number;
  unit_estimate: string | number | null;
  status: "needed" | "ordered" | "purchased" | "unavailable";
  source_type: "invoice_line_item" | "job_part" | "manual";
  source_id: string | null;
  source_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const router: IRouter = Router();

function isManager(role: string | undefined): role is UserRole {
  return role === "admin" || role === "office_staff" || role === "super_admin";
}

function canUpdateItem(role: string | undefined): role is UserRole {
  return role === "admin" || role === "office_staff" || role === "technician" || role === "super_admin";
}

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function canTechnicianCreateOwnLists(tenantId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role, can_create_own_shopping_lists")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    if (typeof error.message === "string" && error.message.includes("can_create_own_shopping_lists")) {
      return false;
    }
    return false;
  }

  const row = data as { role?: string; can_create_own_shopping_lists?: boolean | null } | null;
  return row?.role === "technician" && row?.can_create_own_shopping_lists === true;
}

async function ensureTechnicianBelongsToTenant(tenantId: string, technicianId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", technicianId)
    .eq("tenant_id", tenantId)
    .eq("role", "technician")
    .maybeSingle();
  return !!data;
}

function getEffectiveAssignmentMode(list: ShoppingListRow): AssignmentMode {
  if (list.assignment_mode === "specific_technician" || list.assignment_mode === "all_technicians" || list.assignment_mode === "unassigned") {
    return list.assignment_mode;
  }
  return list.assigned_to ? "specific_technician" : "unassigned";
}

function canTechnicianAccessList(list: ShoppingListRow, userId: string): boolean {
  const mode = getEffectiveAssignmentMode(list);
  if (mode === "unassigned" || mode === "all_technicians") return true;
  return list.assigned_to === userId;
}

async function resolveAssignmentInput(opts: {
  tenantId: string;
  userRole?: string;
  userId?: string;
  assignment_mode?: unknown;
  assigned_to?: unknown;
}): Promise<{ assignment_mode: AssignmentMode; assigned_to: string | null; error?: string }> {
  const { tenantId, userRole, userId, assignment_mode, assigned_to } = opts;

  if (userRole === "technician") {
    return {
      assignment_mode: "specific_technician",
      assigned_to: userId || null,
      error: userId ? undefined : "Missing user id",
    };
  }

  const rawMode = typeof assignment_mode === "string" ? assignment_mode : undefined;
  const candidateAssigned = typeof assigned_to === "string" ? assigned_to : null;
  const mode: AssignmentMode = rawMode === "specific_technician" || rawMode === "all_technicians" || rawMode === "unassigned"
    ? rawMode
    : candidateAssigned
    ? "specific_technician"
    : "unassigned";

  if (mode === "specific_technician") {
    if (!candidateAssigned) {
      return { assignment_mode: mode, assigned_to: null, error: "assigned_to is required when assignment_mode is specific_technician" };
    }
    const ok = await ensureTechnicianBelongsToTenant(tenantId, candidateAssigned);
    if (!ok) {
      return { assignment_mode: mode, assigned_to: null, error: "assigned_to must reference a technician in this tenant" };
    }
    return { assignment_mode: mode, assigned_to: candidateAssigned };
  }

  return { assignment_mode: mode, assigned_to: null };
}

async function ensureListBelongsToTenant(listId: string, tenantId: string): Promise<ShoppingListRow | null> {
  const { data } = await supabaseAdmin
    .from("shopping_lists")
    .select("*")
    .eq("id", listId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as ShoppingListRow | null) || null;
}

router.get("/shopping-lists", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const status = typeof req.query.status === "string" ? req.query.status : "open";

  let q = supabaseAdmin
    .from("shopping_lists")
    .select("*")
    .eq("tenant_id", req.tenantId!)
    .order("updated_at", { ascending: false });

  if (status === "open") {
    q = q.in("status", ["draft", "active", "partially_purchased"]);
  } else if (status !== "all") {
    q = q.eq("status", status);
  }

  const { data, error } = await q;
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const rows = (data as ShoppingListRow[]) || [];
  if (req.userRole === "technician") {
    res.json(rows.filter((list) => canTechnicianAccessList(list, req.userId!)));
    return;
  }

  res.json(rows);
});

router.get("/shopping-lists/me/permissions", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const canCreateOwn = req.userRole === "technician"
    ? await canTechnicianCreateOwnLists(req.tenantId!, req.userId!)
    : false;

  res.json({
    can_create_own_shopping_lists: canCreateOwn,
  });
});

router.get("/shopping-lists/technicians", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const isAllowed = isManager(req.userRole) || (req.userRole === "technician" && await canTechnicianCreateOwnLists(req.tenantId!, req.userId!));
  if (!isAllowed) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .eq("tenant_id", req.tenantId!)
    .eq("role", "technician")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json(data || []);
});

router.post("/shopping-lists", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const isApprovedTechnician = req.userRole === "technician"
    ? await canTechnicianCreateOwnLists(req.tenantId!, req.userId!)
    : false;
  if (!isManager(req.userRole) && !isApprovedTechnician) {
    res.status(403).json({ error: "Not authorized to create shopping lists" });
    return;
  }

  const { title, assigned_to, assignment_mode } = req.body as { title?: unknown; assigned_to?: unknown; assignment_mode?: unknown };
  const safeTitle = typeof title === "string" && title.trim().length > 0
    ? title.trim()
    : `Shopping List ${new Date().toISOString().slice(0, 10)}`;

  const resolvedAssignment = await resolveAssignmentInput({
    tenantId: req.tenantId!,
    userRole: req.userRole,
    userId: req.userId,
    assignment_mode,
    assigned_to,
  });
  if (resolvedAssignment.error) {
    res.status(400).json({ error: resolvedAssignment.error });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("shopping_lists")
    .insert({
      tenant_id: req.tenantId,
      title: safeTitle,
      status: "active",
      created_by: req.userId,
      assignment_mode: resolvedAssignment.assignment_mode,
      assigned_to: resolvedAssignment.assigned_to,
    })
    .select()
    .single();

  if (error || !data) {
    res.status(500).json({ error: error?.message || "Failed to create shopping list" });
    return;
  }

  res.status(201).json(data as ShoppingListRow);
});

router.post("/shopping-lists/generate", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const isApprovedTechnician = req.userRole === "technician"
    ? await canTechnicianCreateOwnLists(req.tenantId!, req.userId!)
    : false;
  if (!isManager(req.userRole) && !isApprovedTechnician) {
    res.status(403).json({ error: "Not authorized to generate shopping lists" });
    return;
  }

  const {
    include_to_order_parts = true,
    title,
    assignment_mode,
    assigned_to,
  } = req.body as {
    include_to_order_parts?: unknown;
    title?: unknown;
    assignment_mode?: unknown;
    assigned_to?: unknown;
  };

  if (include_to_order_parts === false) {
    res.status(400).json({ error: "Job parts source must be enabled" });
    return;
  }

  const resolvedAssignment = await resolveAssignmentInput({
    tenantId: req.tenantId!,
    userRole: req.userRole,
    userId: req.userId,
    assignment_mode,
    assigned_to,
  });
  if (resolvedAssignment.error) {
    res.status(400).json({ error: resolvedAssignment.error });
    return;
  }

  const today = new Date();
  const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

  let toOrderParts: Array<Record<string, unknown>> = [];
  if (include_to_order_parts !== false) {
    const { data, error } = await supabaseAdmin
      .from("job_parts")
      .select("id, job_id, part_name, quantity, unit_price")
      .eq("tenant_id", req.tenantId!)
      .eq("status", "to_order");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const jobParts = data || [];
    const { data: alreadySentItems, error: alreadySentError } = await supabaseAdmin
      .from("shopping_list_items")
      .select("source_id")
      .eq("tenant_id", req.tenantId!)
      .eq("source_type", "job_part")
      .not("source_id", "is", null);

    if (alreadySentError) {
      res.status(500).json({ error: alreadySentError.message });
      return;
    }

    const alreadySentJobPartIds = new Set(
      (alreadySentItems || [])
        .map((item) => String((item as { source_id?: string | null }).source_id || ""))
        .filter(Boolean),
    );

    toOrderParts = jobParts.filter((part) => !alreadySentJobPartIds.has(String(part.id)));
  }

  if (toOrderParts.length === 0) {
    res.status(400).json({ error: "No new job parts found to generate a shopping list" });
    return;
  }

  const merged = new Map<string, {
    item_name: string;
    quantity: number;
    unit_estimate: number | null;
    source_type: "job_part";
    source_id: string;
    source_ref: string;
  }>();

  for (const row of toOrderParts) {
    const itemName = String(row.part_name || "").trim();
    if (!itemName) continue;
    const key = itemName.toLowerCase();
    const existing = merged.get(key);
    const qty = toNum(row.quantity, 1);
    const unitEstimate = row.unit_price == null ? null : toNum(row.unit_price, 0);

    if (existing) {
      existing.quantity += qty;
      if (existing.unit_estimate == null && unitEstimate != null) {
        existing.unit_estimate = unitEstimate;
      }
    } else {
      merged.set(key, {
        item_name: itemName,
        quantity: qty,
        unit_estimate: unitEstimate,
        source_type: "job_part",
        source_id: String(row.id),
        source_ref: `job:${String(row.job_id)}`,
      });
    }
  }

  const generatedTitleRange = toIsoDate(today);
  const safeTitle = typeof title === "string" && title.trim().length > 0
    ? title.trim()
    : `Generated List ${generatedTitleRange}`;

  const { data: listData, error: listError } = await supabaseAdmin
    .from("shopping_lists")
    .insert({
      tenant_id: req.tenantId,
      title: safeTitle,
      status: "active",
      created_by: req.userId,
      assignment_mode: resolvedAssignment.assignment_mode,
      assigned_to: resolvedAssignment.assigned_to,
    })
    .select()
    .single();

  if (listError || !listData) {
    res.status(500).json({ error: listError?.message || "Failed to create generated shopping list" });
    return;
  }

  const itemRows = Array.from(merged.values()).map((item) => ({
    shopping_list_id: (listData as ShoppingListRow).id,
    tenant_id: req.tenantId,
    item_name: item.item_name,
    quantity: Math.round(item.quantity * 1000) / 1000,
    unit_estimate: item.unit_estimate,
    status: "needed",
    source_type: item.source_type,
    source_id: item.source_id,
    source_ref: item.source_ref,
  }));

  if (itemRows.length > 0) {
    const { error: itemsError } = await supabaseAdmin.from("shopping_list_items").insert(itemRows);
    if (itemsError) {
      res.status(500).json({ error: itemsError.message });
      return;
    }
  }

  res.status(201).json({
    list: listData,
    item_count: itemRows.length,
  });
});

router.get("/shopping-lists/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const listId = String(req.params.id || "");
  if (!listId) {
    res.status(400).json({ error: "Missing list id" });
    return;
  }

  const list = await ensureListBelongsToTenant(listId, req.tenantId!);
  if (!list) {
    res.status(404).json({ error: "Shopping list not found" });
    return;
  }

  if (req.userRole === "technician" && !canTechnicianAccessList(list, req.userId!)) {
    res.status(403).json({ error: "Not authorized to view this shopping list" });
    return;
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("shopping_list_items")
    .select("*")
    .eq("shopping_list_id", listId)
    .eq("tenant_id", req.tenantId!)
    .order("created_at", { ascending: true });

  if (itemsError) {
    res.status(500).json({ error: itemsError.message });
    return;
  }

  res.json({
    ...list,
    items: (items as ShoppingListItemRow[]) || [],
  });
});

router.patch("/shopping-lists/:id", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const listId = String(req.params.id || "");
  if (!listId) {
    res.status(400).json({ error: "Missing list id" });
    return;
  }

  if (!isManager(req.userRole)) {
    res.status(403).json({ error: "Only admins and office staff can update shopping lists" });
    return;
  }

  const list = await ensureListBelongsToTenant(listId, req.tenantId!);
  if (!list) {
    res.status(404).json({ error: "Shopping list not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  const body = req.body as { title?: unknown; status?: unknown; assigned_to?: unknown; assignment_mode?: unknown };

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim().length === 0) {
      res.status(400).json({ error: "title must be a non-empty string" });
      return;
    }
    updates.title = body.title.trim();
  }

  if (body.status !== undefined) {
    const allowedStatuses = new Set(["draft", "active", "partially_purchased", "complete", "archived"]);
    if (typeof body.status !== "string" || !allowedStatuses.has(body.status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    updates.status = body.status;
  }

  if (body.assigned_to !== undefined || body.assignment_mode !== undefined) {
    if (body.assigned_to !== undefined && body.assigned_to !== null && typeof body.assigned_to !== "string") {
      res.status(400).json({ error: "assigned_to must be a string or null" });
      return;
    }

    const currentMode = getEffectiveAssignmentMode(list);
    const resolvedAssignment = await resolveAssignmentInput({
      tenantId: req.tenantId!,
      userRole: req.userRole,
      userId: req.userId,
      assignment_mode: body.assignment_mode !== undefined ? body.assignment_mode : currentMode,
      assigned_to: body.assigned_to !== undefined ? body.assigned_to : list.assigned_to,
    });
    if (resolvedAssignment.error) {
      res.status(400).json({ error: resolvedAssignment.error });
      return;
    }

    updates.assignment_mode = resolvedAssignment.assignment_mode;
    updates.assigned_to = resolvedAssignment.assigned_to;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("shopping_lists")
    .update(updates)
    .eq("id", listId)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Shopping list not found" });
    return;
  }

  res.json(data as ShoppingListRow);
});

router.post("/shopping-lists/:id/items", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const listId = String(req.params.id || "");
  if (!listId) {
    res.status(400).json({ error: "Missing list id" });
    return;
  }

  const list = await ensureListBelongsToTenant(listId, req.tenantId!);
  if (!list) {
    res.status(404).json({ error: "Shopping list not found" });
    return;
  }

  if (!isManager(req.userRole)) {
    const isApprovedTechnician = req.userRole === "technician"
      ? await canTechnicianCreateOwnLists(req.tenantId!, req.userId!)
      : false;
    if (!isApprovedTechnician || !canTechnicianAccessList(list, req.userId!)) {
      res.status(403).json({ error: "Not authorized to add shopping list items" });
      return;
    }
  }

  const { item_name, quantity = 1, unit_estimate = null, notes = null } = req.body as {
    item_name?: unknown;
    quantity?: unknown;
    unit_estimate?: unknown;
    notes?: unknown;
  };

  if (typeof item_name !== "string" || item_name.trim().length === 0) {
    res.status(400).json({ error: "item_name is required" });
    return;
  }

  const qty = toNum(quantity, 1);
  if (qty <= 0) {
    res.status(400).json({ error: "quantity must be greater than zero" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("shopping_list_items")
    .insert({
      shopping_list_id: listId,
      tenant_id: req.tenantId,
      item_name: item_name.trim(),
      quantity: Math.round(qty * 1000) / 1000,
      unit_estimate: unit_estimate == null ? null : toNum(unit_estimate, 0),
      status: "needed",
      source_type: "manual",
      source_id: null,
      source_ref: null,
      notes: typeof notes === "string" ? notes.trim() || null : null,
    })
    .select()
    .single();

  if (error || !data) {
    res.status(500).json({ error: error?.message || "Failed to add shopping list item" });
    return;
  }

  res.status(201).json(data as ShoppingListItemRow);
});

router.patch("/shopping-lists/:id/items/:itemId", requireAuth, requireTenant, async (req: AuthenticatedRequest, res): Promise<void> => {
  const listId = String(req.params.id || "");
  const itemId = String(req.params.itemId || "");
  if (!listId || !itemId) {
    res.status(400).json({ error: "Missing list or item id" });
    return;
  }

  if (!canUpdateItem(req.userRole)) {
    res.status(403).json({ error: "Not authorized to update shopping list items" });
    return;
  }

  if (req.userRole === "technician") {
    const list = await ensureListBelongsToTenant(listId, req.tenantId!);
    if (!list) {
      res.status(404).json({ error: "Shopping list not found" });
      return;
    }
    if (!canTechnicianAccessList(list, req.userId!)) {
      res.status(403).json({ error: "Not authorized to update items on this shopping list" });
      return;
    }

    const { data: settings } = await supabaseAdmin
      .from("company_settings")
      .select("technicians_can_update_shopping_list_items")
      .eq("tenant_id", req.tenantId!)
      .eq("singleton_id", "default")
      .maybeSingle();

    const allowed = (settings as { technicians_can_update_shopping_list_items?: boolean | null } | null)
      ?.technicians_can_update_shopping_list_items;
    if (allowed === false) {
      res.status(403).json({ error: "Technician updates are disabled for shopping lists" });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  const body = req.body as { quantity?: unknown; status?: unknown; notes?: unknown; unit_estimate?: unknown };

  if (body.quantity !== undefined) {
    const qty = toNum(body.quantity, -1);
    if (qty <= 0) {
      res.status(400).json({ error: "quantity must be greater than zero" });
      return;
    }
    updates.quantity = Math.round(qty * 1000) / 1000;
  }

  if (body.status !== undefined) {
    const allowed = new Set(["needed", "ordered", "purchased", "unavailable"]);
    if (typeof body.status !== "string" || !allowed.has(body.status)) {
      res.status(400).json({ error: "Invalid item status" });
      return;
    }
    updates.status = body.status;
  }

  if (body.unit_estimate !== undefined) {
    if (body.unit_estimate === null || body.unit_estimate === "") {
      updates.unit_estimate = null;
    } else {
      updates.unit_estimate = toNum(body.unit_estimate, 0);
    }
  }

  if (body.notes !== undefined) {
    if (body.notes !== null && typeof body.notes !== "string") {
      res.status(400).json({ error: "notes must be a string or null" });
      return;
    }
    updates.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("shopping_list_items")
    .update(updates)
    .eq("id", itemId)
    .eq("shopping_list_id", listId)
    .eq("tenant_id", req.tenantId!)
    .select()
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Shopping list item not found" });
    return;
  }

  res.json(data as ShoppingListItemRow);
});

export default router;
