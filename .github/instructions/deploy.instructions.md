---
description: "Use when deploying this project, running fly deploy or fly ssh, shipping frontend changes, applying a production migration, or debugging why a deploy did not pick up code changes."
---

# Deploying

Two independent deploy targets. Know which one your change needs.

| Change in | Ships via | How |
|-----------|-----------|-----|
| `artifacts/api-server/`, `lib/`, `scripts/` | Fly `tradeworkdesk-api` | manual `fly deploy` |
| `artifacts/business-app/` | Vercel `tradeworkdesk-boiler-app` | automatic on push to `main` |
| `artifacts/website-renderer/` | Fly `tradeworkdesk-renderer` | manual `fly deploy` |

## Frontend (business-app)

Vercel is Git-connected to `main` and aliased to `tradeworkdesk.co.uk` and
`www.tradeworkdesk.co.uk`. Pushing to `main` is the deploy — there is nothing else
to run. `vercel ls` from `artifacts/business-app` shows recent deployments.

`fly deploy` does **not** ship the frontend. The API Dockerfile only copies
`artifacts/api-server/`, `lib/` and `scripts/`.

Vercel rewrites `/api/*` to `https://tradeworkdesk-api.fly.dev/api/*`, so a
frontend change that depends on new API behaviour needs the Fly deploy too.

## API (Fly)

1. Apply any pending schema change first and verify it landed — do not assume.
2. `fly deploy --app tradeworkdesk-api --no-cache`
3. Verify: `fly status` shows checks passing, and `/health` returns 200.

`--no-cache` is not optional. Depot can report every step CACHED and finish in
2-3s while serving a stale image, even when source files changed.

Health endpoints: `/health` (used by the Fly check) and `/api/healthz`. Both `/`
and `/healthz` return 404.

## Container facts (verified)

- `DATABASE_URL` is a **placeholder** (literally `...`). `psql` is installed but
  cannot connect. DDL must be run by the user in the Supabase SQL Editor.
- The app reaches the database via `SUPABASE_URL` + service role key, not a
  Postgres connection string.
- `curl` is **not** installed. `node` is — use a `.mjs` script with global `fetch`.

## Running commands on the machine

`fly ssh console -C` mangles quoting and pipes, and an interactive
`fly ssh console` does not inherit app secrets. Upload a script instead:

    printf 'put /tmp/x.sh /tmp/x.sh\n' | fly ssh sftp shell -a tradeworkdesk-api
    fly ssh console -a tradeworkdesk-api -C "/bin/sh /tmp/x.sh"
