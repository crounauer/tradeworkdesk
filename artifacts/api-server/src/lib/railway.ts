/**
 * Railway API integration — manages custom domains on the website-renderer service.
 *
 * When a tenant connects their domain and DNS verifies, we add it to Railway so
 * Railway can provision an SSL certificate automatically.
 *
 * Required env vars:
 *   RAILWAY_API_TOKEN          — Railway account API token (Account Settings → Tokens)
 *   RAILWAY_RENDERER_SERVICE_ID — the website-renderer service ID
 *   RAILWAY_ENVIRONMENT_ID     — the Railway environment ID (production)
 */

const RAILWAY_API = "https://backboard.railway.app/graphql/v2";

function railwayHeaders(): HeadersInit {
  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) throw new Error("RAILWAY_API_TOKEN not configured");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

function isConfigured(): boolean {
  return !!(
    process.env.RAILWAY_API_TOKEN &&
    process.env.RAILWAY_RENDERER_SERVICE_ID &&
    process.env.RAILWAY_ENVIRONMENT_ID
  );
}

/**
 * Add a custom domain to the website-renderer Railway service.
 * Railway will automatically provision an SSL certificate.
 */
export async function addDomainToRailway(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) {
    console.warn("[railway] RAILWAY_API_TOKEN / RAILWAY_RENDERER_SERVICE_ID / RAILWAY_ENVIRONMENT_ID not set — skipping Railway domain provisioning");
    return { ok: false, error: "Railway not configured" };
  }

  const mutation = `
    mutation CustomDomainCreate($input: CustomDomainCreateInput!) {
      customDomainCreate(input: $input) {
        id
        domain
      }
    }
  `;

  try {
    const res = await fetch(RAILWAY_API, {
      method: "POST",
      headers: railwayHeaders(),
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            domain,
            serviceId: process.env.RAILWAY_RENDERER_SERVICE_ID,
            environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
          },
        },
      }),
    });

    const json = await res.json() as { data?: unknown; errors?: Array<{ message: string }> };

    if (json.errors?.length) {
      const msg = json.errors[0].message;
      // Already exists is fine
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
        return { ok: true };
      }
      console.error(`[railway] addDomainToRailway(${domain}) error:`, msg);
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[railway] addDomainToRailway(${domain}) threw:`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Remove a custom domain from the Railway website-renderer service.
 * Called when a tenant removes their domain.
 */
export async function removeDomainFromRailway(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured()) return { ok: true }; // no-op if not configured

  // First find the domain ID
  const query = `
    query GetCustomDomains($serviceId: String!, $environmentId: String!) {
      service(id: $serviceId) {
        serviceInstances {
          edges {
            node {
              domains {
                customDomains {
                  id
                  domain
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(RAILWAY_API, {
      method: "POST",
      headers: railwayHeaders(),
      body: JSON.stringify({
        query,
        variables: {
          serviceId: process.env.RAILWAY_RENDERER_SERVICE_ID,
          environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
        },
      }),
    });

    const json = await res.json() as {
      data?: { service?: { serviceInstances?: { edges?: Array<{ node?: { domains?: { customDomains?: Array<{ id: string; domain: string }> } } }> } } };
      errors?: Array<{ message: string }>;
    };

    const customDomains = json.data?.service?.serviceInstances?.edges?.[0]?.node?.domains?.customDomains || [];
    const match = customDomains.find((d) => d.domain === domain);
    if (!match) return { ok: true }; // already gone

    const deleteMutation = `
      mutation CustomDomainDelete($id: String!) {
        customDomainDelete(id: $id)
      }
    `;

    await fetch(RAILWAY_API, {
      method: "POST",
      headers: railwayHeaders(),
      body: JSON.stringify({ query: deleteMutation, variables: { id: match.id } }),
    });

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[railway] removeDomainFromRailway(${domain}) threw:`, msg);
    return { ok: false, error: msg };
  }
}
