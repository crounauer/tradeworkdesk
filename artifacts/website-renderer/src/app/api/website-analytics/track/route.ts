import { NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL || "https://tradeworkdesk-api.fly.dev";
const RENDERER_SECRET = process.env.RENDERER_SECRET || "";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const websiteId = typeof body.websiteId === "string" ? body.websiteId : "";

    if (!websiteId) {
      return NextResponse.json({ error: "websiteId is required" }, { status: 400 });
    }

    const upstream = await fetch(`${API_BASE}/api/public/website/analytics/track/${encodeURIComponent(websiteId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(RENDERER_SECRET ? { "x-renderer-secret": RENDERER_SECRET } : {}),
      },
      body: JSON.stringify({
        event_type: body.event_type,
        session_id: body.session_id,
        visitor_id: body.visitor_id,
        path: body.path,
        referrer: body.referrer,
        session_elapsed_seconds: body.session_elapsed_seconds,
        session_page_index: body.session_page_index,
      }),
      cache: "no-store",
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") || "application/json" },
    });
  } catch (error) {
    console.error("website analytics proxy error:", error);
    return NextResponse.json({ error: "Failed to track website analytics" }, { status: 500 });
  }
}
