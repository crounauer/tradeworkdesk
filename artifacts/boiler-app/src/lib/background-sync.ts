const SYNC_TAG = "offline-mutations-sync";

export function supportsBackgroundSync(): boolean {
  return "serviceWorker" in navigator && "SyncManager" in window;
}

export async function registerBackgroundSync(): Promise<boolean> {
  if (!supportsBackgroundSync()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(SYNC_TAG);
    return true;
  } catch {
    return false;
  }
}

let fallbackInterval: ReturnType<typeof setInterval> | null = null;

export function startFallbackPolling(
  syncFn: () => Promise<void>,
  intervalMs = 30000
): void {
  stopFallbackPolling();
  fallbackInterval = setInterval(async () => {
    if (navigator.onLine) {
      await syncFn();
    }
  }, intervalMs);
}

export function stopFallbackPolling(): void {
  if (fallbackInterval) {
    clearInterval(fallbackInterval);
    fallbackInterval = null;
  }
}

export { SYNC_TAG };
