/**
 * Middleware: reads the Host header and resolves the tenant site.
 * Passes tenant/website context to the route as request headers.
 */
import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  // Strip port for local dev
  const domain = host.replace(/:\d+$/, "");

  // Pass the domain to the route via a header
  // The page components read this to fetch the right site data
  const res = NextResponse.next();
  res.headers.set("x-tenant-domain", domain);

  return res;
}

export const config = {
  // Run on all paths except Next.js internals and static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
