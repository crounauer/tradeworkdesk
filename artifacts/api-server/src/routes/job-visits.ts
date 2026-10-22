import { Router, type IRouter } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireRole, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { findTechnicianJobClash, sendTechnicianJobClash } from "../lib/technician-job-clashes";
import { findTechnicianLeaveConflict, sendTechnicianLeaveConflict } from "../lib/technician-leave-conflicts";
import { invalidateCalendarCache } from "./calendar";
import { invalidateHomepageCache } from "./homepage";
import { isAssignedToJob } from "../lib/job-assignment";
import { invalidateJobsCache } from "./jobs";

const router: IRouter = Router();
const ids = z.object({ id: z.string().uuid(), visitId: z.string().uuid().optional() });
export const jobVisitBody = z.object({
  scheduled_date: z.string().date(),
  scheduled_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  all_day: z.boolean(),
  estimated_duration: z.number().int().positive().max(1440).nullable(),
  assigned_technician_id: z.string().uuid().nullable(),
  notes: z.string().trim().max(4000).nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.all_day && (!value.scheduled_time || !value.estimated_duration)) {
    ctx.addIssue({ code: "custom", message: "Timed visits require a start time and duration." });
  }
  if (!value.all_day && value.scheduled_time && value.estimated_duration) {
    const [hour, minute] = value.scheduled_time.split(":").map(Number);
    if (hour * 60 + minute + value.estimated_duration > 1440) {
      ctx.addIssue({ code: "custom", message: "A visit must finish on the selected date. Add another visit for the following day." });
    }
  }
});

async function getJob(req: AuthenticatedRequest, res: Parameters<typeof sendTechnicianJobClash>[0]) {
  const params = ids.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid job or visit ID." }); return null; }
  const { data, error } = await supabaseAdmin.from("jobs")
    .select("id, status, assigned_technician_id")
    .eq("tenant_id", req.tenantId!).eq("id", params.data.id).eq("is_active", true).maybeSingle();
  if (error) throw new Error(`Unable to load job: ${error.message}`);
  if (!data) { res.status(404).json({ error: "Job not found." }); return null; }
  if (req.userRole === "technician" && !await isAssignedToJob(data.id, req.userId, req.tenantId)) {
    res.status(403).json({ error: "You can only view jobs assigned to you." }); return null;
  }
  return data;
}

router.get("/jobs/:id/visits", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res) => {
  if (!await getJob(req, res)) return;
  const { data, error } = await supabaseAdmin.from("job_visits").select("*")
    .eq("tenant_id", req.tenantId!).eq("job_id", String(req.params.id))
    .order("scheduled_date").order("scheduled_time");
  if (error) throw new Error(`Unable to load job visits: ${error.message}`);
  res.set("Cache-Control", "private, no-store").json(data || []);
});

async function saveVisit(req: AuthenticatedRequest, res: Parameters<typeof sendTechnicianJobClash>[0]) {
  const job = await getJob(req, res);
  if (!job) return;
  if (["completed", "cancelled", "invoiced"].includes(job.status)) {
    res.status(409).json({ error: "Reopen the job before scheduling visits." }); return;
  }
  const body = jobVisitBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.issues.map(i => i.message).join(" ") }); return; }
  const visitId = req.params.visitId ? String(req.params.visitId) : null;
  if (visitId) {
    const { data, error } = await supabaseAdmin.from("job_visits").select("id")
      .eq("tenant_id", req.tenantId!).eq("job_id", job.id).eq("id", visitId).maybeSingle();
    if (error) throw new Error(`Unable to load visit: ${error.message}`);
    if (!data) { res.status(404).json({ error: "Visit not found." }); return; }
  }
  const payload = {
    ...body.data,
    scheduled_time: body.data.all_day ? null : body.data.scheduled_time,
    estimated_duration: body.data.all_day ? null : body.data.estimated_duration,
  };
  if (payload.assigned_technician_id) {
    const { data: technician, error } = await supabaseAdmin.from("profiles").select("id")
      .eq("tenant_id", req.tenantId!).eq("id", payload.assigned_technician_id)
      .eq("is_active", true).eq("can_be_assigned_jobs", true).maybeSingle();
    if (error) throw new Error(`Unable to validate technician: ${error.message}`);
    if (!technician) { res.status(403).json({ error: "Select an active assignable technician from your company." }); return; }
  }
  const leave = await findTechnicianLeaveConflict({
    tenantId: req.tenantId!, technicianId: payload.assigned_technician_id,
    scheduledDate: payload.scheduled_date, scheduledEndDate: null,
    scheduledTime: payload.scheduled_time, durationMinutes: payload.estimated_duration,
  });
  if (leave) { sendTechnicianLeaveConflict(res, leave); return; }
  const clash = await findTechnicianJobClash({
    tenantId: req.tenantId!, technicianId: payload.assigned_technician_id,
    scheduledDate: payload.scheduled_date, scheduledTime: payload.scheduled_time,
    allDay: payload.all_day, estimatedDuration: payload.estimated_duration,
    excludeJobId: visitId ?? undefined,
  });
  if (clash) { sendTechnicianJobClash(res, clash); return; }
  const query = visitId
    ? supabaseAdmin.from("job_visits").update({ ...payload, updated_at: new Date().toISOString() })
      .eq("tenant_id", req.tenantId!).eq("job_id", job.id).eq("id", visitId)
    : supabaseAdmin.from("job_visits").insert({ ...payload, tenant_id: req.tenantId!, job_id: job.id });
  const { data, error } = await query.select("*").single();
  if (error) throw new Error(`Unable to save visit: ${error.message}`);
  invalidateCalendarCache(req.tenantId);
  invalidateHomepageCache(req.tenantId);
  invalidateJobsCache(req.tenantId);
  res.status(visitId ? 200 : 201).json(data);
}

router.post("/jobs/:id/visits", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("job_management"), saveVisit);
router.patch("/jobs/:id/visits/:visitId", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("job_management"), saveVisit);
router.delete("/jobs/:id/visits/:visitId", requireAuth, requireTenant, requireRole("admin", "office_staff"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res) => {
  const job = await getJob(req, res);
  if (!job) return;
  const { data, error } = await supabaseAdmin.from("job_visits").delete()
    .eq("tenant_id", req.tenantId!).eq("job_id", job.id).eq("id", String(req.params.visitId)).select("id").maybeSingle();
  if (error) throw new Error(`Unable to delete visit: ${error.message}`);
  if (!data) { res.status(404).json({ error: "Visit not found." }); return; }
  invalidateCalendarCache(req.tenantId);
  invalidateHomepageCache(req.tenantId);
  invalidateJobsCache(req.tenantId);
  res.status(204).end();
});

export default router;
