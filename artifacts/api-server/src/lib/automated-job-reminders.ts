import { sendSimpleNotification, type EmailCompanyDetails } from "./email";
import { supabaseAdmin } from "./supabase";

const TIME_ZONE = "Europe/London";
const ACTIVE_STATUSES = ["scheduled", "in_progress", "requires_follow_up", "awaiting_parts"];

type DateParts = { today: string; hhmm: string };

function londonParts(now: Date): DateParts {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  return { today: date, hhmm: time };
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export async function runAutomatedJobReminders(now = new Date()): Promise<{ processedTenants: number; sentEmails: number; skipped: number; errors: number }> {
  const result = { processedTenants: 0, sentEmails: 0, skipped: 0, errors: 0 };
  const { today, hhmm } = londonParts(now);
  const { data: settingsRows, error: settingsError } = await supabaseAdmin
    .from("company_settings")
    .select("tenant_id, name, trading_name, email, notification_emails, email_from_name, email_reply_to, job_reminders_enabled, job_reminder_lead_days, job_reminder_time_uk, job_reminder_weekdays_only")
    .eq("singleton_id", "default")
    .eq("job_reminders_enabled", true);

  if (settingsError) throw new Error(settingsError.message);

  for (const settings of (settingsRows || []) as Array<Record<string, unknown>>) {
    const tenantId = String(settings.tenant_id || "");
    const configuredTime = String(settings.job_reminder_time_uk || "09:00");
    if (!tenantId || hhmm < configuredTime) continue;
    result.processedTenants += 1;

    const leadDays = Array.from(new Set((Array.isArray(settings.job_reminder_lead_days) ? settings.job_reminder_lead_days : [7, 1])
      .map(Number).filter((days) => Number.isInteger(days) && days > 0 && days <= 365))).sort((a, b) => b - a);
    const weekdaysOnly = Boolean(settings.job_reminder_weekdays_only);
    const companyDetails: EmailCompanyDetails = {
      name: (settings.name as string | null) || null,
      trading_name: (settings.trading_name as string | null) || null,
      email: (settings.email as string | null) || null,
      notification_emails: (settings.notification_emails as string[] | null) || null,
      email_from_name: (settings.email_from_name as string | null) || null,
      email_reply_to: (settings.email_reply_to as string | null) || null,
    };
    const companyName = String(settings.name || settings.trading_name || "Your Service Provider");

    for (const leadDaysValue of leadDays) {
      const targetDate = addDays(today, leadDaysValue);
      if (weekdaysOnly && isWeekend(targetDate)) continue;
      const { data: jobs, error: jobsError } = await supabaseAdmin
        .from("jobs")
        .select("id, job_ref, scheduled_date, scheduled_time, description, customers(first_name, last_name, business_name, email), properties(address_line1, city, postcode)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("scheduled_date", targetDate)
        .in("status", ACTIVE_STATUSES);
      if (jobsError) { result.errors += 1; continue; }

      for (const job of (jobs || []) as Array<Record<string, any>>) {
        const customer = job.customers;
        const to = String(customer?.email || "").trim().toLowerCase();
        if (!to) { result.skipped += 1; continue; }
        const { data: existing } = await supabaseAdmin.from("automated_job_reminder_log")
          .select("id").eq("tenant_id", tenantId).eq("job_id", job.id).eq("lead_days", leadDaysValue).eq("target_date", targetDate).maybeSingle();
        if (existing) { result.skipped += 1; continue; }

        const customerName = customer?.business_name || `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() || "Customer";
        const location = [job.properties?.address_line1, job.properties?.city, job.properties?.postcode].filter(Boolean).join(", ");
        const when = job.scheduled_time ? String(job.scheduled_time).slice(0, 5) : "time to be confirmed";
        const subject = `${companyName} — Reminder: appointment on ${formatDate(targetDate)}`;
        const body = [
          `Hi ${customerName},`, "",
          `This is a reminder that your appointment is scheduled for ${formatDate(targetDate)} at ${when}.`,
          location ? `Location: ${location}` : "",
          job.description ? `Work: ${job.description}` : "",
          "", `Regards,`, companyName,
        ].filter(Boolean).join("\n");
        try {
          await sendSimpleNotification(to, subject, body, { companyDetails, tenantId, emailType: "job_reminder" });
          await supabaseAdmin.from("automated_job_reminder_log").insert({ tenant_id: tenantId, job_id: job.id, lead_days: leadDaysValue, target_date: targetDate });
          result.sentEmails += 1;
        } catch (error) {
          result.errors += 1;
          console.error(`[job-reminders] Failed for job ${job.id}:`, error);
        }
      }
    }
  }
  return result;
}
