import { sendSimpleNotification } from "./email";
import { resolveTxt } from "node:dns/promises";

const DEFAULT_RECIPIENT = "info@tradeworkdesk.co.uk";
const DEFAULT_UTC_HOUR = 7;

let healthTimer: NodeJS.Timeout | null = null;

function msUntilNextRun(targetUtcHour: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(targetUtcHour, 0, 0, 0);
  if (next <= now) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export async function runEmailHealthcheck(): Promise<void> {
  const recipient = (process.env.EMAIL_HEALTHCHECK_RECIPIENT || DEFAULT_RECIPIENT).trim().toLowerCase();
  const now = new Date();
  const senderDomain = (process.env.EMAIL_SENDER_DOMAIN || "tradeworkdesk.co.uk").trim().toLowerCase();
  let spfOk = false;
  let dmarcOk = false;

  try {
    const txt = await resolveTxt(senderDomain);
    const records = txt.map((parts) => parts.join("").toLowerCase());
    spfOk = records.some((record) => record.includes("v=spf1"));
  } catch {
    spfOk = false;
  }

  try {
    const dmarcTxt = await resolveTxt(`_dmarc.${senderDomain}`);
    const records = dmarcTxt.map((parts) => parts.join("").toLowerCase());
    dmarcOk = records.some((record) => record.includes("v=dmarc1"));
  } catch {
    dmarcOk = false;
  }

  const subject = `TradeWorkDesk email health check - ${now.toISOString().slice(0, 10)}`;
  const body = [
    "Automated daily email health check.",
    "",
    `Timestamp (UTC): ${now.toISOString()}`,
    `Environment: ${process.env.NODE_ENV || "unknown"}`,
    `App URL: ${process.env.APP_URL || "not set"}`,
    `Sender domain: ${senderDomain}`,
    `SPF record detected: ${spfOk ? "yes" : "no"}`,
    `DMARC record detected: ${dmarcOk ? "yes" : "no"}`,
    "",
    "If you received this email, outbound email delivery is functioning at this time.",
  ].join("\n");

  await sendSimpleNotification(recipient, subject, body);
}

export function startEmailHealthcheckScheduler(): void {
  if (process.env.EMAIL_HEALTHCHECK_ENABLED === "false") {
    console.log("[email-healthcheck] Disabled via EMAIL_HEALTHCHECK_ENABLED=false");
    return;
  }

  const configuredHour = Number(process.env.EMAIL_HEALTHCHECK_UTC_HOUR || DEFAULT_UTC_HOUR);
  const targetUtcHour = Number.isFinite(configuredHour) && configuredHour >= 0 && configuredHour <= 23
    ? Math.floor(configuredHour)
    : DEFAULT_UTC_HOUR;

  const scheduleNext = () => {
    const ms = msUntilNextRun(targetUtcHour);
    console.log(`[email-healthcheck] Next run in ${Math.round(ms / 60000)} minutes`);

    healthTimer = setTimeout(async () => {
      try {
        await runEmailHealthcheck();
        console.log("[email-healthcheck] Daily check email sent successfully");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[email-healthcheck] Daily check failed:", message);
      } finally {
        scheduleNext();
      }
    }, ms);
  };

  if (process.env.EMAIL_HEALTHCHECK_RUN_ON_STARTUP === "true") {
    runEmailHealthcheck()
      .then(() => console.log("[email-healthcheck] Startup check email sent successfully"))
      .catch((err) => console.error("[email-healthcheck] Startup check failed:", err instanceof Error ? err.message : String(err)));
  }

  scheduleNext();
}

export function stopEmailHealthcheckScheduler(): void {
  if (healthTimer) {
    clearTimeout(healthTimer);
    healthTimer = null;
  }
}
