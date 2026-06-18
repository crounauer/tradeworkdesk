/**
 * Middleware: reads the Host header and resolves the tenant site.
 * Passes tenant/website context to the route as request headers.
 *
 * For platform subdomains (*.tradeworkdesk.co.uk), checks whether the tenant
 * has an active custom domain and issues a 301 redirect if so, preventing
 * duplicate content and split SEO ranking.
 */
import { NextResponse, type NextRequest } from "next/server";

const API_BASE = process.env.API_BASE_URL || "https://tradeworkdesk-api.fly.dev";
const RENDERER_SECRET = process.env.RENDERER_SECRET || "";
const PLATFORM_SUBDOMAIN_BASE = process.env.PLATFORM_SUBDOMAIN_BASE || "tradeworkdesk.co.uk";

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const domain = host.replace(/:\d+$/, "");

  // Only do the redirect check for platform subdomains
  if (domain.endsWith(`.${PLATFORM_SUBDOMAIN_BASE}`)) {
    try {
      const checkRes = await fetch(
        `${API_BASE}/api/public/website/canonical-domain/${encodeURIComponent(domain)}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(RENDERER_SECRET ? { "x-renderer-secret": RENDERER_SECRET } : {}),
          },
          // Short timeout — don't let a slow API stall the middleware
          signal: AbortSignal.timeout(3000),
        },
      );
      if (checkRes.ok) {
        const { canonical } = await checkRes.json() as { canonical: string | null };
        if (canonical) {
          const redirectUrl = new URL(req.url);
          redirectUrl.host = canonical;
          return NextResponse.redirect(redirectUrl.toString(), { status: 301 });
        }
      }
    } catch {
      // Silently continue if the check fails — serve the subdomain normally
    }
  }

  // Pass the domain to the route as a request header so server components can
  // read it via headers(). Response headers set on NextResponse.next() are NOT
  // visible to server components — only request headers are.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-domain", domain);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  // Run on all paths except Next.js internals and static assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
