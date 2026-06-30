import { Router, type IRouter } from "express";
import { requireAuth, requireRole, requireTenant, type AuthenticatedRequest } from "../middlewares/auth";
import { getWebPushPublicKey, sendPushToUser } from "../lib/push-notifications";
import {
  getPushEventMeta,
  listTenantUsersWithPushPreferences,
  upsertTenantUserPushPreferences,
  type PushEventType,
} from "../lib/push-events";
import { supabaseAdmin } from "../lib/supabase";

type IncomingPushSubscription = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

const router: IRouter = Router();

router.get(
  "/push/preferences/meta",
  requireAuth,
  requireTenant,
  async (_req: AuthenticatedRequest, res): Promise<void> => {
    res.json({ events: getPushEventMeta() });
  }
);

router.get(
  "/push/preferences/users",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const users = await listTenantUsersWithPushPreferences(req.tenantId!);
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

router.patch(
  "/push/preferences/users/:userId",
  requireAuth,
  requireTenant,
  requireRole("admin"),
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const userId = String(req.params.userId || "").trim();
    if (!userId) {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const { data: targetUser, error: targetErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .eq("tenant_id", req.tenantId!)
      .maybeSingle();

    if (targetErr) {
      res.status(500).json({ error: targetErr.message });
      return;
    }
    if (!targetUser) {
      res.status(404).json({ error: "User not found in this tenant" });
      return;
    }

    const body = (req.body || {}) as Partial<Record<PushEventType, boolean>>;
    const updates: Partial<Record<PushEventType, boolean>> = {};

    for (const key of [
      "appointment_due",
      "appointment_overdue",
      "assignment_changes",
      "blocking_status_changes",
      "customer_communications",
      "payment_alerts",
      "sla_breach_risk",
      "maintenance_lifecycle",
      "operational_exceptions",
      "system_reliability",
    ] as PushEventType[]) {
      if (body[key] !== undefined) {
        updates[key] = !!body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid preference fields provided" });
      return;
    }

    try {
      const preferences = await upsertTenantUserPushPreferences(req.tenantId!, userId, updates);
      res.json({ userId, preferences });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

router.get(
  "/push/vapid-public-key",
  requireAuth,
  async (_req: AuthenticatedRequest, res): Promise<void> => {
    try {
      const publicKey = getWebPushPublicKey();
      res.json({ publicKey });
    } catch (err) {
      res.status(503).json({ error: (err as Error).message });
    }
  }
);

router.post(
  "/push/subscriptions",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const body = req.body as { subscription?: IncomingPushSubscription };
    const subscription = body?.subscription;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      res.status(400).json({ error: "subscription.endpoint, subscription.keys.p256dh and subscription.keys.auth are required" });
      return;
    }

    const userAgent = String(req.headers["user-agent"] || "").slice(0, 512) || null;

    const { error } = await supabaseAdmin.from("web_push_subscriptions").upsert(
      {
        tenant_id: req.tenantId,
        user_id: req.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ ok: true });
  }
);

router.delete(
  "/push/subscriptions",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    const endpoint = String((req.body as { endpoint?: string })?.endpoint || "").trim();
    if (!endpoint) {
      res.status(400).json({ error: "endpoint is required" });
      return;
    }

    const { error } = await supabaseAdmin
      .from("web_push_subscriptions")
      .update({ is_active: false, updated_at: new Date().toISOString() } as Record<string, unknown>)
      .eq("endpoint", endpoint)
      .eq("tenant_id", req.tenantId!)
      .eq("user_id", req.userId!);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ ok: true });
  }
);

router.post(
  "/push/test",
  requireAuth,
  requireTenant,
  async (req: AuthenticatedRequest, res): Promise<void> => {
    await sendPushToUser(req.tenantId!, req.userId!, {
      title: "TradeWorkDesk",
      body: "This is a test push notification from your company settings page.",
      url: "/admin/company-settings?tab=notifications",
      tag: `push-test-${req.tenantId}`,
      data: {
        type: "push_test",
        tenantId: req.tenantId,
      },
    });

    res.json({ ok: true });
  }
);

export default router;
