import { supabaseAdmin } from "./supabase";
import { captureMessage } from "./sentry";
import type { Request, Response } from "express";

export type DatabaseReadiness = {
  status: "ok" | "unavailable";
  checkedAt: string;
};

export function createDatabaseReadinessCheck(
  probe: () => Promise<void>,
  now = Date.now,
  report = (available: boolean) => {
    if (available) {
      console.log("[database-readiness] Database connectivity recovered");
      captureMessage("Database connectivity recovered", "info");
    } else {
      console.error("[database-readiness] Database probe failed; background polling paused");
      captureMessage("Database readiness failed", "error");
    }
  },
) {
  let cached: DatabaseReadiness | undefined;
  let nextCheckAt = 0;
  let failures = 0;
  let inFlight: Promise<DatabaseReadiness> | undefined;

  return function check(): Promise<DatabaseReadiness> {
    if (inFlight) return inFlight;
    if (cached && now() < nextCheckAt) return Promise.resolve(cached);
    inFlight = (async () => {
      let available = false;
      try {
        await probe();
        available = true;
      } catch (error) {
        console.error("[database-readiness] Probe error:", error instanceof Error ? error.message : "Database query failed");
      }
      if (!available && cached?.status !== "unavailable") report(false);
      if (available && cached?.status === "unavailable") report(true);
      failures = available ? 0 : failures + 1;
      cached = { status: available ? "ok" : "unavailable", checkedAt: new Date(now()).toISOString() };
      nextCheckAt = now() + (available ? 15_000 : Math.min(30_000 * 2 ** Math.min(failures - 1, 4), 300_000));
      return cached;
    })().finally(() => { inFlight = undefined; });
    return inFlight;
  };
}

export const checkDatabaseReadiness = createDatabaseReadinessCheck(async () => {
  const { error } = await supabaseAdmin.from("jobs").select("id").limit(1)
    .abortSignal(AbortSignal.timeout(5_000));
  if (error) throw new Error(error.message);
});

export async function serveDatabaseReadiness(_req: Request, res: Response): Promise<void> {
  const database = await checkDatabaseReadiness();
  res.set("Cache-Control", "no-store");
  res.status(database.status === "ok" ? 200 : 503).json({
    status: database.status === "ok" ? "ok" : "degraded",
    database,
  });
}

export function databaseGuardedTask(
  name: string,
  task: () => Promise<unknown>,
  check = checkDatabaseReadiness,
): () => Promise<void> {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      if ((await check()).status !== "ok") return;
      await task();
    } catch (error) {
      console.error(`[${name}] Background task failed:`, error);
    } finally {
      running = false;
    }
  };
}
