import {
  addMutation,
  getMutations,
  updateMutation,
  deleteMutation,
  type OfflineMutation,
} from "./offline-db";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

function generateTempId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type SyncEventType =
  | "sync-start"
  | "sync-progress"
  | "sync-complete"
  | "sync-error"
  | "mutation-queued"
  | "mutation-synced"
  | "mutation-failed";

export interface SyncEvent {
  type: SyncEventType;
  detail?: {
    total?: number;
    completed?: number;
    failed?: number;
    mutation?: OfflineMutation;
    error?: string;
  };
}

type SyncListener = (event: SyncEvent) => void;

const listeners = new Set<SyncListener>();

export function onSyncEvent(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitSyncEvent(event: SyncEvent) {
  listeners.forEach((fn) => fn(event));
}

function getMutationDedupeKey(type: OfflineMutation["type"], payload: Record<string, unknown>): string | null {
  if (type === "update-job" && payload.jobId) {
    const fields = Object.keys(payload).filter((k) => k !== "jobId").sort().join(",");
    return `update-job:${payload.jobId}:${fields}`;
  }
  if (type === "create-job-note" && payload.jobId && payload.content) {
    return `create-job-note:${payload.jobId}:${String(payload.content)}`;
  }
  return null;
}

export async function queueOfflineMutation(
  type: OfflineMutation["type"],
  payload: Record<string, unknown>
): Promise<string> {
  const dedupeKey = getMutationDedupeKey(type, payload);
  if (dedupeKey) {
    const existing = await getMutations();
    const duplicate = existing.find((m) => {
      if (m.type !== type || m.status !== "pending") return false;
      return getMutationDedupeKey(m.type, m.payload) === dedupeKey;
    });
    if (duplicate) {
      await updateMutation(duplicate.id, {
        payload,
        createdAt: Date.now(),
        retries: 0,
        error: undefined,
      });
      emitSyncEvent({ type: "mutation-queued", detail: { mutation: { ...duplicate, payload } } });
      return duplicate.id;
    }
  }

  const tempId = generateTempId();
  const mutation: OfflineMutation = {
    id: tempId,
    type,
    payload,
    createdAt: Date.now(),
    retries: 0,
    status: "pending",
    tempId,
  };

  await addMutation(mutation);
  emitSyncEvent({ type: "mutation-queued", detail: { mutation } });
  return tempId;
}

async function executeMutation(mutation: OfflineMutation): Promise<{ success: boolean; error?: string; permanent?: boolean }> {
  const baseUrl = import.meta.env.BASE_URL || "/";

  try {
    let url: string;
    let method: string;
    let body: string;

    switch (mutation.type) {
      case "create-job":
        url = `${baseUrl}api/jobs`;
        method = "POST";
        body = JSON.stringify(mutation.payload);
        break;
      case "create-job-note":
        url = `${baseUrl}api/jobs/${mutation.payload.jobId}/notes`;
        method = "POST";
        body = JSON.stringify({ content: mutation.payload.content });
        break;
      case "update-job":
        url = `${baseUrl}api/jobs/${mutation.payload.jobId}`;
        method = "PATCH";
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { jobId: _jobId, ...updateData } = mutation.payload;
        body = JSON.stringify(updateData);
        break;
      case "create-time-entry":
        url = `${baseUrl}api/jobs/${mutation.payload.jobId}/time-entries`;
        method = "POST";
        body = JSON.stringify({
          arrival_time: mutation.payload.arrival_time,
          departure_time: mutation.payload.departure_time ?? null,
          notes: mutation.payload.notes ?? null,
          hourly_rate: mutation.payload.hourly_rate ?? null,
        });
        break;
      case "create-job-part":
        url = `${baseUrl}api/jobs/${mutation.payload.jobId}/parts`;
        method = "POST";
        body = JSON.stringify({
          part_name: mutation.payload.part_name,
          quantity: mutation.payload.quantity ?? 1,
          serial_number: mutation.payload.serial_number ?? null,
          unit_price: mutation.payload.unit_price ?? null,
        });
        break;
      case "create-service-record": {
        const { jobId: _srJobId, ...srData } = mutation.payload;
        url = `${baseUrl}api/service-records`;
        method = "POST";
        body = JSON.stringify({ job_id: _srJobId, ...srData });
        break;
      }
      case "create-breakdown-report": {
        const { jobId: _brJobId, ...brData } = mutation.payload;
        url = `${baseUrl}api/breakdown-reports`;
        method = "POST";
        body = JSON.stringify({ job_id: _brJobId, ...brData });
        break;
      }
      case "create-commissioning-record": {
        const { jobId: _crJobId, ...crData } = mutation.payload;
        url = `${baseUrl}api/commissioning-records`;
        method = "POST";
        body = JSON.stringify({ job_id: _crJobId, ...crData });
        break;
      }
      case "create-combustion-analysis": {
        const { jobId: _caJobId, ...caData } = mutation.payload;
        url = `${baseUrl}api/combustion-analysis-records`;
        method = "POST";
        body = JSON.stringify({ job_id: _caJobId, ...caData });
        break;
      }
      case "create-burner-setup": {
        const { jobId: _bsJobId, ...bsData } = mutation.payload;
        url = `${baseUrl}api/burner-setup-records`;
        method = "POST";
        body = JSON.stringify({ job_id: _bsJobId, ...bsData });
        break;
      }
      case "create-fire-valve-test": {
        const { jobId: _fvJobId, ...fvData } = mutation.payload;
        url = `${baseUrl}api/fire-valve-test-records`;
        method = "POST";
        body = JSON.stringify({ job_id: _fvJobId, ...fvData });
        break;
      }
      case "create-oil-line-vacuum-test": {
        const { jobId: _olvJobId, ...olvData } = mutation.payload;
        url = `${baseUrl}api/oil-line-vacuum-tests`;
        method = "POST";
        body = JSON.stringify({ job_id: _olvJobId, ...olvData });
        break;
      }
      case "create-oil-tank-inspection": {
        const { jobId: _otiJobId, ...otiData } = mutation.payload;
        url = `${baseUrl}api/oil-tank-inspections`;
        method = "POST";
        body = JSON.stringify({ job_id: _otiJobId, ...otiData });
        break;
      }
      default:
        return { success: false, error: `Unknown mutation type: ${mutation.type}` };
    }

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as Record<string, string>)?.error || `Server error ${response.status}`;

      const isPermanentFailure =
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408 &&
        response.status !== 429;

      if (isPermanentFailure) {
        return { success: false, error: errorMessage, permanent: true };
      }

      throw new Error(errorMessage);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    throw new Error(message);
  }
}

export async function recoverStuckMutations(): Promise<void> {
  const stuck = await getMutations("syncing");
  for (const m of stuck) {
    await updateMutation(m.id, { status: "pending" });
  }
}

let isSyncing = false;

export async function processMutationQueue(): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}> {
  if (isSyncing) return { total: 0, succeeded: 0, failed: 0, errors: [] };
  isSyncing = true;

  const result = { total: 0, succeeded: 0, failed: 0, errors: [] as Array<{ id: string; error: string }> };

  try {
    const pending = await getMutations("pending");
    const failed = await getMutations("failed");
    const retryable = failed.filter((m) => m.retries < MAX_RETRIES);
    const mutations = [...pending, ...retryable].sort((a, b) => a.createdAt - b.createdAt);

    if (mutations.length === 0) return result;

    result.total = mutations.length;
    emitSyncEvent({ type: "sync-start", detail: { total: mutations.length } });

    for (const mutation of mutations) {
      await updateMutation(mutation.id, { status: "syncing" });

      try {
        const { success, error, permanent } = await executeMutation(mutation);

        if (success) {
          await deleteMutation(mutation.id);
          result.succeeded++;
          emitSyncEvent({
            type: "mutation-synced",
            detail: { mutation, completed: result.succeeded, total: result.total },
          });
        } else {
          await updateMutation(mutation.id, {
            status: "failed",
            retries: permanent ? MAX_RETRIES : mutation.retries + 1,
            error: error || "Unknown error",
          });
          result.failed++;
          result.errors.push({ id: mutation.id, error: error || "Unknown error" });
          emitSyncEvent({
            type: "mutation-failed",
            detail: { mutation, error },
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Sync failed";

        const delay = Math.min(BASE_DELAY_MS * Math.pow(2, mutation.retries), 30000);
        await new Promise((r) => setTimeout(r, delay));

        await updateMutation(mutation.id, {
          status: "failed",
          retries: mutation.retries + 1,
          error: errorMsg,
        });
        result.failed++;
        result.errors.push({ id: mutation.id, error: errorMsg });
        emitSyncEvent({
          type: "mutation-failed",
          detail: { mutation, error: errorMsg },
        });
      }

      emitSyncEvent({
        type: "sync-progress",
        detail: {
          total: result.total,
          completed: result.succeeded,
          failed: result.failed,
        },
      });
    }

    emitSyncEvent({
      type: "sync-complete",
      detail: {
        total: result.total,
        completed: result.succeeded,
        failed: result.failed,
      },
    });
  } finally {
    isSyncing = false;
  }

  return result;
}

export function getIsSyncing(): boolean {
  return isSyncing;
}

export async function discardMutation(id: string): Promise<void> {
  await deleteMutation(id);
}

export async function retryMutation(id: string): Promise<void> {
  await updateMutation(id, { status: "pending", retries: 0, error: undefined });
}
