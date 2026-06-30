import { supabaseAdmin } from "./supabase";
import { sendPushToUser } from "./push-notifications";

export const PUSH_EVENT_TYPES = [
  "appointment_due",
  "appointment_overdue",
  "assignment_changes",
  "blocking_status_changes",
  "customer_communications",
  "payment_alerts",
  "sla_breach_risk",
  "maintenance_lifecycle",
  "operational_exceptions",
  "system_reliability",
] as const;

export type PushEventType = (typeof PUSH_EVENT_TYPES)[number];

type PushPreferenceRecord = Record<PushEventType, boolean>;

type PushEventMeta = {
  key: PushEventType;
  label: string;
  description: string;
};

const EVENT_META: PushEventMeta[] = [
  { key: "appointment_due", label: "Appointment Due", description: "A job, enquiry, or follow-up is due soon." },
  { key: "appointment_overdue", label: "Appointment Overdue", description: "A job, enquiry, or follow-up is now overdue." },
  { key: "assignment_changes", label: "Assignment Changes", description: "A job or follow-up assignment changed." },
  { key: "blocking_status_changes", label: "Blocking Status Changes", description: "Status changed to a blocking state like awaiting parts or cancelled." },
  { key: "customer_communications", label: "Customer Communications", description: "New customer communications like enquiries and missed calls." },
  { key: "payment_alerts", label: "Payment Alerts", description: "Invoice sent/paid and related commercial updates." },
  { key: "sla_breach_risk", label: "SLA Breach Risk", description: "Urgent work risks missing expected response times." },
  { key: "maintenance_lifecycle", label: "Maintenance Lifecycle", description: "Maintenance reminders and lifecycle updates." },
  { key: "operational_exceptions", label: "Operational Exceptions", description: "Operational exceptions that need attention." },
  { key: "system_reliability", label: "System Reliability", description: "Provider or integration reliability issues." },
];

const EVENT_COLUMN_MAP: Record<PushEventType, string> = {
  appointment_due: "appointment_due_enabled",
  appointment_overdue: "appointment_overdue_enabled",
  assignment_changes: "assignment_changes_enabled",
  blocking_status_changes: "blocking_status_changes_enabled",
  customer_communications: "customer_communications_enabled",
  payment_alerts: "payment_alerts_enabled",
  sla_breach_risk: "sla_breach_risk_enabled",
  maintenance_lifecycle: "maintenance_lifecycle_enabled",
  operational_exceptions: "operational_exceptions_enabled",
  system_reliability: "system_reliability_enabled",
};

type TenantUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
};

type TenantUserPrefRow = {
  user_id: string;
  appointment_due_enabled?: boolean | null;
  appointment_overdue_enabled?: boolean | null;
  assignment_changes_enabled?: boolean | null;
  blocking_status_changes_enabled?: boolean | null;
  customer_communications_enabled?: boolean | null;
  payment_alerts_enabled?: boolean | null;
  sla_breach_risk_enabled?: boolean | null;
  maintenance_lifecycle_enabled?: boolean | null;
  operational_exceptions_enabled?: boolean | null;
  system_reliability_enabled?: boolean | null;
};

function defaultPreferences(): PushPreferenceRecord {
  return {
    appointment_due: true,
    appointment_overdue: true,
    assignment_changes: true,
    blocking_status_changes: true,
    customer_communications: true,
    payment_alerts: true,
    sla_breach_risk: true,
    maintenance_lifecycle: true,
    operational_exceptions: true,
    system_reliability: true,
  };
}

function coercePreferences(row: TenantUserPrefRow | null | undefined): PushPreferenceRecord {
  const defaults = defaultPreferences();
  if (!row) return defaults;

  return {
    appointment_due: row.appointment_due_enabled ?? defaults.appointment_due,
    appointment_overdue: row.appointment_overdue_enabled ?? defaults.appointment_overdue,
    assignment_changes: row.assignment_changes_enabled ?? defaults.assignment_changes,
    blocking_status_changes: row.blocking_status_changes_enabled ?? defaults.blocking_status_changes,
    customer_communications: row.customer_communications_enabled ?? defaults.customer_communications,
    payment_alerts: row.payment_alerts_enabled ?? defaults.payment_alerts,
    sla_breach_risk: row.sla_breach_risk_enabled ?? defaults.sla_breach_risk,
    maintenance_lifecycle: row.maintenance_lifecycle_enabled ?? defaults.maintenance_lifecycle,
    operational_exceptions: row.operational_exceptions_enabled ?? defaults.operational_exceptions,
    system_reliability: row.system_reliability_enabled ?? defaults.system_reliability,
  };
}

export function getPushEventMeta(): PushEventMeta[] {
  return EVENT_META;
}

export async function listTenantUsersWithPushPreferences(tenantId: string): Promise<Array<{
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string | null;
  isActive: boolean;
  preferences: PushPreferenceRecord;
}>> {
  const { data: users, error: usersError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (usersError) {
    throw new Error(usersError.message);
  }

  const { data: prefRows, error: prefError } = await supabaseAdmin
    .from("tenant_user_push_preferences")
    .select("user_id, appointment_due_enabled, appointment_overdue_enabled, assignment_changes_enabled, blocking_status_changes_enabled, customer_communications_enabled, payment_alerts_enabled, sla_breach_risk_enabled, maintenance_lifecycle_enabled, operational_exceptions_enabled, system_reliability_enabled")
    .eq("tenant_id", tenantId);

  if (prefError) {
    // If the preferences table has not been provisioned yet, still show the
    // tenant's users with default preferences instead of breaking the whole UI.
    if ((prefError as { code?: string }).code !== "42P01") {
      throw new Error(prefError.message);
    }
    console.warn("[push-events] tenant_user_push_preferences missing; falling back to defaults");
  }

  const prefMap = new Map<string, TenantUserPrefRow>();
  for (const row of (prefRows ?? []) as TenantUserPrefRow[]) {
    prefMap.set(row.user_id, row);
  }

  return ((users ?? []) as TenantUser[]).map((u) => ({
    userId: u.id,
    fullName: u.full_name,
    email: u.email,
    role: u.role,
    isActive: u.is_active !== false,
    preferences: coercePreferences(prefMap.get(u.id)),
  }));
}

export async function upsertTenantUserPushPreferences(
  tenantId: string,
  userId: string,
  updates: Partial<PushPreferenceRecord>
): Promise<PushPreferenceRecord> {
  const dbUpdate: Record<string, unknown> = {
    tenant_id: tenantId,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  for (const [eventType, enabled] of Object.entries(updates) as Array<[PushEventType, boolean | undefined]>) {
    if (enabled === undefined) continue;
    dbUpdate[EVENT_COLUMN_MAP[eventType]] = !!enabled;
  }

  const { data, error } = await supabaseAdmin
    .from("tenant_user_push_preferences")
    .upsert(dbUpdate, { onConflict: "tenant_id,user_id" })
    .select("appointment_due_enabled, appointment_overdue_enabled, assignment_changes_enabled, blocking_status_changes_enabled, customer_communications_enabled, payment_alerts_enabled, sla_breach_risk_enabled, maintenance_lifecycle_enabled, operational_exceptions_enabled, system_reliability_enabled")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return coercePreferences(data as TenantUserPrefRow);
}

async function shouldDispatchByEventKey(
  tenantId: string,
  userId: string,
  eventType: PushEventType,
  eventKey: string | undefined
): Promise<boolean> {
  if (!eventKey) return true;

  const { error } = await supabaseAdmin
    .from("push_notification_dispatch_log")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      event_type: eventType,
      event_key: eventKey,
    });

  if (!error) return true;
  if ((error as { code?: string }).code === "23505") return false;

  console.error("[push-events] Failed to write dispatch log:", error.message);
  return false;
}

export async function notifyUsersForEvent(opts: {
  tenantId: string;
  eventType: PushEventType;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
  eventKey?: string;
  targetUserIds?: string[];
  targetRoles?: string[];
}): Promise<void> {
  const users = await listTenantUsersWithPushPreferences(opts.tenantId);
  const targetUserSet = opts.targetUserIds ? new Set(opts.targetUserIds) : null;
  const targetRoleSet = opts.targetRoles ? new Set(opts.targetRoles) : null;

  const recipients = users.filter((u) => {
    if (!u.isActive) return false;
    if (!u.preferences[opts.eventType]) return false;
    if (targetUserSet && !targetUserSet.has(u.userId)) return false;
    if (targetRoleSet && !targetRoleSet.has(u.role || "")) return false;
    return true;
  });

  await Promise.all(
    recipients.map(async (recipient) => {
      const allowed = await shouldDispatchByEventKey(
        opts.tenantId,
        recipient.userId,
        opts.eventType,
        opts.eventKey
      );
      if (!allowed) return;

      await sendPushToUser(opts.tenantId, recipient.userId, {
        title: opts.title,
        body: opts.body,
        url: opts.url,
        tag: opts.eventType,
        data: {
          eventType: opts.eventType,
          ...(opts.data || {}),
        },
      });
    })
  );
}

function parseDateTime(dateStr: string | null, timeStr: string | null): Date | null {
  if (!dateStr) return null;
  const time = timeStr && /^\d{2}:\d{2}/.test(timeStr) ? `${timeStr}:00` : "09:00:00";
  const dt = new Date(`${dateStr}T${time}`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

async function scanAppointmentsAndSla(): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("id, tenant_id, assigned_technician_id, scheduled_date, scheduled_time, status, priority, job_ref")
    .in("status", ["scheduled", "in_progress", "requires_follow_up", "awaiting_parts"])
    .not("scheduled_date", "is", null);

  for (const job of (jobs ?? []) as Array<Record<string, unknown>>) {
    const tenantId = String(job.tenant_id || "");
    if (!tenantId) continue;

    const dueAt = parseDateTime(job.scheduled_date as string | null, job.scheduled_time as string | null);
    if (!dueAt) continue;

    const diffMs = dueAt.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const jobRef = (job.job_ref as string | null) || String(job.id);
    const assignee = job.assigned_technician_id as string | null;

    if (diffMins >= 0 && diffMins <= 60) {
      await notifyUsersForEvent({
        tenantId,
        eventType: "appointment_due",
        title: "Appointment Due Soon",
        body: `Job ${jobRef} is due in ${Math.max(diffMins, 0)} minutes.`,
        url: `/jobs/${job.id}`,
        eventKey: `job_due:${job.id}:${job.scheduled_date}:${job.scheduled_time}`,
        targetUserIds: assignee ? [assignee] : undefined,
        targetRoles: assignee ? undefined : ["admin", "office_staff"],
        data: { jobId: job.id },
      });
    }

    if ((job.scheduled_date as string) < today) {
      await notifyUsersForEvent({
        tenantId,
        eventType: "appointment_overdue",
        title: "Appointment Overdue",
        body: `Job ${jobRef} is overdue and still active.`,
        url: `/jobs/${job.id}`,
        eventKey: `job_overdue:${job.id}:${today}`,
        targetRoles: ["admin", "office_staff"],
        data: { jobId: job.id },
      });
    }

    const priority = String(job.priority || "medium");
    if (["high", "urgent"].includes(priority) && !assignee && (job.scheduled_date as string) <= today) {
      await notifyUsersForEvent({
        tenantId,
        eventType: "sla_breach_risk",
        title: "SLA Risk",
        body: `High priority job ${jobRef} has no assigned technician.`,
        url: `/jobs/${job.id}`,
        eventKey: `sla_job_unassigned:${job.id}:${today}`,
        targetRoles: ["admin", "office_staff"],
        data: { jobId: job.id, priority },
      });
    }
  }

  const { data: followUps } = await supabaseAdmin
    .from("follow_ups")
    .select("id, tenant_id, expected_parts_date, status")
    .eq("status", "awaiting_parts")
    .not("expected_parts_date", "is", null);

  for (const followUp of (followUps ?? []) as Array<Record<string, unknown>>) {
    const tenantId = String(followUp.tenant_id || "");
    const expectedDate = String(followUp.expected_parts_date || "");
    if (!tenantId || !expectedDate) continue;

    if (expectedDate === today) {
      await notifyUsersForEvent({
        tenantId,
        eventType: "appointment_due",
        title: "Follow-up Due Today",
        body: `Follow-up ${followUp.id} is due today.`,
        url: "/follow-ups",
        eventKey: `followup_due:${followUp.id}:${today}`,
        targetRoles: ["admin", "office_staff"],
        data: { followUpId: followUp.id },
      });
    } else if (expectedDate < today) {
      await notifyUsersForEvent({
        tenantId,
        eventType: "appointment_overdue",
        title: "Follow-up Overdue",
        body: `Follow-up ${followUp.id} is overdue.`,
        url: "/follow-ups",
        eventKey: `followup_overdue:${followUp.id}:${today}`,
        targetRoles: ["admin", "office_staff"],
        data: { followUpId: followUp.id },
      });
    }
  }

  const { data: enquiries } = await supabaseAdmin
    .from("enquiries")
    .select("id, tenant_id, contact_name, status, priority, created_at")
    .eq("status", "new");

  for (const enquiry of (enquiries ?? []) as Array<Record<string, unknown>>) {
    const tenantId = String(enquiry.tenant_id || "");
    if (!tenantId) continue;

    const createdAt = new Date(String(enquiry.created_at || ""));
    if (Number.isNaN(createdAt.getTime())) continue;

    const ageHours = (now.getTime() - createdAt.getTime()) / 3600000;
    const contactName = String(enquiry.contact_name || "Customer");

    if (ageHours >= 2 && ageHours < 24) {
      await notifyUsersForEvent({
        tenantId,
        eventType: "appointment_due",
        title: "Enquiry Needs Response",
        body: `${contactName} enquiry needs follow-up today.`,
        url: `/enquiries/${enquiry.id}`,
        eventKey: `enquiry_due:${enquiry.id}`,
        targetRoles: ["admin", "office_staff"],
        data: { enquiryId: enquiry.id },
      });
    }

    if (ageHours >= 24) {
      await notifyUsersForEvent({
        tenantId,
        eventType: "appointment_overdue",
        title: "Enquiry Overdue",
        body: `${contactName} enquiry is overdue for response.`,
        url: `/enquiries/${enquiry.id}`,
        eventKey: `enquiry_overdue:${enquiry.id}:${today}`,
        targetRoles: ["admin", "office_staff"],
        data: { enquiryId: enquiry.id },
      });
    }

    const priority = String(enquiry.priority || "medium");
    if (["high", "urgent"].includes(priority) && ageHours >= 1) {
      await notifyUsersForEvent({
        tenantId,
        eventType: "sla_breach_risk",
        title: "Urgent Enquiry SLA Risk",
        body: `${contactName} enquiry is approaching SLA risk.`,
        url: `/enquiries/${enquiry.id}`,
        eventKey: `sla_enquiry:${enquiry.id}:${today}`,
        targetRoles: ["admin", "office_staff"],
        data: { enquiryId: enquiry.id, priority },
      });
    }
  }

  const { data: reminders } = await supabaseAdmin
    .from("service_reminders")
    .select("id, tenant_id, due_date, status")
    .eq("status", "pending")
    .eq("due_date", today);

  for (const reminder of (reminders ?? []) as Array<Record<string, unknown>>) {
    const tenantId = String(reminder.tenant_id || "");
    if (!tenantId) continue;

    await notifyUsersForEvent({
      tenantId,
      eventType: "maintenance_lifecycle",
      title: "Maintenance Reminder Due",
      body: `A service reminder is due today.`,
      url: "/maintenance",
      eventKey: `maintenance_due:${reminder.id}:${today}`,
      targetRoles: ["admin", "office_staff"],
      data: { reminderId: reminder.id },
    });
  }
}

let schedulerHandle: NodeJS.Timeout | null = null;

export async function runPushEventScans(): Promise<void> {
  await scanAppointmentsAndSla();
}

export function startPushEventScheduler(): void {
  if (process.env.PUSH_NOTIFICATION_SCHEDULER === "false") {
    console.log("[push-events] Scheduler disabled via PUSH_NOTIFICATION_SCHEDULER=false");
    return;
  }
  if (schedulerHandle) return;

  const run = async () => {
    try {
      await runPushEventScans();
    } catch (err) {
      console.error("[push-events] Scheduler run failed:", (err as Error).message);
    }
  };

  // Initial run shortly after startup, then every 10 minutes.
  setTimeout(() => {
    void run();
  }, 20_000);

  schedulerHandle = setInterval(() => {
    void run();
  }, 10 * 60 * 1000);

  console.log("[push-events] Scheduler started (interval: 10 minutes)");
}

export function stopPushEventScheduler(): void {
  if (!schedulerHandle) return;
  clearInterval(schedulerHandle);
  schedulerHandle = null;
}
