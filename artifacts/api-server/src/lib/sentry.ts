/**
 * Sentry integration for Node.js ESM.
 * Must be initialised before any other imports via initSentry() in index.ts.
 * Uses dynamic import() so it works in ESM modules.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentry: any = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENV || "production",
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
    });
    _sentry = Sentry;
    console.log("[sentry] Initialised successfully");
  } catch (err) {
    console.warn("[sentry] Failed to initialise, continuing without error tracking:", err);
  }
}

export function getSentry(): any {
  return _sentry;
}

export function captureException(err: unknown): void {
  _sentry?.captureException(err);
}

export function captureMessage(msg: string, level: "info" | "warning" | "error" = "info"): void {
  _sentry?.captureMessage(msg, level);
}
