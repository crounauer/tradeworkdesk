import webpush from "web-push";
import { supabaseAdmin } from "./supabase";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

type DbSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;

  const subject = process.env.WEB_PUSH_VAPID_SUBJECT;
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "Web push is not configured: WEB_PUSH_VAPID_SUBJECT, WEB_PUSH_VAPID_PUBLIC_KEY, WEB_PUSH_VAPID_PRIVATE_KEY are required"
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export function getWebPushPublicKey(): string {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("WEB_PUSH_VAPID_PUBLIC_KEY is not set");
  }
  return publicKey;
}

export async function deactivateSubscriptionById(subscriptionId: string): Promise<void> {
  await supabaseAdmin
    .from("web_push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() } as Record<string, unknown>)
    .eq("id", subscriptionId);
}

export async function sendPushToTenant(tenantId: string, payload: PushPayload): Promise<void> {
  ensureVapidConfigured();

  const { data, error } = await supabaseAdmin
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (error) {
    console.error("[push] Failed to load subscriptions:", error.message);
    return;
  }

  const subscriptions = (data ?? []) as DbSubscription[];
  if (subscriptions.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    data: payload.data ?? {},
    ts: Date.now(),
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          message,
          {
            TTL: 60,
            urgency: "high",
          }
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await deactivateSubscriptionById(sub.id);
          return;
        }
        console.error("[push] Failed to send notification:", (err as Error).message);
      }
    })
  );
}

export async function sendPushToUser(tenantId: string, userId: string, payload: PushPayload): Promise<void> {
  ensureVapidConfigured();

  const { data, error } = await supabaseAdmin
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    console.error("[push] Failed to load user subscriptions:", error.message);
    return;
  }

  const subscriptions = (data ?? []) as DbSubscription[];
  if (subscriptions.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    data: payload.data ?? {},
    ts: Date.now(),
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          message,
          {
            TTL: 60,
            urgency: "high",
          }
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await deactivateSubscriptionById(sub.id);
          return;
        }
        console.error("[push] Failed to send user notification:", (err as Error).message);
      }
    })
  );
}
