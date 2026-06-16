# website-renderer

A Next.js 15 app that serves tenant websites built with the TradeWorkDesk website builder.

## How it works

1. A custom domain is added by the tenant in the business app
2. Cloudflare for SaaS routes the domain → this renderer service (on Railway)
3. The middleware reads the `Host` header and forwards it as `x-tenant-domain`
4. Pages call `getSiteByDomain()` which hits the platform API to get all site data
5. Pages are ISR-cached for 60 seconds

## Environment variables

| Variable | Description |
|---|---|
| `API_BASE_URL` | Platform API base URL (e.g. `https://api.tradeworkdesk.co.uk`) |
| `RENDERER_SECRET` | Shared secret for renderer → API server calls |
| `PLATFORM_CNAME_TARGET` | Hostname tenants should CNAME their domain to |
| `PORT` | Port to bind (Railway sets this automatically) |

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

## Deployment (Railway)

- Service name: `website-renderer`
- Build command: `pnpm --filter @workspace/website-renderer build`
- Start command: `pnpm --filter @workspace/website-renderer start`
- Domain: Assign a Railway-provided subdomain (e.g. `renderer.up.railway.app`) — this is what tenant CNAMEs point to via Cloudflare for SaaS.
