import { supabaseAdmin } from "./supabase";
import { generateDailySuggestions } from "./social-ai";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour
const RUN_HOUR = 8; // 8am server time

async function runDailySuggestions(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: accounts } = await supabaseAdmin
    .from("social_accounts")
    .select("tenant_id, platform")
    .eq("is_active", true);

  if (!accounts || accounts.length === 0) return;

  const tenantPlatformsMap = new Map<string, Set<string>>();
  for (const acc of accounts) {
    if (!tenantPlatformsMap.has(acc.tenant_id)) {
      tenantPlatformsMap.set(acc.tenant_id, new Set());
    }
    tenantPlatformsMap.get(acc.tenant_id)!.add(acc.platform);
  }

  for (const [tenantId, platformSet] of tenantPlatformsMap) {
    try {
      // Skip if already generated today
      const { count } = await supabaseAdmin
        .from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("entity_id", "daily-suggestion")
        .gte("created_at", `${today}T00:00:00.000Z`);

      if ((count ?? 0) > 0) continue;

      const { data: cs } = await supabaseAdmin
        .from("company_settings")
        .select("name, trading_name")
        .eq("tenant_id", tenantId)
        .eq("singleton_id", "default")
        .maybeSingle();

      const companyName =
        (cs as Record<string, string> | null)?.name ||
        (cs as Record<string, string> | null)?.trading_name ||
        "Your Heating Company";

      const platforms = Array.from(platformSet);
      const suggestions = await generateDailySuggestions(companyName, platforms);
      if (suggestions.length === 0) continue;

      // Attach a recent gallery photo to each post
      const { data: photoRows } = await supabaseAdmin
        .from("file_attachments")
        .select("storage_path")
        .eq("tenant_id", tenantId)
        .like("file_type", "image/%")
        .order("created_at", { ascending: false })
        .limit(10);

      const photoUrls = (photoRows ?? []).flatMap((p) => {
        const { data } = supabaseAdmin.storage
          .from("service-photos")
          .getPublicUrl((p as { storage_path: string }).storage_path);
        return data.publicUrl ? [data.publicUrl] : [];
      });

      await supabaseAdmin.from("social_posts").insert(
        suggestions.map((s) => ({
          tenant_id: tenantId,
          platform: s.platform,
          content: s.content,
          status: "draft",
          entity_type: "article",
          entity_id: "daily-suggestion",
          image_url: photoUrls.length > 0
            ? photoUrls[Math.floor(Math.random() * photoUrls.length)]
            : null,
        })),
      );

      console.log(
        `[social-daily-cron] Generated ${suggestions.length} suggestions for tenant ${tenantId}`,
      );
    } catch (err) {
      console.error(`[social-daily-cron] Failed for tenant ${tenantId}:`, err);
    }
  }
}

export function startDailySuggestionsCron(): void {
  console.log("[social-daily-cron] Starting (runs daily at 8am server time)");

  const checkAndRun = async () => {
    if (new Date().getHours() === RUN_HOUR) {
      await runDailySuggestions().catch((err) =>
        console.error("[social-daily-cron] Run failed:", err),
      );
    }
  };

  // Check immediately in case server restarted during run hour
  checkAndRun();
  setInterval(checkAndRun, CHECK_INTERVAL_MS);
}
