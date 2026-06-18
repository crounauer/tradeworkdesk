# Testing Sentry & Better Stack

## Prerequisites

You'll need accounts at:
- **Sentry** (https://sentry.io) - Create a free account
- **Better Stack** (https://betterstack.com) - Create a free account (optional, for uptime monitoring)

## Step 1: Create Sentry Project

1. Go to https://sentry.io and sign in
2. Click **"Create Project"**
3. Select **"React"** for frontend project
4. Name it `tradeworkdesk-frontend`
5. Copy the **DSN** (looks like: `https://xxx@yyy.ingest.sentry.io/zzz`)
6. Paste into your frontend `.env` as:
   ```
   VITE_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
   VITE_SENTRY_ENV=development
   VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
   ```

## Step 2: Test Frontend Error Tracking

1. Ensure the app is running locally (`pnpm dev`)
2. Open browser DevTools (F12)
3. Go to the Console tab
4. Run:
   ```javascript
   window.triggerTestError()
   ```
5. Check Sentry dashboard - you should see the error appear within 5-10 seconds
6. Also test:
   ```javascript
   window.captureTestMessage()
   ```

## Step 3: Test Backend Error Tracking (Optional)

For local testing, you can set the SENTRY_DSN environment variable:

```bash
# Terminal 1: Start API server with Sentry
export SENTRY_DSN="https://xxx@yyy.ingest.sentry.io/zzz"
cd artifacts/api-server
pnpm dev
```

```bash
# Terminal 2: Trigger test error
curl http://localhost:3001/api/test-error
```

Check Sentry dashboard - the error should appear as a separate issue.

## Step 4: Production Deployment

Once you're confident with Sentry:

1. **Set Vercel environment variables** (frontend):
   ```
   VITE_SENTRY_DSN = https://xxx@yyy.ingest.sentry.io/zzz
   VITE_SENTRY_ENV = production
   ```

2. **Set Fly.io secrets** (backend):
   ```bash
   fly secrets set SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
   fly secrets set SENTRY_ENV=production
   ```

3. Push code:
   ```bash
   git add -A && git commit -m "Enable Sentry error tracking" && git push origin master
   ```

4. Apps auto-deploy with monitoring enabled

## Step 5: Better Stack Uptime Monitoring (Optional)

1. Go to https://betterstack.com and sign up
2. Create a new **Monitor**:
   - Name: `TradeWorkDesk API Health`
   - URL: `https://tradeworkdesk-api.fly.dev/health`
   - Check every: 60 seconds
   - Regions: Select 3-4 for redundancy

3. Set up incident notifications:
   - Email alerts
   - Slack integration (optional)

4. Create a **Status Page** to share with customers

## Monitoring Dashboard URLs

Once everything is set up:
- **Sentry Issues:** https://sentry.io/[org]/[project]/issues/
- **Sentry Releases:** https://sentry.io/[org]/[project]/releases/
- **Better Stack:** https://app.betterstack.com
- **Status Page:** https://status.tradeworkdesk.co.uk (custom domain)

## Troubleshooting

### Errors not appearing in Sentry?
1. Check DevTools Console for errors
2. Verify DSN is correct (should have your org name in it)
3. Check Network tab - POST requests to `ingest.sentry.io` should succeed
4. Verify `VITE_SENTRY_DSN` is set in `.env`

### Rate limiting?
- Default: 100 events/minute
- Errors are automatically deduplicated if they have the same stacktrace
- Different user = separate error group (good for finding user-specific issues)

### Too much noise?
In Sentry dashboard:
1. Go to **Integrations** → **Release Tracking**
2. Set up source maps for better stack traces
3. Use **Inbound Filters** to ignore known errors
