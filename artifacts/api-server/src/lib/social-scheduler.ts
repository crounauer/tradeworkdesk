import { supabaseAdmin } from "./supabase";
import { dispatchPost } from "./social-platforms";

const INTERVAL_MS = 60_000;

async function processScheduledPosts(): Promise<void> {
  try {
    const { data: claimedPosts, error: claimError } = await supabaseAdmin
      .from("social_posts")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())
      .select();

    if (claimError) {
      console.error("[social-scheduler] Error claiming posts:", claimError.message);
      return;
    }

    for (const post of claimedPosts ?? []) {
      try {
        let accountQuery = supabaseAdmin
          .from("social_accounts")
          .select("*")
          .eq("tenant_id", post.tenant_id)
          .eq("is_active", true)
          .limit(1);

        if (post.account_id) {
          accountQuery = accountQuery.eq("id", post.account_id);
        } else {
          accountQuery = accountQuery.eq("platform", post.platform);
        }

        const { data: account } = await accountQuery.single();

        if (!account) {
          await supabaseAdmin
            .from("social_posts")
            .update({
              status: "failed",
              error: `No active ${post.platform} account found for tenant`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", post.id);
          continue;
        }

        const result = await dispatchPost(post, account);

        await supabaseAdmin
          .from("social_posts")
          .update({
            status: "posted",
            post_id: result.postId || null,
            post_url: result.postUrl || null,
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id);

        console.log(`[social-scheduler] Posted ${post.platform} post ${post.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[social-scheduler] Failed to post ${post.id}:`, message);

        await supabaseAdmin
          .from("social_posts")
          .update({
            status: "failed",
            error: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id);
      }
    }
  } catch (err) {
    console.error("[social-scheduler] Error processing scheduled posts:", err);
  }
}

export function startSocialScheduler(): void {
  console.log("[social-scheduler] Starting scheduler (60s interval)");
  setInterval(processScheduledPosts, INTERVAL_MS);
}
