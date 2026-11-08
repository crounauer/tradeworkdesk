export const DATABASE_REQUEST_TIMEOUT_MS = 30_000;

export function fetchWithDatabaseTimeout(input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!url.pathname.startsWith("/rest/v1/")) return globalThis.fetch(input, init);
  const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const timeout = AbortSignal.timeout(DATABASE_REQUEST_TIMEOUT_MS);
  return globalThis.fetch(input, {
    ...init,
    signal: callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout,
  });
}
