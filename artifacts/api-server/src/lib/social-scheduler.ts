import { supabaseAdmin } from "./supabase";
import { dispatchPost } from "./social-platforms";
import { notifyUsersForEvent } from "./push-events";
import { buildUtmTaggedUrl, resolvePromotionPageUrl } from "./social-website-promotion";

const INTERVAL_MS = 60_000;

async function notifyCreatorOfScheduledFailure(post: Record<string, unknown>, message: string): Promise<void> {
  const tenantId = String(post.tenant_id || "");
  const creatorId = String(post.created_by_user_id || "");
  if (!tenantId || !creatorId) return;

  await notifyUsersForEvent({
    tenantId,
    eventType: "operational_exceptions",
    title: "Scheduled Facebook post failed",
    body: message,
    url: "/admin/social",
    eventKey: `social_post_failed:${String(post.id || "")}:${String(post.updated_at || "")}`,
    targetUserIds: [creatorId],
    data: { postId: post.id, platform: post.platform },
  });
}

async function enrichScheduledWebsitePromotion(post: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (String(post.post_type || "business") !== "website_promotion") {
    return post;
  }

  const websitePageId = String(post.website_page_id || "");
  if (!websitePageId) {
    throw new Error("Scheduled Website Promotion Post is missing website page reference");
  }

  const tenantId = String(post.tenant_id || "");
  const page = await resolvePromotionPageUrl({
    tenantId,
    websitePageId,
    requirePublished: true,
  });

  const finalLinkUrl = buildUtmTaggedUrl(page.pageUrl, {
    source: post.utm_source ? String(post.utm_source) : "facebook",
    medium: post.utm_medium ? String(post.utm_medium) : "social",
    campaign: post.utm_campaign ? String(post.utm_campaign) : null,
    content: post.utm_content ? String(post.utm_content) : null,
  });

  await supabaseAdmin
    .from("social_posts")
    .update({
      website_page_url: page.pageUrl,
      final_link_url: finalLinkUrl,
      link_url: finalLinkUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", String(post.id));

  return {
    ...post,
    website_page_url: page.pageUrl,
    final_link_url: finalLinkUrl,
    link_url: finalLinkUrl,
  };
}

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
        const enrichedPost = await enrichScheduledWebsitePromotion(post as Record<string, unknown>);

        let accountQuery = supabaseAdmin
          .from("social_accounts")
          .select("*")
          .eq("tenant_id", enrichedPost.tenant_id)
          .eq("is_active", true)
          .limit(1);

        if (enrichedPost.account_id) {
          accountQuery = accountQuery.eq("id", enrichedPost.account_id);
        } else {
          accountQuery = accountQuery.eq("platform", enrichedPost.platform);
        }

        const { data: account } = await accountQuery.single();

        if (!account) {
          await supabaseAdmin
            .from("social_posts")
            .update({
              status: "failed",
              error: `No active ${enrichedPost.platform} account found for tenant`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", enrichedPost.id);
          await notifyCreatorOfScheduledFailure(
            enrichedPost,
            `No active ${String(enrichedPost.platform)} account connected for scheduled publish.`,
          );
          continue;
        }

        const result = await dispatchPost(enrichedPost as any, account);

        await supabaseAdmin
          .from("social_posts")
          .update({
            status: "posted",
            post_id: result.postId || null,
            post_url: result.postUrl || null,
            error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", enrichedPost.id);

        console.log(`[social-scheduler] Posted ${String(enrichedPost.platform)} post ${String(enrichedPost.id)}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[social-scheduler] Failed to post ${String(post.id)}:`, message);

        await supabaseAdmin
          .from("social_posts")
          .update({
            status: "failed",
            error: message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id);

        await notifyCreatorOfScheduledFailure(post as Record<string, unknown>, message);
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
