# website-renderer

A Next.js 15 app that serves tenant websites built with the TradeWorkDesk website builder.

## How it works

1. A custom domain is added by the tenant in the business app
2. The tenant points their domain at the Fly renderer target (`sites.tradeworkdesk.co.uk` for www or the Fly anycast IPs for apex domains)
3. When DNS propagates, the tenant clicks "Check Status" — the API server verifies the DNS records and requests a Fly ACME certificate for the domain
4. Fly provisions an SSL certificate automatically
5. The middleware reads the `Host` header and forwards it as `x-tenant-domain`
6. Pages call `getSiteByDomain()` which hits the platform API to get all site data
7. Live pages are cached with ISR and on-demand revalidation

## Environment variables

| Variable | Description |
|---|---|
| `API_BASE_URL` | Platform API base URL (e.g. `https://api.tradeworkdesk.co.uk`) |
| `RENDERER_SECRET` | Shared secret for renderer → API server calls |
| `PUBLIC_SITE_CACHE_TTL_SECONDS` | Renderer fetch cache TTL for live website data (default `60`, min `5`, max `600`) |
| `PLATFORM_CNAME_TARGET` | Hostname tenants should CNAME their domain to (e.g. `sites.tradeworkdesk.co.uk`) |

### API server env vars (for domain provisioning)

| Variable | Description |
|---|---|
| `FLY_API_TOKEN` | Fly API token with access to the renderer app |
| `FLY_RENDERER_APP_NAME` | Fly app name of the website renderer (default `tradeworkdesk-renderer`) |
| `RENDERER_BASE_URL` | Public URL of this renderer used by API server for preview links and revalidation calls |
| `PLATFORM_CNAME_TARGET` | Shared hostname tenants should CNAME `www` to (for example `sites.tradeworkdesk.co.uk`) |
| `FLY_PUBLIC_IPV4` | Fly IPv4 address used for apex-domain A records |
| `FLY_PUBLIC_IPV6` | Fly IPv6 address used for apex-domain AAAA records |
| `PUBLIC_SITE_API_CACHE_MAX_AGE_SECONDS` | API cache TTL for live public site data (default `30`) |
| `PUBLIC_SITE_API_CACHE_SWR_SECONDS` | API stale-while-revalidate window for live public site data (default `120`) |
| `CANONICAL_DOMAIN_CACHE_MAX_AGE_SECONDS` | API cache TTL for canonical-domain checks (default `60`) |
| `CANONICAL_DOMAIN_CACHE_SWR_SECONDS` | API stale-while-revalidate window for canonical-domain checks (default `300`) |

Fly renderer domain setup:

- Add `sites.tradeworkdesk.co.uk` to the Fly renderer app.
- Add each tenant domain you want served by Fly (for example `gasboilersuk.co.uk` or `www.gasboilersuk.co.uk`).
- Keep tenant `www` records as CNAMEs to `sites.tradeworkdesk.co.uk`.

## Cache and Revalidation Ops

- Live site data is cached by both the renderer fetch layer and API response headers.
- Preview routes remain uncached (`no-store`).
- When website content/domain/blog publish events happen in the API server, it calls renderer `POST /api/revalidate` to clear cache tags.

`POST /api/revalidate` payload:

```json
{
  "domains": ["example.com"],
  "websiteIds": ["uuid"],
  "reason": "page_publish"
}
```

Headers:

- `x-renderer-secret: <RENDERER_SECRET>` (required when `RENDERER_SECRET` is set)

## Development

```bash
pnpm dev
```

The app runs on port 3001 by default in dev. You can test different tenant sites by setting the `x-tenant-domain` header in a browser extension or by adding hosts entries.

## Architecture

```
artifacts/website-renderer/
  src/
    app/
      layout.tsx          — root layout (no site-specific data)
      page.tsx            — home page (resolved by domain)
      [...slug]/page.tsx  — dynamic pages
      blog/
        page.tsx          — blog index
        [slug]/page.tsx   — blog post
      sitemap.ts          — dynamic sitemap
      robots.ts           — dynamic robots.txt
      not-found.tsx       — 404 page
    lib/
      api.ts              — client for platform API
    middleware.ts         — host header → x-tenant-domain
    components/
      PageRenderer.tsx    — fetches + renders page blocks
      layout/
        SiteLayout.tsx    — header + footer wrapper
        SiteHeader.tsx    — nav header
        SiteFooter.tsx    — footer with company info
        GoogleAnalytics.tsx
      blocks/
        BlockRenderer.tsx — routes block_type to component
        HeroBlock.tsx
        TextBlock.tsx
        ImageBlock.tsx
        CtaBlock.tsx
        ServicesBlock.tsx
        ContactFormBlock.tsx
        TestimonialsBlock.tsx
        GalleryBlock.tsx
        AccreditationsBlock.tsx
        SpacerBlock.tsx
      blog/
        BlogList.tsx
        BlogPostContent.tsx
```

## Deployment (Fly)

Deploy the renderer with the Fly config in `artifacts/website-renderer/fly.toml`.

- **App name**: `tradeworkdesk-renderer`
- **Base URL**: `https://tradeworkdesk-renderer.fly.dev`
- **API base**: `https://tradeworkdesk-api.fly.dev`

After deploying, set `RENDERER_BASE_URL` on the API app to the renderer Fly URL so preview links and revalidation point at the correct host.
