import { sendSimpleNotification, type EmailCompanyDetails } from "./email";
import { supabaseAdmin } from "./supabase";

const SINGLETON_ID = "default";
const ACTIVE_JOB_STATUSES = ["scheduled", "in_progress", "requires_follow_up", "awaiting_parts"];
const SCHEDULER_POLL_MS = 60_000;
const SUMMARY_TIMEZONE = "Europe/London";

let schedulerTimer: NodeJS.Timeout | null = null;
let schedulerRunning = false;

function toTimeZoneDateParts(now: Date): { today: string; tomorrow: string; hhmm: string } {
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: SUMMARY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SUMMARY_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dateParts = dateFormatter.formatToParts(now);
  const year = Number(dateParts.find((p) => p.type === "year")?.value || "0");
  const month = Number(dateParts.find((p) => p.type === "month")?.value || "0");
  const day = Number(dateParts.find((p) => p.type === "day")?.value || "0");

  const today = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const tomorrowUtc = new Date(Date.UTC(year, month - 1, day + 1));
  const tomorrow = `${tomorrowUtc.getUTCFullYear()}-${String(tomorrowUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrowUtc.getUTCDate()).padStart(2, "0")}`;

  const timeParts = timeFormatter.formatToParts(now);
  const hh = timeParts.find((p) => p.type === "hour")?.value || "00";
  const mm = timeParts.find((p) => p.type === "minute")?.value || "00";
  return { today, tomorrow, hhmm: `${hh}:${mm}` };
}

export function isSummaryTimeDue(configuredTime: string | null | undefined, now = new Date(), timeZone = SUMMARY_TIMEZONE): boolean {
  const raw = String(configuredTime ?? "").trim();
  if (!/^\d{2}:\d{2}$/.test(raw)) return false;

  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const timeParts = timeFormatter.formatToParts(now);
  const zoneHour = Number(timeParts.find((p) => p.type === "hour")?.value || "0");
  const zoneMinute = Number(timeParts.find((p) => p.type === "minute")?.value || "0");
  const nowMinutes = zoneHour * 60 + zoneMinute;

  const [hours, minutes] = raw.split(":").map(Number);
  const configuredMinutes = (hours || 0) * 60 + (minutes || 0);
  const deltaMinutes = nowMinutes - configuredMinutes;

  return deltaMinutes >= 0;
}

function isWeekend(yyyyMmDd: string): boolean {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  const weekday = d.getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function shouldSkipTenantSummaryDispatch(args: {
  lastSentDate: string | null | undefined;
  today: string;
  tomorrow: string;
  configuredTime: string | null | undefined;
  now?: Date;
  sendIfNoJobs?: boolean;
  weekdaysOnly?: boolean;
}): boolean {
  const { lastSentDate, today, tomorrow, configuredTime, now = new Date(), sendIfNoJobs = false, weekdaysOnly = false } = args;

  if (lastSentDate === today) {
    return true;
  }

  if (!isSummaryTimeDue(configuredTime, now, SUMMARY_TIMEZONE)) {
    return true;
  }

  if (weekdaysOnly && isWeekend(tomorrow)) {
    return true;
  }

  return false;
}

function formatHumanDate(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatJobTime(time: string | null, allDay: boolean | null): string {
  if (allDay) return "All day";
  const raw = String(time || "").trim();
  if (!raw) return "Time TBC";
  return raw.slice(0, 5);
}

function formatCustomerName(customer: { first_name?: string | null; last_name?: string | null; business_name?: string | null } | null | undefined): string {
  const business = String(customer?.business_name || "").trim();
  if (business) return business;
  const full = `${String(customer?.first_name || "")} ${String(customer?.last_name || "")}`.trim();
  return full || "Customer";
}

export function buildSummaryBody(args: {
  technicianName: string;
  companyName: string;
  targetDate: string;
  jobs: Array<{
    job_ref: string | null;
    scheduled_time: string | null;
    all_day: boolean | null;
    status: string | null;
    description: string | null;
    customers?: { first_name?: string | null; last_name?: string | null; business_name?: string | null } | null;
    properties?: { address_line1?: string | null; postcode?: string | null } | null;
  }>;
}): string {
  const lines: string[] = [];
  const dateLabel = formatHumanDate(args.targetDate);
  lines.push(`Hi ${args.technicianName},`);
  lines.push("");
  lines.push(`Here is your job summary for tomorrow (${dateLabel}).`);
  lines.push("");

  for (const [index, job] of args.jobs.entries()) {
    const ref = String(job.job_ref || "").trim() || `Job ${index + 1}`;
    const customer = formatCustomerName(job.customers);
    const when = formatJobTime(job.scheduled_time, job.all_day);
    const status = String(job.status || "scheduled").replace(/_/g, " ");
    const address = String(job.properties?.address_line1 || "").trim();
    const postcode = String(job.properties?.postcode || "").trim();
    const location = [address, postcode].filter(Boolean).join(", ");

    lines.push(`${index + 1}. ${ref}`);
    lines.push(`   Time: ${when}`);
    lines.push(`   Customer: ${customer}`);
    if (location) lines.push(`   Location: ${location}`);
    if (job.description) lines.push(`   Notes: ${String(job.description).trim()}`);
    lines.push(`   Status: ${status}`);
    lines.push("");
  }

  lines.push(`Total jobs: ${args.jobs.length}`);
  lines.push("");
  lines.push(`Sent automatically by ${args.companyName} via TradeWorkDesk.`);
  return lines.join("\n");
}

export function buildNoJobsBody(args: { technicianName: string; companyName: string; targetDate: string }): string {
  const dateLabel = formatHumanDate(args.targetDate);
  return [
    `Hi ${args.technicianName},`,
    "",
    `You have no jobs scheduled for tomorrow (${dateLabel}).`,
    "",
    `Sent automatically by ${args.companyName} via TradeWorkDesk.`,
  ].join("\n");
}

export async function sendTestTechnicianDailySummaryEmail(args: {
  tenantId: string;
  to: string;
  companyDetails: EmailCompanyDetails;
}): Promise<void> {
  const companyName = String(args.companyDetails.name || args.companyDetails.trading_name || "Your Service Provider");
  const targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const formattedTargetDate = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, "0")}-${String(targetDate.getUTCDate()).padStart(2, "0")}`;

  const jobSample = [{
    job_ref: "TEST-001",
    scheduled_time: "09:00",
    all_day: false,
    status: "scheduled",
    description: "Sample boiler service visit for a test email.",
    customers: { first_name: "Test", last_name: "Technician", business_name: null },
    properties: { address_line1: "1 Sample Street", postcode: "AB1 2CD" },
  }];

  const body = buildSummaryBody({
    technicianName: "Test Technician",
    companyName,
    targetDate: formattedTargetDate,
    jobs: jobSample,
  });

  await sendSimpleNotification(args.to, `Test: Tomorrow's jobs summary - ${formatHumanDate(formattedTargetDate)}`, body, {
    companyDetails: args.companyDetails,
    tenantId: args.tenantId,
    emailType: "technician_daily_summary_test",
  });
}

export async function runTechnicianDailySummaryEmails(now = new Date()): Promise<{ processedTenants: number; sentEmails: number; skippedTechnicians: number; errors: number }> {
  const { today, tomorrow, hhmm } = toTimeZoneDateParts(now);
  const result = { processedTenants: 0, sentEmails: 0, skippedTechnicians: 0, errors: 0 };

  const { data: dueTenants, error: dueTenantsError } = await supabaseAdmin
    .from("company_settings")
    .select("tenant_id, name, trading_name, email, notification_emails, email_from_name, email_reply_to, technician_daily_summary_enabled, technician_daily_summary_time_utc, technician_daily_summary_send_if_no_jobs, technician_daily_summary_weekdays_only, technician_daily_summary_last_sent_date")
    .eq("singleton_id", SINGLETON_ID)
    .eq("technician_daily_summary_enabled", true)
    .or(`technician_daily_summary_last_sent_date.is.null,technician_daily_summary_last_sent_date.neq.${today}`);

  if (dueTenantsError) {
    console.error("[technician-summary] Failed to load due tenants:", dueTenantsError.message);
    return result;
  }

  for (const row of (dueTenants || []) as Array<Record<string, unknown>>) {
    const tenantId = String(row.tenant_id || "").trim();
    if (!tenantId) continue;

    const configuredTime = String(row.technician_daily_summary_time_utc || "").trim();
    const lastSentDate = String((row.technician_daily_summary_last_sent_date as string | null) || "").trim();
    const sendIfNoJobs = Boolean(row.technician_daily_summary_send_if_no_jobs);
    const weekdaysOnly = Boolean(row.technician_daily_summary_weekdays_only);

    if (shouldSkipTenantSummaryDispatch({
      lastSentDate,
      today,
      tomorrow,
      configuredTime,
      now,
      sendIfNoJobs,
      weekdaysOnly,
    })) {
      continue;
    }

    result.processedTenants += 1;

    const companyDetails: EmailCompanyDetails = {
      name: (row.name as string | null) || null,
      trading_name: (row.trading_name as string | null) || null,
      email: (row.email as string | null) || null,
      notification_emails: (row.notification_emails as string[] | null) || null,
      email_from_name: (row.email_from_name as string | null) || null,
      email_reply_to: (row.email_reply_to as string | null) || null,
    };

    const companyName = String(companyDetails.name || companyDetails.trading_name || "Your Service Provider");

    try {
      const { data: technicians, error: techError } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .eq("tenant_id", tenantId)
        .eq("role", "technician")
        .eq("is_active", true)
        .not("email", "is", null);

      if (techError) {
        console.error(`[technician-summary] Failed to load technicians for tenant ${tenantId}:`, techError.message);
        result.errors += 1;
        continue;
      }

      const techRows = (technicians || []) as Array<{ id: string; full_name: string | null; email: string | null }>;
      const techIds = techRows.map((t) => t.id).filter(Boolean);

      if (techIds.length === 0) {
        await supabaseAdmin
          .from("company_settings")
          .update({ technician_daily_summary_last_sent_date: today })
          .eq("tenant_id", tenantId)
          .eq("singleton_id", SINGLETON_ID);
        continue;
      }

      const { data: jobs, error: jobsError } = await supabaseAdmin
        .from("jobs")
        .select("id, job_ref, assigned_technician_id, scheduled_date, scheduled_time, all_day, status, description, customers(first_name, last_name, business_name), properties(address_line1, postcode)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("scheduled_date", tomorrow)
        .in("assigned_technician_id", techIds)
        .in("status", ACTIVE_JOB_STATUSES)
        .order("scheduled_time", { ascending: true, nullsFirst: false });

      if (jobsError) {
        console.error(`[technician-summary] Failed to load jobs for tenant ${tenantId}:`, jobsError.message);
        result.errors += 1;
        continue;
      }

      const jobsByTech = new Map<string, Array<any>>();
      for (const job of jobs || []) {
        const key = String((job as { assigned_technician_id?: string | null }).assigned_technician_id || "");
        if (!key) continue;
        const bucket = jobsByTech.get(key) || [];
        bucket.push(job);
        jobsByTech.set(key, bucket);
      }

      for (const tech of techRows) {
        const to = String(tech.email || "").trim().toLowerCase();
        if (!to) {
          result.skippedTechnicians += 1;
          continue;
        }

        const techJobs = jobsByTech.get(tech.id) || [];
        if (techJobs.length === 0) {
          if (!sendIfNoJobs) {
            result.skippedTechnicians += 1;
            continue;
          }

          const technicianName = String(tech.full_name || "Technician");
          const subject = `No jobs scheduled for tomorrow - ${formatHumanDate(tomorrow)}`;
          const body = buildNoJobsBody({
            technicianName,
            companyName,
            targetDate: tomorrow,
          });

          await sendSimpleNotification(to, subject, body, {
            companyDetails,
            tenantId,
            emailType: "technician_daily_summary",
          });
          result.sentEmails += 1;
          continue;
        }

        const technicianName = String(tech.full_name || "Technician");
        const subject = `Tomorrow's jobs summary - ${formatHumanDate(tomorrow)}`;
        const body = buildSummaryBody({
          technicianName,
          companyName,
          targetDate: tomorrow,
          jobs: techJobs,
        });

        await sendSimpleNotification(to, subject, body, {
          companyDetails,
          tenantId,
          emailType: "technician_daily_summary",
        });
        result.sentEmails += 1;
      }

      await supabaseAdmin
        .from("company_settings")
        .update({ technician_daily_summary_last_sent_date: today })
        .eq("tenant_id", tenantId)
        .eq("singleton_id", SINGLETON_ID);
    } catch (error) {
      console.error(`[technician-summary] Unhandled tenant failure (${tenantId}):`, error);
      result.errors += 1;
    }
  }

  if (result.processedTenants > 0) {
    console.log(`[technician-summary] Completed run @ ${hhmm} ${SUMMARY_TIMEZONE}: tenants=${result.processedTenants}, sent=${result.sentEmails}, skipped=${result.skippedTechnicians}, errors=${result.errors}`);
  }

  return result;
}

export function startTechnicianDailySummaryScheduler(): void {
  if (process.env.TECHNICIAN_DAILY_SUMMARY_SCHEDULER === "false") {
    console.log("[technician-summary] Disabled (TECHNICIAN_DAILY_SUMMARY_SCHEDULER=false)");
    return;
  }

  if (schedulerTimer) return;

  const tick = async () => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    try {
      await runTechnicianDailySummaryEmails();
    } catch (error) {
      console.error("[technician-summary] Scheduler tick failed:", error);
    } finally {
      schedulerRunning = false;
    }
  };

  schedulerTimer = setInterval(() => {
    void tick();
  }, SCHEDULER_POLL_MS);

  // First check shortly after startup to avoid waiting a full minute.
  setTimeout(() => {
    void tick();
  }, 10_000);

  console.log("[technician-summary] Scheduler started (checks every minute)");
}

export function stopTechnicianDailySummaryScheduler(): void {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
}
