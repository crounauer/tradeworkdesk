import type { NextFunction, Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedRequest } from "./auth";

export function jobBillingLock(db: SupabaseClient) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.tenantId) {
      res.status(403).json({ error: "Tenant context is required" });
      return;
    }
    const jobId = req.params.id;
    if (typeof jobId !== "string" || !jobId) {
      res.status(400).json({ error: "Missing job id" });
      return;
    }
    const { data, error } = await db
      .from("follow_ups")
      .select("new_job_id")
      .eq("tenant_id", req.tenantId)
      .eq("original_job_id", jobId)
      .eq("status", "booked")
      .not("new_job_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[job-billing-lock] Failed to check follow-up:", error);
      res.status(500).json({ error: "Unable to check whether billing entries are locked. Please retry." });
      return;
    }
    if (data) {
      res.status(409).json({
        error: "This job's billing entries are read-only because a follow-up job has been created. Add or correct time, parts and services on the follow-up job.",
        new_job_id: data.new_job_id,
      });
      return;
    }
    next();
  };
}
