import { db } from "@workspace/db";
import { socialPosts, socialAccounts } from "@workspace/db";
import { eq, lte, and, sql } from "drizzle-orm";
import { dispatchPost } from "./social-platforms";

const INTERVAL_MS = 60_000;

async function claimDuePosts() {
  return db
    .update(socialPosts)
    .set({ status: "processing" as any, updated_at: new Date() })
    .where(
      and(
        eq(socialPosts.status, "scheduled"),
        lte(socialPosts.scheduled_for, new Date()),
      ),
    )
    .returning();
}

async function processScheduledPosts(): Promise<void> {
  try {
    const claimedPosts = await claimDuePosts();

    for (const post of claimedPosts) {
      try {
        const accountFilter = post.account_id
          ? and(
              eq(socialAccounts.id, post.account_id),
              eq(socialAccounts.is_active, true),
            )
          : and(
              eq(socialAccounts.tenant_id, post.tenant_id),
              eq(socialAccounts.platform, post.platform),
              eq(socialAccounts.is_active, true),
            );

        const [account] = await db
          .select()
          .from(socialAccounts)
          .where(accountFilter)
          .limit(1);

        if (!account) {
          await db
            .update(socialPosts)
            .set({
              status: "failed",
              error: `No active ${post.platform} account found for tenant`,
              updated_at: new Date(),
            })
            .where(eq(socialPosts.id, post.id));
          continue;
        }

        const result = await dispatchPost(post, account);

        await db
          .update(socialPosts)
          .set({
            status: "posted",
            post_id: result.postId || null,
            post_url: result.postUrl || null,
            error: null,
            updated_at: new Date(),
          })
          .where(eq(socialPosts.id, post.id));

        console.log(`[social-scheduler] Posted ${post.platform} post ${post.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[social-scheduler] Failed to post ${post.id}:`, message);

        await db
          .update(socialPosts)
          .set({
            status: "failed",
            error: message,
            updated_at: new Date(),
          })
          .where(eq(socialPosts.id, post.id));
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
