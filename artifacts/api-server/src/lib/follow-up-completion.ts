import { supabaseAdmin } from "./supabase";

export async function finishOriginalJobIfNoOpenFollowUps(tenantId: string, originalJobId: string): Promise<void> {
  const { data: open, error: readError } = await supabaseAdmin.from("follow_ups")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("original_job_id", originalJobId)
    .in("status", ["awaiting_parts", "parts_arrived", "booked"])
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;
  if (open) return;

  const { error } = await supabaseAdmin.from("jobs")
    .update({ status: "completed" })
    .eq("tenant_id", tenantId)
    .eq("id", originalJobId)
    .eq("status", "follow_up_scheduled");
  if (error) throw error;
}

export async function finishFollowUpsForJob(tenantId: string, jobId: string): Promise<void> {
  const { data: linked, error: lookupError } = await supabaseAdmin.from("follow_ups")
    .select("id, original_job_id")
    .eq("tenant_id", tenantId)
    .eq("new_job_id", jobId)
    .in("status", ["booked", "completed"]);
  if (lookupError) throw lookupError;
  if (!linked?.length) return;

  const { error } = await supabaseAdmin.from("follow_ups")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("new_job_id", jobId)
    .eq("status", "booked")
    .in("id", linked.map(row => row.id));
  if (error) throw error;
  for (const id of new Set(linked.map(row => row.original_job_id))) {
    if (id) await finishOriginalJobIfNoOpenFollowUps(tenantId, id);
  }
}
