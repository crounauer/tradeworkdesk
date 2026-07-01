import { headers } from "next/headers";

function normalizeDomain(value: string | null): string {
  return String(value || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

export async function getRequestDomain(fallback = "localhost"): Promise<string> {
  const h = await headers();
  const domain =
    normalizeDomain(h.get("x-tenant-domain")) ||
    normalizeDomain(h.get("x-forwarded-host")) ||
    normalizeDomain(h.get("host"));

  return domain || fallback;
}