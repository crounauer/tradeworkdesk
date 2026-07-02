import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requireTenant, requireRole, requirePlanFeature, type AuthenticatedRequest } from "../middlewares/auth";
import { notifyUsersForEvent } from "../lib/push-events";
import { findTechnicianLeaveConflict, sendTechnicianLeaveConflict } from "../lib/technician-leave-conflicts";
import { invalidateHomepageCache } from "./homepage";

const router: IRouter = Router();

router.get("/follow-ups", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const page = parseInt(req.query.page as string) || 1;
  const offset = (page - 1) * limit;

  let q = supabaseAdmin
    .from("follow_ups")
    .select("*, customers(first_name, last_name), properties(address_line1, postcode), original_job:jobs!follow_ups_original_job_id_fkey(id, job_ref, status, job_type), creator:profiles!follow_ups_created_by_fkey(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);
  if (status && ["awaiting_parts", "parts_arrived", "booked", "cancelled", "completed"].includes(status)) {
    q = q.eq("status", status);
  } else {
    // Default "All" view excludes terminal follow-ups
    q = q.neq("status", "completed").neq("status", "cancelled");
  }

  const { data, error, count } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }

  const mapped = (data || []).map((f: Record<string, unknown>) => {
    const cust = f.customers as { first_name: string; last_name: string } | null;
    const prop = f.properties as { address_line1: string; postcode?: string } | null;
    const origJob = f.original_job as { id: string; job_ref?: string; status: string; job_type: string } | null;
    const creator = f.creator as { full_name: string } | null;
    return {
      ...f,
      customer_name: cust ? `${cust.first_name} ${cust.last_name}` : null,
      property_address: prop?.address_line1 || null,
      property_postcode: prop?.postcode || null,
      original_job_ref: origJob?.job_ref || null,
      original_job_status: origJob?.status || null,
      original_job_type: origJob?.job_type || null,
      creator_name: creator?.full_name || null,
      customers: undefined,
      properties: undefined,
      original_job: undefined,
      creator: undefined,
    };
  });

  res.json({
    follow_ups: mapped,
    pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
  });
});

router.get("/follow-ups/overdue-count", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  let q = supabaseAdmin
    .from("follow_ups")
    .select("id", { count: "exact", head: true })
    .eq("status", "awaiting_parts")
    .lt("expected_parts_date", today);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { count, error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ count: count || 0 });
});

router.get("/follow-ups/:id", requireAuth, requireTenant, requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  let q = supabaseAdmin
    .from("follow_ups")
    .select("*, customers(first_name, last_name, phone, email), properties(address_line1, postcode), original_job:jobs!follow_ups_original_job_id_fkey(id, job_ref, status, job_type, description), creator:profiles!follow_ups_created_by_fkey(full_name)")
    .eq("id", id);

  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data, error } = await q.single();
  if (error || !data) { res.status(404).json({ error: "Follow-up not found" }); return; }
  res.json(data);
});

router.post("/follow-ups", requireAuth, requireTenant, requireRole("admin", "office_staff", "super_admin"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { original_job_id, work_description, parts_description, expected_parts_date, notes } = req.body;

  if (!original_job_id) {
    res.status(400).json({ error: "original_job_id is required" }); return;
  }
  if (!parts_description || typeof parts_description !== "string" || !parts_description.trim()) {
    res.status(400).json({ error: "parts_description is required" }); return;
  }

  let jobQ = supabaseAdmin.from("jobs").select("id, customer_id, property_id, tenant_id").eq("id", original_job_id);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job, error: jobErr } = await jobQ.single();

  if (jobErr || !job) { res.status(404).json({ error: "Job not found" }); return; }

  let existingFollowUpQ = supabaseAdmin
    .from("follow_ups")
    .select("id, status, new_job_id")
    .eq("original_job_id", job.id)
    .limit(1);
  if (req.tenantId) existingFollowUpQ = existingFollowUpQ.eq("tenant_id", req.tenantId);
  const { data: existingFollowUps, error: existingErr } = await existingFollowUpQ;
  if (existingErr) { res.status(500).json({ error: existingErr.message }); return; }
  if ((existingFollowUps || []).length > 0) {
    const existing = existingFollowUps![0] as { id: string; status: string; new_job_id?: string | null };
    res.status(409).json({
      error: "A follow-up already exists for this job",
      code: "FOLLOW_UP_ALREADY_EXISTS",
      follow_up_id: existing.id,
      status: existing.status,
      new_job_id: existing.new_job_id || null,
    });
    return;
  }

  const insertPayload: Record<string, unknown> = {
    tenant_id: req.tenantId || job.tenant_id,
    original_job_id: job.id,
    customer_id: job.customer_id,
    property_id: job.property_id,
    work_description: work_description || null,
    parts_description: parts_description || null,
    expected_parts_date: expected_parts_date || null,
    notes: notes || null,
    status: "awaiting_parts",
    created_by: req.userId,
  };

  const { data, error } = await supabaseAdmin.from("follow_ups").insert(insertPayload).select().single();
  if (error) { res.status(500).json({ error: error.message }); return; }

  invalidateHomepageCache(req.tenantId);

  if (expected_parts_date) {
    void notifyUsersForEvent({
      tenantId: req.tenantId!,
      eventType: "appointment_due",
      title: "Follow-up Created",
      body: `Follow-up ${data.id} is expected on ${expected_parts_date}.`,
      url: "/follow-ups",
      eventKey: `followup_created:${data.id}`,
      targetRoles: ["admin", "office_staff"],
      data: { followUpId: data.id },
    }).catch((err) => console.error("[push-events] followup_created failed:", err));
  }

  res.status(201).json(data);
});

router.patch("/follow-ups/:id", requireAuth, requireTenant, requireRole("admin", "office_staff", "super_admin"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { status, work_description, parts_description, expected_parts_date, notes, new_job_id } = req.body;

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status && ["awaiting_parts", "parts_arrived", "booked", "cancelled", "completed"].includes(status)) updatePayload.status = status;
  if (work_description !== undefined) updatePayload.work_description = work_description || null;
  if (parts_description !== undefined) updatePayload.parts_description = parts_description || null;
  if (expected_parts_date !== undefined) updatePayload.expected_parts_date = expected_parts_date || null;
  if (notes !== undefined) updatePayload.notes = notes || null;
  if (new_job_id !== undefined) updatePayload.new_job_id = new_job_id || null;

  let q = supabaseAdmin.from("follow_ups").update(updatePayload).eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { data: before } = await supabaseAdmin
    .from("follow_ups")
    .select("status")
    .eq("id", id)
    .eq("tenant_id", req.tenantId!)
    .maybeSingle();

  const { data, error } = await q.select().single();
  if (error) { res.status(error.code === "PGRST116" ? 404 : 500).json({ error: error.message }); return; }

  const previousStatus = (before as { status?: string } | null)?.status;
  const nextStatus = (data as { status?: string }).status;
  if (nextStatus && previousStatus !== nextStatus && ["parts_arrived", "booked", "cancelled"].includes(nextStatus)) {
    void notifyUsersForEvent({
      tenantId: req.tenantId!,
      eventType: "blocking_status_changes",
      title: "Follow-up Status Updated",
      body: `Follow-up ${id} moved to ${nextStatus}.`,
      url: "/follow-ups",
      eventKey: `followup_status:${id}:${nextStatus}`,
      targetRoles: ["admin", "office_staff"],
      data: { followUpId: id, status: nextStatus },
    }).catch((err) => console.error("[push-events] followup_status failed:", err));
  }

  if (nextStatus === "cancelled") {
    void notifyUsersForEvent({
      tenantId: req.tenantId!,
      eventType: "operational_exceptions",
      title: "Operational Exception",
      body: `Follow-up ${id} was cancelled.`,
      url: "/follow-ups",
      eventKey: `followup_cancelled:${id}`,
      targetRoles: ["admin", "office_staff"],
      data: { followUpId: id },
    }).catch((err) => console.error("[push-events] followup_cancelled failed:", err));
  }

  invalidateHomepageCache(req.tenantId);

  res.json(data);
});

router.post("/follow-ups/:id/convert-to-job", requireAuth, requireTenant, requireRole("admin", "office_staff", "super_admin"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;
  const { scheduled_date, scheduled_time, assigned_technician_id, carry_forward_parts, carry_forward_services, carry_forward_time_entries } = req.body;

  const copyParts = carry_forward_parts === true;
  const copyServices = carry_forward_services === true;
  const copyTimeEntries = carry_forward_time_entries === true;

  let fuQ = supabaseAdmin.from("follow_ups").select("*, original_job:jobs!follow_ups_original_job_id_fkey(id, job_ref)").eq("id", id);
  if (req.tenantId) fuQ = fuQ.eq("tenant_id", req.tenantId);
  const { data: followUp, error: fuErr } = await fuQ.single();

  if (fuErr || !followUp) { res.status(404).json({ error: "Follow-up not found" }); return; }
  if (followUp.status === "booked" || followUp.status === "cancelled") {
    res.status(400).json({ error: `Follow-up is already ${followUp.status}` }); return;
  }

  const tenantId = req.tenantId || followUp.tenant_id;
  const origJob = followUp.original_job as { id: string; job_ref?: string } | null;
  const origRef = origJob?.job_ref || followUp.original_job_id;

  let generatedJobRef: string | undefined;
  const { data: cs } = await supabaseAdmin
    .from("company_settings")
    .select("job_number_prefix, job_number_next")
    .eq("tenant_id", tenantId)
    .eq("singleton_id", "default")
    .maybeSingle();
  const prefix = (cs?.job_number_prefix ?? "").trim().toUpperCase();
  const nextNum = cs?.job_number_next ?? 1;
  generatedJobRef = prefix
    ? `${prefix}${String(nextNum).padStart(4, "0")}`
    : `JOB-${String(nextNum).padStart(4, "0")}`;
  await supabaseAdmin
    .from("company_settings")
    .update({ job_number_next: nextNum + 1 })
    .eq("tenant_id", tenantId)
    .eq("singleton_id", "default");

  const descriptionParts = [
    `Follow-up from ${origRef} (original job ID: ${followUp.original_job_id})`,
    followUp.work_description ? `Work: ${followUp.work_description}` : null,
    followUp.parts_description ? `Parts: ${followUp.parts_description}` : null,
    followUp.notes ? `Notes: ${followUp.notes}` : null,
  ].filter(Boolean).join("\n");

  const jobInsert: Record<string, unknown> = {
    tenant_id: tenantId,
    customer_id: followUp.customer_id,
    property_id: followUp.property_id,
    job_type: "follow_up",
    status: "scheduled",
    priority: "medium",
    scheduled_date: scheduled_date || new Date().toISOString().split("T")[0],
    scheduled_time: scheduled_time || null,
    assigned_technician_id: assigned_technician_id || null,
    description: descriptionParts,
    job_ref: generatedJobRef,
  };

  const followUpConflict = await findTechnicianLeaveConflict({
    tenantId,
    technicianId: assigned_technician_id || null,
    scheduledDate: String(jobInsert.scheduled_date),
    scheduledEndDate: null,
  });
  if (followUpConflict) {
    sendTechnicianLeaveConflict(res, followUpConflict);
    return;
  }

  const { data: newJob, error: jobErr } = await supabaseAdmin.from("jobs").insert(jobInsert).select("id, job_ref").single();
  if (jobErr) { res.status(500).json({ error: jobErr.message }); return; }

  if (copyParts || copyServices || copyTimeEntries) {
    try {
      if (copyParts) {
        let partsQ = supabaseAdmin.from("job_parts").select("part_name, quantity, serial_number, unit_price, catalogue_item_id, status").eq("job_id", followUp.original_job_id);
        if (tenantId) partsQ = partsQ.eq("tenant_id", tenantId);
        const { data: sourceParts, error: sourcePartsErr } = await partsQ;
        if (sourcePartsErr) throw sourcePartsErr;

        if (sourceParts && sourceParts.length > 0) {
          const partRows = sourceParts.map((p: Record<string, unknown>) => ({
            job_id: newJob.id,
            tenant_id: tenantId,
            part_name: p.part_name,
            quantity: p.quantity,
            serial_number: p.serial_number,
            unit_price: p.unit_price,
            catalogue_item_id: p.catalogue_item_id,
            status: p.status || "fitted",
          }));
          const { error: insertPartsErr } = await supabaseAdmin.from("job_parts").insert(partRows);
          if (insertPartsErr) throw insertPartsErr;
        }
      }

      if (copyServices) {
        let servicesQ = supabaseAdmin.from("job_services").select("service_name, quantity, unit_price, catalogue_item_id").eq("job_id", followUp.original_job_id);
        if (tenantId) servicesQ = servicesQ.eq("tenant_id", tenantId);
        const { data: sourceServices, error: sourceServicesErr } = await servicesQ;
        if (sourceServicesErr) throw sourceServicesErr;

        if (sourceServices && sourceServices.length > 0) {
          const serviceRows = sourceServices.map((s: Record<string, unknown>) => ({
            job_id: newJob.id,
            tenant_id: tenantId,
            service_name: s.service_name,
            quantity: s.quantity,
            unit_price: s.unit_price,
            catalogue_item_id: s.catalogue_item_id,
          }));
          const { error: insertServicesErr } = await supabaseAdmin.from("job_services").insert(serviceRows);
          if (insertServicesErr) throw insertServicesErr;
        }
      }

      if (copyTimeEntries) {
        let timeQ = supabaseAdmin.from("job_time_entries").select("arrival_time, departure_time, notes, hourly_rate, callout_fee, created_by").eq("job_id", followUp.original_job_id);
        if (tenantId) timeQ = timeQ.eq("tenant_id", tenantId);
        const { data: sourceEntries, error: sourceEntriesErr } = await timeQ;
        if (sourceEntriesErr) throw sourceEntriesErr;

        if (sourceEntries && sourceEntries.length > 0) {
          const timeRows = sourceEntries.map((t: Record<string, unknown>) => ({
            job_id: newJob.id,
            tenant_id: tenantId,
            arrival_time: t.arrival_time,
            departure_time: t.departure_time,
            notes: t.notes,
            hourly_rate: t.hourly_rate,
            callout_fee: t.callout_fee,
            created_by: t.created_by,
          }));
          const { error: insertTimeErr } = await supabaseAdmin.from("job_time_entries").insert(timeRows);
          if (insertTimeErr) throw insertTimeErr;
        }
      }
    } catch (copyErr) {
      await supabaseAdmin.from("jobs").delete().eq("id", newJob.id);
      const msg = copyErr instanceof Error ? copyErr.message : "Failed to carry forward job data";
      res.status(500).json({ error: msg });
      return;
    }
  }

  let updateQ = supabaseAdmin.from("follow_ups").update({
    status: "booked",
    new_job_id: newJob.id,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (req.tenantId) updateQ = updateQ.eq("tenant_id", req.tenantId);
  const { error: updateErr } = await updateQ;
  if (updateErr) {
    await supabaseAdmin.from("jobs").delete().eq("id", newJob.id);
    res.status(500).json({ error: "Failed to link follow-up to new job" }); return;
  }

  if (assigned_technician_id) {
    void notifyUsersForEvent({
      tenantId,
      eventType: "assignment_changes",
      title: "New Job Assignment",
      body: `You were assigned job ${newJob.job_ref || newJob.id} from follow-up ${id}.`,
      url: `/jobs/${newJob.id}`,
      eventKey: `followup_converted_assignment:${id}:${assigned_technician_id}`,
      targetUserIds: [assigned_technician_id],
      data: { followUpId: id, jobId: newJob.id },
    }).catch((err) => console.error("[push-events] followup conversion assignment failed:", err));
  }

  invalidateHomepageCache(req.tenantId);

  res.status(201).json({
    follow_up_id: id,
    job_id: newJob.id,
    job_ref: newJob.job_ref,
    copied: {
      parts: copyParts,
      services: copyServices,
      time_entries: copyTimeEntries,
    },
  });
});

router.delete("/follow-ups/:id", requireAuth, requireTenant, requireRole("admin", "office_staff", "super_admin"), requirePlanFeature("job_management"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const { id } = req.params;

  let q = supabaseAdmin.from("follow_ups").delete().eq("id", id);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  invalidateHomepageCache(req.tenantId);
  res.json({ success: true });
});

export default router;
