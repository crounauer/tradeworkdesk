/**
 * AI usage tracking helper
 *
 * Call trackAiUsage() after any OpenAI API call to log consumption to the
 * ai_usage_log table. The monthly aggregate trigger on that table keeps
 * ai_usage_monthly up to date automatically.
 */

import { supabaseAdmin } from "./supabase";

// New tables not yet in Supabase generated types — use untyped alias
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

export interface AiUsageRecord {
  tenantId: string;
  userId?: string;
  operation: string;  // e.g. 'social_post', 'blog_rewrite', 'meta_description', 'service_page'
  module: "social" | "website" | "jobs";
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  imagesGenerated?: number;
}

/**
 * Estimate USD cost for common OpenAI models.
 * Prices as of 2026. Update if pricing changes.
 */
function estimateCostUsd(model: string, tokensIn: number, tokensOut: number, images: number): number {
  let cost = 0;
  switch (model) {
    case "gpt-4o":
      cost += (tokensIn / 1_000_000) * 2.50 + (tokensOut / 1_000_000) * 10.00;
      break;
    case "gpt-4o-mini":
    default:
      cost += (tokensIn / 1_000_000) * 0.15 + (tokensOut / 1_000_000) * 0.60;
      break;
  }
  // dall-e-3 standard 1024x1024 = $0.040/image
  cost += images * 0.040;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Log AI usage to the database.
 * Fire-and-forget — does not throw on failure to avoid breaking the caller.
 */
export async function trackAiUsage(record: AiUsageRecord): Promise<void> {
  try {
    const tokensIn = record.tokensIn ?? 0;
    const tokensOut = record.tokensOut ?? 0;
    const images = record.imagesGenerated ?? 0;
    const model = record.model ?? "gpt-4o-mini";

    await db.from("ai_usage_log").insert({
      tenant_id: record.tenantId,
      user_id: record.userId ?? null,
      operation: record.operation,
      module: record.module,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      images_generated: images,
      cost_usd: estimateCostUsd(model, tokensIn, tokensOut, images),
    });
  } catch (err) {
    // Non-fatal — log warning but don't propagate
    console.warn("[ai-usage] Failed to log AI usage:", (err as Error).message);
  }
}

/**
 * Get current month's AI usage for a tenant.
 * Returns zeros if no usage recorded yet.
 */
export async function getMonthlyAiUsage(tenantId: string): Promise<{
  tokens_total: number;
  images_generated: number;
  social_posts: number;
  blog_posts: number;
  website_rewrites: number;
}> {
  const month = new Date();
  month.setDate(1);
  month.setHours(0, 0, 0, 0);
  const monthStr = month.toISOString().slice(0, 10);

  const { data } = await supabaseAdmin
    .from("ai_usage_monthly")
    .select("tokens_total, images_generated, social_posts, blog_posts, website_rewrites")
    .eq("tenant_id", tenantId)
    .eq("month", monthStr)
    .maybeSingle();

  return {
    tokens_total: (data as any)?.tokens_total ?? 0,
    images_generated: (data as any)?.images_generated ?? 0,
    social_posts: (data as any)?.social_posts ?? 0,
    blog_posts: (data as any)?.blog_posts ?? 0,
    website_rewrites: (data as any)?.website_rewrites ?? 0,
  };
}
