import { Router, type IRouter } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePlanFeature, requireTenant, requireRole, type AuthenticatedRequest } from "../middlewares/auth";
import { verifyJobAccess } from "../lib/verify-job-access";

const router: IRouter = Router();

const paramsSchema = z.object({
  jobId: z.string().uuid(),
});

const finalStatusOptions = [
  "Commissioned and safe to use",
  "Commissioned with advisory notes",
  "Not commissioned",
  "Isolated / not safe to use",
  "Further work required",
] as const;

const bodySchema = z.object({
  jurisdiction: z.string().optional(),
  cylinder_type: z.string().optional(),
  installation_type: z.record(z.string(), z.unknown()).optional(),
  cylinder_details: z.record(z.string(), z.unknown()).optional(),
  safety_controls: z.record(z.string(), z.unknown()).optional(),
  expansion_cold_inlet: z.record(z.string(), z.unknown()).optional(),
  discharge_pipework: z.record(z.string(), z.unknown()).optional(),
  temperature_readings: z.record(z.string(), z.unknown()).optional(),
  functional_tests: z.record(z.string(), z.unknown()).optional(),
  defects: z.record(z.string(), z.unknown()).optional(),
  form_status: z.enum(["draft", "completed"]).optional(),
  final_status: z.enum(finalStatusOptions).optional(),
  engineer_signature_data: z.string().optional(),
  customer_signature_data: z.string().optional(),
  photo_uploads: z.record(z.string(), z.unknown()).optional(),
  admin_override_note: z.string().optional(),
});

type DhwPayload = z.infer<typeof bodySchema>;

type AuditEntry = {
  at: string;
  by: string | null;
  action: string;
  note?: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isYes(v: unknown): boolean {
  return v === true || v === "yes" || v === "Yes";
}

function isFail(v: unknown): boolean {
  return v === "fail" || v === "Fail" || v === false;
}

function isPresent(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as Record<string, unknown>).length > 0;
  return true;
}

function toRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function hasFileRef(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const rec = v as Record<string, unknown>;
  return !!str(rec.id) || !!str(rec.signed_url) || !!str(rec.url);
}

function appendAudit(existing: unknown, entry: AuditEntry): AuditEntry[] {
  const list = Array.isArray(existing) ? (existing as AuditEntry[]) : [];
  return [...list, entry];
}

function validatePayload(payload: DhwPayload): string[] {
  const errors: string[] = [];

  const installation = toRecord(payload.installation_type);
  const cylinder = toRecord(payload.cylinder_details);
  const safety = toRecord(payload.safety_controls);
  const expansion = toRecord(payload.expansion_cold_inlet);
  const discharge = toRecord(payload.discharge_pipework);
  const temps = toRecord(payload.temperature_readings);
  const defects = toRecord(payload.defects);
  const photos = toRecord(payload.photo_uploads);

  const cylinderType = str(payload.cylinder_type || installation.cylinder_type);
  const isUnvented = cylinderType.toLowerCase() === "unvented";

  const requiredTopLevelOnComplete = [
    ["jurisdiction", payload.jurisdiction || installation.jurisdiction],
    ["cylinder_type", cylinderType],
    ["final_status", payload.final_status],
    ["engineer_signature_data", payload.engineer_signature_data],
  ] as const;

  if (payload.form_status === "completed") {
    for (const [name, value] of requiredTopLevelOnComplete) {
      if (!isPresent(value)) errors.push(`${name} is required to complete this form`);
    }

    const mandatoryCylinderFields = [
      ["manufacturer", cylinder.manufacturer],
      ["model", cylinder.model],
      ["serial_number", cylinder.serial_number],
      ["capacity_litres", cylinder.capacity_litres],
      ["heat_source", cylinder.heat_source],
      ["max_working_pressure_bar", cylinder.max_working_pressure_bar],
      ["operating_pressure_bar", cylinder.operating_pressure_bar],
      ["manufacturer_instructions_available", cylinder.manufacturer_instructions_available],
    ] as const;

    for (const [name, value] of mandatoryCylinderFields) {
      if (!isPresent(value)) errors.push(`cylinder_details.${name} is required`);
    }

    if (!hasFileRef(photos.cylinder_data_plate)) {
      errors.push("Cylinder data plate photo is required");
    }

    if (isUnvented) {
      if (!hasFileRef(photos.tundish_photo)) errors.push("Tundish photo is required for unvented cylinders");
      if (!hasFileRef(photos.discharge_termination_photo)) errors.push("Discharge termination photo is required for unvented cylinders");

      const mandatorySafetyFields = [
        "cylinder_thermostat",
        "thermal_cut_out",
        "tp_relief_valve",
        "no_isolation_valve_before_relief",
        "safety_valves_manually_tested",
      ];
      const mandatoryExpansionFields = [
        "incoming_static_pressure_bar",
        "expansion_method",
        "no_leaks",
      ];
      const mandatoryDischargeFields = [
        "tundish_fitted",
        "tundish_visible_positioned",
        "d2_continuous_fall",
        "d2_terminates_safely",
      ];

      for (const k of mandatorySafetyFields) if (!isPresent(safety[k])) errors.push(`safety_controls.${k} is required for unvented cylinders`);
      for (const k of mandatoryExpansionFields) if (!isPresent(expansion[k])) errors.push(`expansion_cold_inlet.${k} is required for unvented cylinders`);
      for (const k of mandatoryDischargeFields) if (!isPresent(discharge[k])) errors.push(`discharge_pipework.${k} is required for unvented cylinders`);
    }

    if (isYes(temps.bath_present)) {
      if (num(temps.bath_hot_water_temperature_c) == null) {
        errors.push("Bath hot water temperature is required when a bath is present");
      }
      if (str(temps.tmv_fitted).toLowerCase() === "no" && !isPresent(temps.tmv_absence_note)) {
        errors.push("A note is required when bath TMV/blending valve is not fitted");
      }
    }

    const bathTemp = num(temps.bath_hot_water_temperature_c);
    if (bathTemp != null && bathTemp > 48 && !isPresent(defects.defect_notes)) {
      errors.push("Defect notes are required when bath temperature is above 48C");
    }

    const safetyCriticalFailures = [
      safety.cylinder_thermostat,
      safety.thermal_cut_out,
      safety.immersion_thermostat_overheat,
      safety.motorised_valve_operation,
      safety.tp_relief_valve,
      safety.expansion_relief_valve,
      safety.no_isolation_valve_before_relief,
      safety.safety_valves_manually_tested,
      discharge.d2_terminates_safely,
      toRecord(payload.functional_tests).safety_valves_tested,
      toRecord(payload.functional_tests).no_leaks_after_heat_up,
      toRecord(payload.functional_tests).no_unwanted_discharge,
    ];

    const hasSafetyFailure = safetyCriticalFailures.some(isFail);
    if (hasSafetyFailure && !isPresent(defects.defect_notes)) {
      errors.push("Defect notes are required when any safety-critical item fails");
    }

    const severity = str(defects.defect_severity);
    const resolved = isYes(defects.resolved);
    if ((severity === "Safety issue" || severity === "Immediate danger / do not use") && !resolved) {
      if (payload.final_status === "Commissioned and safe to use") {
        errors.push("Final status cannot be 'Commissioned and safe to use' while unresolved safety issues remain");
      }
    }

    if (payload.final_status === "Commissioned and safe to use") {
      if (hasSafetyFailure) {
        errors.push("Final status cannot be 'Commissioned and safe to use' when mandatory safety checks have failed");
      }
      if (isFail(discharge.d2_terminates_safely)) {
        errors.push("Final status cannot be 'Commissioned and safe to use' when D2 discharge termination is unsafe");
      }
    }
  }

  return errors;
}

router.get("/jobs/:jobId/dhw-cylinder-commissioning", requireAuth, requireTenant, requirePlanFeature("commissioning_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  let recQ = supabaseAdmin.from("dhw_cylinder_commissioning_records").select("*").eq("job_id", params.data.jobId);
  if (req.tenantId) recQ = recQ.eq("tenant_id", req.tenantId);

  const { data, error } = await recQ.maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data || null);
});

router.post("/jobs/:jobId/dhw-cylinder-commissioning", requireAuth, requireTenant, requirePlanFeature("commissioning_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const parsed = bodySchema.safeParse(req.body || {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let jobQ = supabaseAdmin.from("jobs").select("id, customer_id").eq("id", params.data.jobId);
  if (req.tenantId) jobQ = jobQ.eq("tenant_id", req.tenantId);
  const { data: job, error: jobErr } = await jobQ.maybeSingle();
  if (jobErr || !job) { res.status(404).json({ error: "Job not found" }); return; }

  let existingQ = supabaseAdmin.from("dhw_cylinder_commissioning_records").select("id").eq("job_id", params.data.jobId);
  if (req.tenantId) existingQ = existingQ.eq("tenant_id", req.tenantId);
  const { data: existing } = await existingQ.maybeSingle();
  if (existing) { res.status(409).json({ error: "DHW commissioning record already exists for this job" }); return; }

  const payload = parsed.data;
  const validationErrors = validatePayload(payload);
  if (validationErrors.length > 0) {
    res.status(400).json({ error: "Validation failed", details: validationErrors });
    return;
  }

  const now = new Date().toISOString();
  const shouldLock = payload.form_status === "completed";

  const insertData: Record<string, unknown> = {
    tenant_id: req.tenantId,
    job_id: params.data.jobId,
    customer_id: (job as { customer_id: string }).customer_id,
    engineer_id: req.userId,
    company_id: req.tenantId,
    form_status: payload.form_status || "draft",
    jurisdiction: payload.jurisdiction || null,
    cylinder_type: payload.cylinder_type || null,
    installation_type: payload.installation_type || {},
    cylinder_details: payload.cylinder_details || {},
    safety_controls: payload.safety_controls || {},
    expansion_cold_inlet: payload.expansion_cold_inlet || {},
    discharge_pipework: payload.discharge_pipework || {},
    temperature_readings: payload.temperature_readings || {},
    functional_tests: payload.functional_tests || {},
    defects: payload.defects || {},
    final_status: payload.final_status || null,
    engineer_signature_data: payload.engineer_signature_data || null,
    customer_signature_data: payload.customer_signature_data || null,
    photo_uploads: payload.photo_uploads || {},
    pdf_url: shouldLock ? `/api/jobs/${params.data.jobId}/forms/dhw_cylinder_commissioning_record/__ID__/pdf` : null,
    completed_at: shouldLock ? now : null,
    locked: shouldLock,
    audit_log: appendAudit([], {
      at: now,
      by: req.userId || null,
      action: shouldLock ? "completed_and_locked" : "created_draft",
    }),
  };

  const { data, error } = await supabaseAdmin
    .from("dhw_cylinder_commissioning_records")
    .insert(insertData)
    .select("*")
    .single();

  if (error || !data) { res.status(500).json({ error: error?.message || "Insert failed" }); return; }

  if (shouldLock) {
    const realPdfUrl = `/api/jobs/${params.data.jobId}/forms/dhw_cylinder_commissioning_record/${(data as { id: string }).id}/pdf`;
    await supabaseAdmin
      .from("dhw_cylinder_commissioning_records")
      .update({ pdf_url: realPdfUrl })
      .eq("id", (data as { id: string }).id);
    (data as Record<string, unknown>).pdf_url = realPdfUrl;
  }

  res.status(201).json(data);
});

router.patch("/jobs/:jobId/dhw-cylinder-commissioning", requireAuth, requireTenant, requirePlanFeature("commissioning_forms"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const parsed = bodySchema.safeParse(req.body || {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const adminOverride = String(req.query.adminOverride || "").toLowerCase() === "true";
  if (adminOverride && req.userRole !== "admin" && req.userRole !== "super_admin") {
    res.status(403).json({ error: "Admin override requires admin role" });
    return;
  }

  let recQ = supabaseAdmin.from("dhw_cylinder_commissioning_records").select("*").eq("job_id", params.data.jobId);
  if (req.tenantId) recQ = recQ.eq("tenant_id", req.tenantId);
  const { data: existing, error: existingErr } = await recQ.maybeSingle();
  if (existingErr) { res.status(500).json({ error: existingErr.message }); return; }
  if (!existing) { res.status(404).json({ error: "No DHW commissioning record found for this job" }); return; }

  const existingRecord = existing as Record<string, unknown>;
  if (existingRecord.locked && !adminOverride) {
    res.status(423).json({ error: "This record is locked. Admin override is required to edit." });
    return;
  }

  const merged: DhwPayload = {
    jurisdiction: str(parsed.data.jurisdiction ?? existingRecord.jurisdiction),
    cylinder_type: str(parsed.data.cylinder_type ?? existingRecord.cylinder_type),
    installation_type: toRecord(parsed.data.installation_type ?? existingRecord.installation_type),
    cylinder_details: toRecord(parsed.data.cylinder_details ?? existingRecord.cylinder_details),
    safety_controls: toRecord(parsed.data.safety_controls ?? existingRecord.safety_controls),
    expansion_cold_inlet: toRecord(parsed.data.expansion_cold_inlet ?? existingRecord.expansion_cold_inlet),
    discharge_pipework: toRecord(parsed.data.discharge_pipework ?? existingRecord.discharge_pipework),
    temperature_readings: toRecord(parsed.data.temperature_readings ?? existingRecord.temperature_readings),
    functional_tests: toRecord(parsed.data.functional_tests ?? existingRecord.functional_tests),
    defects: toRecord(parsed.data.defects ?? existingRecord.defects),
    final_status: (parsed.data.final_status ?? existingRecord.final_status) as DhwPayload["final_status"],
    form_status: (parsed.data.form_status ?? existingRecord.form_status) as DhwPayload["form_status"],
    engineer_signature_data: str(parsed.data.engineer_signature_data ?? existingRecord.engineer_signature_data),
    customer_signature_data: str(parsed.data.customer_signature_data ?? existingRecord.customer_signature_data),
    photo_uploads: toRecord(parsed.data.photo_uploads ?? existingRecord.photo_uploads),
    admin_override_note: parsed.data.admin_override_note,
  };

  const validationErrors = validatePayload(merged);
  if (validationErrors.length > 0) {
    res.status(400).json({ error: "Validation failed", details: validationErrors });
    return;
  }

  const now = new Date().toISOString();
  const becomingComplete = merged.form_status === "completed";
  const auditEntry: AuditEntry = {
    at: now,
    by: req.userId || null,
    action: adminOverride ? "admin_override_edit" : becomingComplete ? "completed_and_locked" : "updated",
    note: parsed.data.admin_override_note,
  };

  const updateData: Record<string, unknown> = {
    jurisdiction: merged.jurisdiction || null,
    cylinder_type: merged.cylinder_type || null,
    installation_type: merged.installation_type || {},
    cylinder_details: merged.cylinder_details || {},
    safety_controls: merged.safety_controls || {},
    expansion_cold_inlet: merged.expansion_cold_inlet || {},
    discharge_pipework: merged.discharge_pipework || {},
    temperature_readings: merged.temperature_readings || {},
    functional_tests: merged.functional_tests || {},
    defects: merged.defects || {},
    final_status: merged.final_status || null,
    form_status: merged.form_status || "draft",
    engineer_signature_data: merged.engineer_signature_data || null,
    customer_signature_data: merged.customer_signature_data || null,
    photo_uploads: merged.photo_uploads || {},
    completed_at: becomingComplete ? (existingRecord.completed_at || now) : null,
    locked: becomingComplete,
    pdf_url: becomingComplete
      ? `/api/jobs/${params.data.jobId}/forms/dhw_cylinder_commissioning_record/${existingRecord.id as string}/pdf`
      : null,
    audit_log: appendAudit(existingRecord.audit_log, auditEntry),
  };

  const { data, error } = await supabaseAdmin
    .from("dhw_cylinder_commissioning_records")
    .update(updateData)
    .eq("id", existingRecord.id as string)
    .select("*")
    .single();

  if (error || !data) { res.status(500).json({ error: error?.message || "Update failed" }); return; }
  res.json(data);
});

router.post("/jobs/:jobId/dhw-cylinder-commissioning/admin-unlock", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  const note = typeof req.body?.note === "string" ? req.body.note : "";

  let recQ = supabaseAdmin.from("dhw_cylinder_commissioning_records").select("id, audit_log").eq("job_id", params.data.jobId);
  if (req.tenantId) recQ = recQ.eq("tenant_id", req.tenantId);
  const { data: existing } = await recQ.maybeSingle();
  if (!existing) { res.status(404).json({ error: "No DHW commissioning record found for this job" }); return; }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("dhw_cylinder_commissioning_records")
    .update({
      locked: false,
      form_status: "draft",
      audit_log: appendAudit((existing as Record<string, unknown>).audit_log, {
        at: now,
        by: req.userId || null,
        action: "admin_unlock",
        note,
      }),
    })
    .eq("id", (existing as { id: string }).id)
    .select("*")
    .single();

  if (error || !data) { res.status(500).json({ error: error?.message || "Unlock failed" }); return; }
  res.json(data);
});

router.delete("/jobs/:jobId/dhw-cylinder-commissioning/:id", requireAuth, requireTenant, requireRole("admin"), async (req: AuthenticatedRequest, res): Promise<void> => {
  const params = paramsSchema.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const access = await verifyJobAccess(req, params.data.jobId);
  if (!access.allowed) { res.status(403).json({ error: access.error }); return; }

  let q = supabaseAdmin
    .from("dhw_cylinder_commissioning_records")
    .delete()
    .eq("id", req.params.id)
    .eq("job_id", params.data.jobId);
  if (req.tenantId) q = q.eq("tenant_id", req.tenantId);

  const { error } = await q;
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ success: true });
});

export default router;
