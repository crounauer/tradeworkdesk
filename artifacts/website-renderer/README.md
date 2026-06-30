# website-renderer

A Next.js 15 app that serves tenant websites built with the TradeWorkDesk website builder.

## How it works

1. A custom domain is added by the tenant in the business app
2. The tenant points their domain CNAME at `sites.tradeworkdesk.co.uk`
3. When DNS propagates, the tenant clicks "Check Status" — the API server verifies the CNAME and adds the domain to this Vercel project via the Vercel API
4. Vercel provisions an SSL certificate automatically
5. The middleware reads the `Host` header and forwards it as `x-tenant-domain`
6. Pages call `getSiteByDomain()` which hits the platform API to get all site data
7. Pages are ISR-cached for 60 seconds

## Environment variables

| Variable | Description |
|---|---|
| `API_BASE_URL` | Platform API base URL (e.g. `https://api.tradeworkdesk.co.uk`) |
| `RENDERER_SECRET` | Shared secret for renderer → API server calls |
| `PLATFORM_CNAME_TARGET` | Hostname tenants should CNAME their domain to (e.g. `sites.tradeworkdesk.co.uk`) |

### API server env vars (for domain provisioning)

| Variable | Description |
|---|---|
| `VERCEL_API_TOKEN` | Vercel API token (Account Settings → Tokens) |
| `VERCEL_RENDERER_PROJECT_ID` | Project ID of this renderer on Vercel |
| `VERCEL_TEAM_ID` | (optional) Team ID if project is under a Vercel team |

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

After deploying, set `RENDERER_BASE_URL` on the API app to the renderer Fly URL so preview links point at the correct host.
