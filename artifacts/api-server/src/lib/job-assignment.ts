import { supabaseAdmin } from "./supabase";

export async function isAssignedToJob(jobId: string, userId: string | undefined, tenantId: string | null | undefined): Promise<boolean> {
  if (!userId || !tenantId) return false;
  const { data, error } = await supabaseAdmin.from("job_schedule_entries").select("id")
    .eq("tenant_id", tenantId).eq("job_id", jobId).eq("assigned_technician_id", userId).limit(1);
  if (error) throw new Error(`Unable to check job assignment: ${error.message}`);
  return Boolean(data?.length);
}
