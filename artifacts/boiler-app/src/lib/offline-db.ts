import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "tradeworkdesk-offline";
const DB_VERSION = 1;

export type MutationStatus = "pending" | "syncing" | "failed";

export interface OfflineMutation {
  id: string;
  type: "create-job" | "create-job-note" | "update-job" | "create-time-entry" | "create-job-part"
    | "create-service-record" | "create-breakdown-report" | "create-commissioning-record"
    | "create-combustion-analysis" | "create-burner-setup" | "create-fire-valve-test"
    | "create-oil-line-vacuum-test" | "create-oil-tank-inspection";
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  status: MutationStatus;
  error?: string;
  tempId?: string;
}

export interface CachedReferenceData {
  key: string;
  data: unknown;
  updatedAt: number;
}

export interface CachedJob {
  id: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

let dbInstance: IDBPDatabase | null = null;

export async function getOfflineDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("mutations")) {
        const mutationStore = db.createObjectStore("mutations", { keyPath: "id" });
        mutationStore.createIndex("by-status", "status");
        mutationStore.createIndex("by-created", "createdAt");
      }

      if (!db.objectStoreNames.contains("referenceData")) {
        db.createObjectStore("referenceData", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("cachedJobs")) {
        db.createObjectStore("cachedJobs", { keyPath: "id" });
      }
    },
  });

  return dbInstance;
}

export async function addMutation(mutation: OfflineMutation): Promise<void> {
  const db = await getOfflineDB();
  await db.put("mutations", mutation);
}

export async function getMutations(status?: OfflineMutation["status"]): Promise<OfflineMutation[]> {
  const db = await getOfflineDB();
  if (status) {
    return db.getAllFromIndex("mutations", "by-status", status);
  }
  const all = await db.getAll("mutations");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateMutation(id: string, updates: Partial<OfflineMutation>): Promise<void> {
  const db = await getOfflineDB();
  const existing = await db.get("mutations", id);
  if (existing) {
    await db.put("mutations", { ...existing, ...updates });
  }
}

export async function deleteMutation(id: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete("mutations", id);
}

export async function getPendingMutationCount(): Promise<number> {
  const db = await getOfflineDB();
  return db.countFromIndex("mutations", "by-status", "pending");
}

export async function cacheReferenceData(key: string, data: unknown): Promise<void> {
  const db = await getOfflineDB();
  await db.put("referenceData", { key, data, updatedAt: Date.now() });
}

export async function getCachedReferenceData<T = unknown>(key: string): Promise<T | null> {
  const db = await getOfflineDB();
  const record = await db.get("referenceData", key);
  return record ? (record.data as T) : null;
}

export async function cacheJob(id: string, data: Record<string, unknown>): Promise<void> {
  const db = await getOfflineDB();
  await db.put("cachedJobs", { id, data, updatedAt: Date.now() });
}

export async function getCachedJob(id: string): Promise<Record<string, unknown> | null> {
  const db = await getOfflineDB();
  const record = await db.get("cachedJobs", id);
  return record ? record.data : null;
}

export async function getAllCachedJobs(): Promise<CachedJob[]> {
  const db = await getOfflineDB();
  return db.getAll("cachedJobs");
}
