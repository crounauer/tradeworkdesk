import { useState, useEffect } from "react";
import { useOffline } from "@/contexts/offline-context";
import { WifiOff, CloudOff, RefreshCw, CheckCircle2, AlertCircle, X, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function OfflineBanner() {
  const { isOnline, pendingMutations, failedMutations, isSyncing, lastSyncResult } = useOffline();
  const [showSyncResult, setShowSyncResult] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (lastSyncResult && lastSyncResult.succeeded > 0) {
      setShowSyncResult(true);
      const timer = setTimeout(() => setShowSyncResult(false), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastSyncResult]);

  useEffect(() => {
    if (!isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  if (showSyncResult && lastSyncResult) {
    return (
      <div className="border-b px-4 py-2.5 flex items-center justify-center gap-2 text-sm bg-green-50 border-green-200 text-green-800 animate-in slide-in-from-top-2">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        <span>
          <strong>{lastSyncResult.succeeded}</strong> offline {lastSyncResult.succeeded === 1 ? "change" : "changes"} synced successfully
          {lastSyncResult.failed > 0 && (
            <span className="text-amber-700"> ({lastSyncResult.failed} failed)</span>
          )}
        </span>
        <button onClick={() => setShowSyncResult(false)} className="ml-2 opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="border-b px-4 py-2.5 flex items-center justify-center gap-2 text-sm bg-blue-50 border-blue-200 text-blue-800">
        <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
        <span>Syncing offline changes...</span>
      </div>
    );
  }

  if (!isOnline && !dismissed) {
    return (
      <div className="border-b px-4 py-2.5 flex items-center justify-center gap-2 text-sm bg-amber-50 border-amber-200 text-amber-800">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>
          <strong>You're offline.</strong> You can still create jobs and add notes &mdash; they'll sync when you're back online.
          {pendingMutations.length > 0 && (
            <span className="ml-1">({pendingMutations.length} pending)</span>
          )}
        </span>
        <button onClick={() => setDismissed(true)} className="ml-2 opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (failedMutations.length > 0 && isOnline) {
    return (
      <div className="border-b px-4 py-2.5 flex items-center justify-center gap-2 text-sm bg-red-50 border-red-200 text-red-800">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>
          <strong>{failedMutations.length}</strong> offline {failedMutations.length === 1 ? "change" : "changes"} failed to sync. Check the pending changes list below for details and next steps.
        </span>
      </div>
    );
  }

  return null;
}

export function PendingSyncBadge({ className }: { className?: string }) {
  const { pendingMutations } = useOffline();

  if (pendingMutations.length === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800 border border-amber-200",
        className
      )}
    >
      <CloudOff className="w-3 h-3" />
      {pendingMutations.length} pending
    </span>
  );
}

export function OfflineMutationsList() {
  const { pendingMutations, failedMutations, discardPendingMutation, retryFailedMutation, triggerSync, isSyncing, isOnline } = useOffline();

  const allMutations = [...pendingMutations, ...failedMutations];

  if (allMutations.length === 0) return null;

  const getMutationLabel = (m: { type: string; payload: Record<string, unknown> }) => {
    switch (m.type) {
      case "create-job":
        return "Create Job";
      case "create-job-note":
        return `Add Note to Job`;
      case "update-job":
        return `Update Job`;
      case "create-time-entry":
        return "Add Time Entry";
      case "create-job-part":
        return "Add Part";
      default:
        return "Unknown";
    }
  };

  const getErrorGuidance = (m: { error?: string; retries: number }) => {
    if (!m.error) return null;
    const err = m.error.toLowerCase();
    if (err.includes("401") || err.includes("unauthorized") || err.includes("unauthenticated")) {
      return "Your session may have expired. Try logging out and back in, then retry.";
    }
    if (err.includes("403") || err.includes("forbidden")) {
      return "You may not have permission for this action. Contact your admin if this is unexpected.";
    }
    if (err.includes("404") || err.includes("not found")) {
      return "The record may have been deleted. You can discard this change if the item no longer exists.";
    }
    if (err.includes("409") || err.includes("conflict")) {
      return "This conflicts with a recent change. Discard and re-apply your update on the latest version.";
    }
    if (err.includes("422") || err.includes("validation")) {
      return "The data may be invalid. Discard and try again with corrected details.";
    }
    if (err.includes("500") || err.includes("server error")) {
      return "The server encountered an error. This will be retried automatically. If it persists, contact support.";
    }
    if (err.includes("network") || err.includes("fetch")) {
      return "Could not reach the server. This will retry when connection improves.";
    }
    if (m.retries >= 5) {
      return "Maximum retries reached. Discard if this change is no longer needed, or retry manually.";
    }
    return "This will be retried automatically. Discard if no longer needed.";
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
          <CloudOff className="w-4 h-4" />
          Offline Changes ({allMutations.length})
        </h4>
        {isOnline && allMutations.length > 0 && (
          <Button size="sm" variant="outline" onClick={triggerSync} disabled={isSyncing} className="h-7 text-xs">
            <RefreshCw className={cn("w-3 h-3 mr-1", isSyncing && "animate-spin")} />
            Sync Now
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {allMutations.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex items-center justify-between text-xs rounded-md px-3 py-2",
              m.status === "failed" ? "bg-red-50 border border-red-200" : "bg-white border border-amber-200"
            )}
          >
            <div className="flex-1 min-w-0">
              <span className="font-medium">{getMutationLabel(m)}</span>
              <span className="text-muted-foreground ml-2">
                {new Date(m.createdAt).toLocaleTimeString()}
              </span>
              {m.status === "failed" && m.error && (
                <p className="text-red-600 mt-0.5 truncate">{m.error}</p>
              )}
              {m.status === "failed" && (
                <p className="text-xs text-amber-700 mt-1">{getErrorGuidance(m)}</p>
              )}
            </div>
            <div className="flex gap-1 ml-2">
              {m.status === "failed" && (
                <button
                  onClick={() => retryFailedMutation(m.id)}
                  className="p-1 hover:bg-slate-100 rounded"
                  title="Retry"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                </button>
              )}
              <button
                onClick={() => discardPendingMutation(m.id)}
                className="p-1 hover:bg-slate-100 rounded"
                title="Discard"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
