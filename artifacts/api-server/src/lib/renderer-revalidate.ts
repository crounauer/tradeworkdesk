function normalizeDomain(input: string): string {
  return input
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();
}

function resolveRendererBaseUrl(): string | null {
  let rendererBase = (process.env.RENDERER_BASE_URL || "").replace(/\/$/, "");
  if (!rendererBase && process.env.NODE_ENV !== "production") {
    rendererBase = "http://localhost:3002";
  }
  if (!rendererBase) return null;
  if (!rendererBase.startsWith("http")) rendererBase = `https://${rendererBase}`;
  return rendererBase;
}

export async function triggerRendererRevalidate(opts: { domains?: string[]; websiteIds?: string[]; reason: string }): Promise<void> {
  const rendererBase = resolveRendererBaseUrl();
  if (!rendererBase) return;

  const domains = Array.from(new Set((opts.domains || []).map((d) => normalizeDomain(String(d || ""))).filter(Boolean)));
  const websiteIds = Array.from(new Set((opts.websiteIds || []).map((id) => String(id || "").trim()).filter(Boolean)));
  if (domains.length === 0 && websiteIds.length === 0) return;

  const headers: HeadersInit = { "Content-Type": "application/json" };
  const secret = process.env.RENDERER_SECRET;
  if (secret) headers["x-renderer-secret"] = secret;

  try {
    const res = await fetch(`${rendererBase}/api/revalidate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ domains, websiteIds, reason: opts.reason }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.warn("[renderer-revalidate] failed:", res.status, await res.text());
    }
  } catch (error) {
    console.warn("[renderer-revalidate] request error:", error);
  }
}
