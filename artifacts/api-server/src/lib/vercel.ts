/**
 * Vercel API integration — manages custom domains on the website-renderer project.
 *
 * When a tenant's DNS verifies, we add their domain to the Vercel renderer project
 * so Vercel automatically provisions an SSL certificate for it.
 *
 * Required env vars on api-server:
 *   VERCEL_API_TOKEN            — Vercel API token (Account Settings → Tokens)
 *   VERCEL_RENDERER_PROJECT_ID  — the website-renderer project ID
 *   VERCEL_TEAM_ID              — (optional) team ID if project is under a team
 */

const VERCEL_API = "https://api.vercel.com";

function isConfigured(): boolean {
  return !!(process.env.VERCEL_API_TOKEN && process.env.VERCEL_RENDERER_PROJECT_ID);
}

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.VERCEL_API_TOKEN}`,
  };
}

function teamQuery(): string {
  return process.env.VERCEL_TEAM_ID ? `?teamId=${process.env.VERCEL_TEAM_ID}` : "";
}

/**
 * Add a custom domain to the renderer Vercel project.
 * Vercel provisions an SSL certificate automatically within seconds.
 */
export async function addDomainToVercel(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) {
    console.warn("[vercel] VERCEL_API_TOKEN / VERCEL_RENDERER_PROJECT_ID not set — skipping domain provisioning");
    return { ok: false, error: "Vercel not configured" };
  }

  const projectId = process.env.VERCEL_RENDERER_PROJECT_ID;

  try {
    const res = await fetch(
      `${VERCEL_API}/v10/projects/${projectId}/domains${teamQuery()}`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name: domain }),
      },
    );

    const json = await res.json() as { error?: { code?: string; message?: string } };

    if (res.ok) return { ok: true };

    const code = json.error?.code || "";
    const message = json.error?.message || `HTTP ${res.status}`;

    // Already added is fine
    if (code === "domain_already_in_use" || code === "domain_already_exists") {
      return { ok: true };
    }

    console.error(`[vercel] addDomainToVercel(${domain}) error ${res.status}:`, message);
    return { ok: false, error: message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[vercel] addDomainToVercel(${domain}) threw:`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Remove a custom domain from the renderer Vercel project.
 * Called when a tenant removes their domain.
 */
export async function removeDomainFromVercel(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true }; // no-op if not configured

  const projectId = process.env.VERCEL_RENDERER_PROJECT_ID;

  try {
    const res = await fetch(
      `${VERCEL_API}/v9/projects/${projectId}/domains/${encodeURIComponent(domain)}${teamQuery()}`,
      {
        method: "DELETE",
        headers: authHeaders(),
      },
    );

    if (res.ok || res.status === 404) return { ok: true };

    const json = await res.json().catch(() => ({})) as { error?: { message?: string } };
    const message = json.error?.message || `HTTP ${res.status}`;
    console.error(`[vercel] removeDomainFromVercel(${domain}) error:`, message);
    return { ok: false, error: message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[vercel] removeDomainFromVercel(${domain}) threw:`, msg);
    return { ok: false, error: msg };
  }
}
