import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getMutations, cacheReferenceData, getCachedReferenceData, type OfflineMutation } from "@/lib/offline-db";
import {
  queueOfflineMutation,
  processMutationQueue,
  recoverStuckMutations,
  onSyncEvent,
  discardMutation,
  retryMutation,
  type SyncEvent,
} from "@/lib/offline-sync";
import {
  registerBackgroundSync,
  supportsBackgroundSync,
  startFallbackPolling,
  stopFallbackPolling,
} from "@/lib/background-sync";
import { useQueryClient } from "@tanstack/react-query";

interface OfflineContextValue {
  isOnline: boolean;
  pendingMutations: OfflineMutation[];
  failedMutations: OfflineMutation[];
  isSyncing: boolean;
  lastSyncResult: { succeeded: number; failed: number } | null;
  queueJobCreation: (payload: Record<string, unknown>) => Promise<string>;
  queueJobNote: (jobId: string, content: string) => Promise<string>;
  queueJobUpdate: (jobId: string, updates: Record<string, unknown>) => Promise<string>;
  triggerSync: () => Promise<void>;
  discardPendingMutation: (id: string) => Promise<void>;
  retryFailedMutation: (id: string) => Promise<void>;
  getCachedData: <T = unknown>(key: string) => Promise<T | null>;
  setCachedData: (key: string, data: unknown) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

async function attemptSync() {
  const all = await getMutations();
  const hasPending = all.some((m) => m.status === "pending" || m.status === "failed");
  if (hasPending) {
    await processMutationQueue();
  }
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const [pendingMutations, setPendingMutations] = useState<OfflineMutation[]>([]);
  const [failedMutations, setFailedMutations] = useState<OfflineMutation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const wasOfflineRef = useRef(!isOnline);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refreshMutations = useCallback(async () => {
    try {
      const all = await getMutations();
      setPendingMutations(all.filter((m) => m.status === "pending" || m.status === "syncing"));
      setFailedMutations(all.filter((m) => m.status === "failed"));
    } catch {
      // IndexedDB may not be available
    }
  }, []);

  useEffect(() => {
    recoverStuckMutations().then(() => refreshMutations());
  }, [refreshMutations]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === "TRIGGER_SYNC") {
          attemptSync();
        }
      };
      navigator.serviceWorker.addEventListener("message", handler);
      return () => navigator.serviceWorker.removeEventListener("message", handler);
    }
    return undefined;
  }, []);

  useEffect(() => {
    if (!supportsBackgroundSync()) {
      startFallbackPolling(attemptSync, 30000);
      return () => stopFallbackPolling();
    }
    return undefined;
  }, []);

  useEffect(() => {
    const unsub = onSyncEvent((event: SyncEvent) => {
      if (event.type === "sync-start") {
        setIsSyncing(true);
      } else if (event.type === "sync-complete") {
        setIsSyncing(false);
        setLastSyncResult({
          succeeded: event.detail?.completed ?? 0,
          failed: event.detail?.failed ?? 0,
        });
        refreshMutations();
        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && typeof key[0] === "string" && key[0].includes("/notes");
          },
        });
      } else if (event.type === "mutation-queued") {
        refreshMutations();
      } else if (event.type === "mutation-synced" || event.type === "mutation-failed") {
        refreshMutations();
      }
    });
    return unsub;
  }, [refreshMutations, queryClient]);

  useEffect(() => {
    if (isOnline && wasOfflineRef.current) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

      if (supportsBackgroundSync()) {
        registerBackgroundSync();
      }

      syncTimeoutRef.current = setTimeout(attemptSync, 1500);
    }
    wasOfflineRef.current = !isOnline;

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [isOnline]);

  const queueJobCreation = useCallback(async (payload: Record<string, unknown>) => {
    const id = await queueOfflineMutation("create-job", payload);
    if (supportsBackgroundSync()) {
      registerBackgroundSync();
    }
    return id;
  }, []);

  const queueJobNote = useCallback(async (jobId: string, content: string) => {
    const id = await queueOfflineMutation("create-job-note", { jobId, content });
    if (supportsBackgroundSync()) {
      registerBackgroundSync();
    }
    return id;
  }, []);

  const queueJobUpdate = useCallback(async (jobId: string, updates: Record<string, unknown>) => {
    const id = await queueOfflineMutation("update-job", { jobId, ...updates });
    if (supportsBackgroundSync()) {
      registerBackgroundSync();
    }
    return id;
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline) return;
    await processMutationQueue();
  }, [isOnline]);

  const discardPendingMutation = useCallback(async (id: string) => {
    await discardMutation(id);
    await refreshMutations();
  }, [refreshMutations]);

  const retryFailedMutation = useCallback(async (id: string) => {
    await retryMutation(id);
    await refreshMutations();
    if (isOnline) {
      await processMutationQueue();
    }
  }, [refreshMutations, isOnline]);

  const getCachedData = useCallback(async <T = unknown>(key: string) => {
    return getCachedReferenceData<T>(key);
  }, []);

  const setCachedData = useCallback(async (key: string, data: unknown) => {
    await cacheReferenceData(key, data);
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingMutations,
        failedMutations,
        isSyncing,
        lastSyncResult,
        queueJobCreation,
        queueJobNote,
        queueJobUpdate,
        triggerSync,
        discardPendingMutation,
        retryFailedMutation,
        getCachedData,
        setCachedData,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}
