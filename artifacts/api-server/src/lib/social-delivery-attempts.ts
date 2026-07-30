import crypto from "crypto";
import type { SocialAccount, SocialPost } from "./social-platforms";
import { supabaseAdmin } from "./supabase";

type TriggerSource = "manual" | "scheduler";

type AttemptScope = {
  isPlatformScope: boolean;
  tenantId?: string | null;
  createdByUserId?: string | null;
};

type AttemptHandle = {
  id: string;
  correlationId: string;
};

function extractLinkHost(rawUrl: string | null | undefined): string | null {
  const value = String(rawUrl || "").trim();
  if (!value) return null;

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function getErrorSnapshot(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { raw: String(err) };
  }

  const anyErr = err as Error & {
    code?: number;
    data?: Record<string, unknown>;
    response?: { status?: number; data?: unknown };
  };

  return {
    name: anyErr.name,
    message: anyErr.message,
    code: anyErr.code ?? null,
    data: anyErr.data ?? null,
    responseStatus: anyErr.response?.status ?? null,
    responseData: anyErr.response?.data ?? null,
  };
}

async function resolveNextAttemptNumber(postId: string, isPlatformScope: boolean): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("social_post_delivery_attempts")
    .select("attempt_number")
    .eq("post_id", postId)
    .eq("is_platform_scope", isPlatformScope)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[social-delivery-attempts] Failed to resolve next attempt number:", error.message);
    return 1;
  }

  const current = Number(data?.attempt_number || 0);
  if (!Number.isFinite(current) || current < 1) return 1;
  return current + 1;
}

export async function beginSocialDeliveryAttempt(args: {
  post: SocialPost;
  account: SocialAccount;
  scope: AttemptScope;
  triggerSource: TriggerSource;
}): Promise<AttemptHandle | null> {
  const { post, account, scope, triggerSource } = args;
  const postId = String(post.id || "").trim();
  if (!postId) return null;

  const correlationId = crypto.randomUUID();
  const attemptNumber = await resolveNextAttemptNumber(postId, scope.isPlatformScope);

  const requestSnapshot = {
    status: String(post.status || ""),
    contentLength: String(post.content || "").length,
    hasImage: !!String(post.image_url || "").trim(),
    hasVideo: !!String(post.video_url || "").trim(),
    hasLink: !!String(post.final_link_url || post.link_url || "").trim(),
    linkHost: extractLinkHost(post.final_link_url || post.link_url),
    accountConnectionMethod: String(account.connection_method || ""),
    accountTokenType: String(account.token_metadata?.token_type || account.token_metadata?.type || ""),
  };

  const { data, error } = await supabaseAdmin
    .from("social_post_delivery_attempts")
    .insert({
      post_id: postId,
      tenant_id: scope.isPlatformScope ? null : (scope.tenantId || null),
      created_by_user_id: scope.createdByUserId || null,
      account_id: account.id || null,
      platform: post.platform,
      is_platform_scope: scope.isPlatformScope,
      trigger_source: triggerSource,
      correlation_id: correlationId,
      attempt_number: attemptNumber,
      request_snapshot: requestSnapshot,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.warn("[social-delivery-attempts] Failed to create attempt row:", error?.message || "unknown error");
    return null;
  }

  return {
    id: String(data.id),
    correlationId,
  };
}

export async function markSocialDeliveryAttemptSucceeded(args: {
  attempt: AttemptHandle | null;
  result: { postId?: string; postUrl?: string };
}): Promise<void> {
  if (!args.attempt) return;

  const finishedAtIso = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("social_post_delivery_attempts")
    .update({
      finished_at: finishedAtIso,
      duration_ms: null,
      result_snapshot: {
        postId: args.result.postId || null,
        postUrl: args.result.postUrl || null,
      },
      error_message: null,
      error_snapshot: null,
    })
    .eq("id", args.attempt.id);

  if (error) {
    console.warn("[social-delivery-attempts] Failed to mark success:", error.message);
    return;
  }

  const { data: row } = await supabaseAdmin
    .from("social_post_delivery_attempts")
    .select("started_at")
    .eq("id", args.attempt.id)
    .maybeSingle();

  const started = new Date(String(row?.started_at || "")).getTime();
  const finished = new Date(finishedAtIso).getTime();
  const durationMs = Number.isFinite(started) && Number.isFinite(finished) && started > 0
    ? Math.max(0, finished - started)
    : null;

  if (durationMs !== null) {
    await supabaseAdmin
      .from("social_post_delivery_attempts")
      .update({ duration_ms: durationMs })
      .eq("id", args.attempt.id);
  }
}

export async function markSocialDeliveryAttemptFailed(args: {
  attempt: AttemptHandle | null;
  err: unknown;
}): Promise<void> {
  if (!args.attempt) return;

  const finishedAtIso = new Date().toISOString();
  const errMessage = args.err instanceof Error ? args.err.message : String(args.err);
  const errSnapshot = getErrorSnapshot(args.err);

  const { error } = await supabaseAdmin
    .from("social_post_delivery_attempts")
    .update({
      finished_at: finishedAtIso,
      duration_ms: null,
      error_message: errMessage,
      error_snapshot: errSnapshot,
    })
    .eq("id", args.attempt.id);

  if (error) {
    console.warn("[social-delivery-attempts] Failed to mark failure:", error.message);
    return;
  }

  const { data: row } = await supabaseAdmin
    .from("social_post_delivery_attempts")
    .select("started_at")
    .eq("id", args.attempt.id)
    .maybeSingle();

  const started = new Date(String(row?.started_at || "")).getTime();
  const finished = new Date(finishedAtIso).getTime();
  const durationMs = Number.isFinite(started) && Number.isFinite(finished) && started > 0
    ? Math.max(0, finished - started)
    : null;

  if (durationMs !== null) {
    await supabaseAdmin
      .from("social_post_delivery_attempts")
      .update({ duration_ms: durationMs })
      .eq("id", args.attempt.id);
  }
}
