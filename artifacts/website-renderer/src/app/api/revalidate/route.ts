import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

const RENDERER_SECRET = process.env.RENDERER_SECRET || "";

function normalizeDomain(input: string): string {
  return input
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .trim();
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (RENDERER_SECRET && req.headers.get("x-renderer-secret") !== RENDERER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { domains?: string[]; websiteIds?: string[]; reason?: string } = {};
  try {
    payload = await req.json();
  } catch {
    // Empty body is allowed.
  }

  const domains = Array.isArray(payload.domains)
    ? Array.from(new Set(payload.domains.map((d) => normalizeDomain(String(d || ""))).filter(Boolean)))
    : [];
  const websiteIds = Array.isArray(payload.websiteIds)
    ? Array.from(new Set(payload.websiteIds.map((id) => String(id || "").trim()).filter(Boolean)))
    : [];

  for (const domain of domains) {
    revalidateTag(`site-domain:${domain}`);
  }

  for (const websiteId of websiteIds) {
    revalidateTag(`site-website:${websiteId}`);
  }

  return NextResponse.json({
    ok: true,
    domains_revalidated: domains.length,
    websites_revalidated: websiteIds.length,
    reason: payload.reason || null,
  });
}
