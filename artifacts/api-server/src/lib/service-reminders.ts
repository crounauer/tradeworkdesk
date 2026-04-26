/**
 * Service Due Reminder Scheduler
 *
 * Runs daily at 09:00 UTC and sends reminder emails to customers whose
 * appliances have `next_service_due` in exactly 28 days or 14 days from today.
 * Requires EMAIL_SERVICE_REMINDERS=true env var to be enabled.
 */

import { supabaseAdmin } from "./supabase";
import { sendServiceDueReminderEmail, type EmailCompanyDetails } from "./email";

const REMINDER_DAYS = [28, 14];

interface ApplianceRow {
  id: string;
  manufacturer: string | null;
  model: string | null;
  next_service_due: string;
  tenant_id: string;
  properties?: {
    customers?: {
      first_name: string;
      last_name: string;
      email: string | null;
    } | null;
  } | null;
}

export async function runServiceDueReminders(): Promise<{ sent: number; skipped: number; errors: number }> {
  const enabled = process.env.EMAIL_SERVICE_REMINDERS === "true";
  if (!enabled) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const results = { sent: 0, skipped: 0, errors: 0 };
  const today = new Date().toISOString().slice(0, 10);

  for (const days of REMINDER_DAYS) {
    const targetDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

    const { data: appliances, error } = await supabaseAdmin
      .from("appliances")
      .select("id, manufacturer, model, next_service_due, tenant_id, properties(customers(first_name, last_name, email))")
      .eq("is_active", true)
      .eq("next_service_due", targetDate);

    if (error) {
      console.error(`[service-reminders] Failed to query appliances for ${targetDate}:`, error);
      results.errors++;
      continue;
    }

    for (const appliance of (appliances as ApplianceRow[] || [])) {
      const customer = appliance.properties?.customers;
      if (!customer?.email) {
        results.skipped++;
        continue;
      }

      const customerName = `${customer.first_name} ${customer.last_name}`;
      const applianceDescription = [appliance.manufacturer, appliance.model].filter(Boolean).join(" ") || "Appliance";

      // Fetch company details for this tenant
      const [tenantRes, settingsRes] = await Promise.all([
        supabaseAdmin.from("tenants").select("company_name").eq("id", appliance.tenant_id).single(),
        supabaseAdmin.from("company_settings").select("*").eq("tenant_id", appliance.tenant_id).eq("singleton_id", "default").maybeSingle(),
      ]);

      const companyName = (tenantRes.data as Record<string, unknown>)?.company_name as string || "Your Service Provider";
      const cs = settingsRes.data as Record<string, unknown> | null;
      const companyDetails: EmailCompanyDetails = {
        name: (cs?.name as string | null) || null,
        trading_name: (cs?.trading_name as string | null) || null,
        logo_url: (cs?.logo_url as string | null) || null,
        address_line1: (cs?.address_line1 as string | null) || null,
        address_line2: (cs?.address_line2 as string | null) || null,
        city: (cs?.city as string | null) || null,
        county: (cs?.county as string | null) || null,
        postcode: (cs?.postcode as string | null) || null,
        phone: (cs?.phone as string | null) || null,
        email: (cs?.email as string | null) || null,
        website: (cs?.website as string | null) || null,
      };

      const bookingUrl = (cs?.website as string | null) || "";

      try {
        await sendServiceDueReminderEmail(
          customer.email,
          customerName,
          companyName,
          applianceDescription,
          appliance.next_service_due,
          bookingUrl,
          companyDetails,
        );
        results.sent++;
        console.log(`[service-reminders] Sent ${days}-day reminder to ${customer.email} for appliance ${appliance.id}`);
      } catch (e) {
        console.error(`[service-reminders] Failed to send to ${customer.email}:`, e);
        results.errors++;
      }
    }
  }

  console.log(`[service-reminders] Done for ${today}: sent=${results.sent} skipped=${results.skipped} errors=${results.errors}`);
  return results;
}

/**
 * Preview which customers would receive a reminder today (dry run, no emails sent).
 * Returns an array of { customerEmail, customerName, applianceName, daysUntilDue }.
 */
export async function previewServiceDueReminders(): Promise<Array<{
  customerEmail: string;
  customerName: string;
  applianceName: string;
  dueDate: string;
  daysUntilDue: number;
}>> {
  const preview: Array<{
    customerEmail: string;
    customerName: string;
    applianceName: string;
    dueDate: string;
    daysUntilDue: number;
  }> = [];

  for (const days of REMINDER_DAYS) {
    const targetDate = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

    const { data: appliances } = await supabaseAdmin
      .from("appliances")
      .select("id, manufacturer, model, next_service_due, tenant_id, properties(customers(first_name, last_name, email))")
      .eq("is_active", true)
      .eq("next_service_due", targetDate);

    for (const appliance of (appliances as ApplianceRow[] || [])) {
      const customer = appliance.properties?.customers;
      if (!customer?.email) continue;

      preview.push({
        customerEmail: customer.email,
        customerName: `${customer.first_name} ${customer.last_name}`,
        applianceName: [appliance.manufacturer, appliance.model].filter(Boolean).join(" ") || "Appliance",
        dueDate: appliance.next_service_due,
        daysUntilDue: days,
      });
    }
  }

  return preview;
}

let reminderTimer: NodeJS.Timeout | null = null;

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(9, 0, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export function startServiceReminderScheduler(): void {
  if (process.env.EMAIL_SERVICE_REMINDERS !== "true") {
    console.log("[service-reminders] Disabled (set EMAIL_SERVICE_REMINDERS=true to enable)");
    return;
  }

  const scheduleNext = () => {
    const ms = msUntilNextRun();
    console.log(`[service-reminders] Next run in ${Math.round(ms / 60000)} minutes`);
    reminderTimer = setTimeout(async () => {
      await runServiceDueReminders().catch((e) => console.error("[service-reminders] Unhandled error:", e));
      scheduleNext();
    }, ms);
  };

  scheduleNext();
}

export function stopServiceReminderScheduler(): void {
  if (reminderTimer) {
    clearTimeout(reminderTimer);
    reminderTimer = null;
  }
}
