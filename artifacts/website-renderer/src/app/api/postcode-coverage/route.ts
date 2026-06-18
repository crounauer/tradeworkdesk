import { NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL || "https://tradeworkdesk-api.fly.dev";
const RENDERER_SECRET = process.env.RENDERER_SECRET || "";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";
    const postcode = typeof body.postcode === "string" ? body.postcode : "";

    if (!websiteId || !postcode.trim()) {
      return NextResponse.json({ error: "websiteId and postcode are required" }, { status: 400 });
    }

    const upstream = await fetch(`${API_BASE}/api/public/website/postcode-coverage/${encodeURIComponent(websiteId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(RENDERER_SECRET ? { "x-renderer-secret": RENDERER_SECRET } : {}),
      },
      body: JSON.stringify({ postcode }),
      cache: "no-store",
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    console.error("postcode coverage proxy error:", error);
    return NextResponse.json({ error: "Failed to check postcode coverage" }, { status: 500 });
  }
}
