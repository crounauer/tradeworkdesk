import type { SupabaseClient } from "@supabase/supabase-js";

export interface InvoiceJobStatusResult {
  job_marked_invoiced: boolean;
  job_status_warning?: string;
}

export async function syncSentInvoiceJob(
  db: Pick<SupabaseClient, "from">,
  tenantId: string,
  invoice: { type: string; status: string; job_id: string | null },
): Promise<InvoiceJobStatusResult> {
  if (invoice.type !== "invoice" || invoice.status !== "sent" || !invoice.job_id) {
    return { job_marked_invoiced: false };
  }

  try {
    const { data: job, error: jobError } = await db.from("jobs")
      .select("status")
      .eq("id", invoice.job_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (jobError) throw new Error(jobError.message);
    if (!job) throw new Error("Linked job not found");
    if (job.status === "invoiced") return { job_marked_invoiced: true };
    if (job.status !== "completed") return { job_marked_invoiced: false };

    const { data: followUp, error: followUpError } = await db.from("follow_ups")
      .select("id")
      .eq("original_job_id", invoice.job_id)
      .eq("tenant_id", tenantId)
      .in("status", ["awaiting_parts", "parts_arrived", "booked"])
      .limit(1)
      .maybeSingle();
    if (followUpError) throw new Error(followUpError.message);
    if (followUp) {
      return {
        job_marked_invoiced: false,
        job_status_warning: "The job remains Completed because it has an active follow-up. Invoice the follow-up job instead.",
      };
    }

    const { data: updated, error: updateError } = await db.from("jobs")
      .update({ status: "invoiced" })
      .eq("id", invoice.job_id)
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) {
      return {
        job_marked_invoiced: false,
        job_status_warning: "The job status changed while the invoice was being sent. Please review the job.",
      };
    }
    return { job_marked_invoiced: true };
  } catch (error) {
    // Delivery has already succeeded; report the partial failure without asking for a duplicate send.
    console.error("[invoices] Failed to mark linked job invoiced:", invoice.job_id, error);
    return {
      job_marked_invoiced: false,
      job_status_warning: "The invoice is sent, but the job status could not be updated. Ask an admin to mark the job as invoiced; do not resend the invoice.",
    };
  }
}
