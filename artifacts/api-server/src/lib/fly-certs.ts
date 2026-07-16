/**
 * Fly Certificates API integration — manages custom domains on the website-renderer app.
 *
 * Required env vars on api-server:
 *   FLY_API_TOKEN          — Fly API token with access to the renderer app
 *   FLY_RENDERER_APP_NAME  — the Fly app name for the website renderer
 *
 * Optional env vars:
 *   FLY_API_HOSTNAME       — defaults to https://api.fly.io
 */

const FLY_API = (process.env.FLY_API_HOSTNAME || "https://api.fly.io").replace(/\/$/, "");
const FLY_RENDERER_APP_NAME = process.env.FLY_RENDERER_APP_NAME || "tradeworkdesk-renderer";

function isConfigured(): boolean {
  return !!(process.env.FLY_API_TOKEN && FLY_RENDERER_APP_NAME);
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.FLY_API_TOKEN}`,
  };
}

async function getCertificate(hostname: string): Promise<Response> {
  return fetch(`${FLY_API}/v1/apps/${encodeURIComponent(FLY_RENDERER_APP_NAME)}/certificates/${encodeURIComponent(hostname)}`, {
    method: "GET",
    headers: authHeaders(),
  });
}

/**
 * Add a hostname to the Fly renderer app and request automatic ACME certs.
 */
export async function addDomainToFly(hostname: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) {
    console.warn("[fly-certs] FLY_API_TOKEN / FLY_RENDERER_APP_NAME not set — skipping hostname provisioning");
    return { ok: false, error: "Fly certificates API not configured" };
  }

  try {
    const existing = await getCertificate(hostname);
    if (existing.ok) return { ok: true };

    const res = await fetch(
      `${FLY_API}/v1/apps/${encodeURIComponent(FLY_RENDERER_APP_NAME)}/certificates/acme`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ hostname }),
      },
    );

    if (res.ok) return { ok: true };

    const body = await res.text();
    const afterRetry = await getCertificate(hostname);
    if (afterRetry.ok) return { ok: true };

    console.error(`[fly-certs] addDomainToFly(${hostname}) error ${res.status}:`, body);
    return { ok: false, error: body || `HTTP ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fly-certs] addDomainToFly(${hostname}) threw:`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Remove a hostname and all Fly-managed certificates from the renderer app.
 */
export async function removeDomainFromFly(hostname: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true };

  try {
    const res = await fetch(
      `${FLY_API}/v1/apps/${encodeURIComponent(FLY_RENDERER_APP_NAME)}/certificates/${encodeURIComponent(hostname)}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      },
    );

    if (res.ok || res.status === 404) return { ok: true };

    const body = await res.text();
    console.error(`[fly-certs] removeDomainFromFly(${hostname}) error ${res.status}:`, body);
    return { ok: false, error: body || `HTTP ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[fly-certs] removeDomainFromFly(${hostname}) threw:`, msg);
    return { ok: false, error: msg };
  }
}