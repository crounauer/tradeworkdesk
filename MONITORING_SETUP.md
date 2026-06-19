# Monitoring Setup: Sentry + Better Stack

## Quick Setup

### 1. Sentry Error Tracking

#### Frontend Setup (React)
1. **Create a Sentry project** at https://sentry.io
   - Select "React" as the platform
   - Get your DSN (looks like: `https://xxxx@yyyy.ingest.sentry.io/zzzz`)

2. **Set environment variables:**
   ```env
   # In .env or Vercel settings
   VITE_SENTRY_DSN=https://your-dsn@ingest.sentry.io/project-id
   VITE_SENTRY_ENV=production
   VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
   ```

3. **Code is already prepared** - Sentry will initialize automatically on app startup

#### Backend Setup (Node.js/Express)
1. **Get your backend Sentry DSN** (same Sentry project, can use one project for both)

2. **Set environment variables:**
   ```env
   # Fly.io secrets
   flyctl secrets set SENTRY_DSN=https://your-dsn@ingest.sentry.io/project-id
   flyctl secrets set SENTRY_ENV=production
   flyctl secrets set SENTRY_TRACES_SAMPLE_RATE=0.1
   ```

3. **Code is already prepared** - Sentry will initialize on server startup

### 2. Better Stack Uptime Monitoring

1. **Create a Better Stack account** at https://betterstack.com
2. **Add a monitor for each endpoint:**
   - `https://tradeworkdesk-api.fly.dev/health` (GET)
   - Check every 60 seconds
   - Alert on downtime > 5 minutes

3. **Set up status page** at https://status.tradeworkdesk.co.uk

## Testing Locally

### Trigger Test Errors (Frontend)
```bash
# Open browser console and run:
window.triggerTestError()  // Throws a test error
window.captureTestMessage() // Sends a test message
```

### Trigger Test Errors (Backend)
```bash
# GET /api/test-error will throw and be captured
curl https://tradeworkdesk-api.fly.dev/api/test-error
```

## Viewing Captured Errors

1. **Sentry Dashboard:** https://sentry.io/[org]/[project]/
   - Errors appear in real-time
   - Group by issue type
   - View breadcrumbs, context, user info

2. **Better Stack Dashboard:** https://app.betterstack.com
   - Monitor status
   - Incident history
   - Response times

## Production Deployment

Once Sentry & Better Stack are configured:

```bash
# Deploy with monitoring enabled
git add -A && git commit -m "Add Sentry and Better Stack monitoring"
git push origin master

# Frontend auto-deploys via Vercel with VITE_SENTRY_* env vars
# Backend auto-deploys to Fly.io with SENTRY_* secrets
```

## Verification Checklist

- [ ] Sentry project created
- [ ] DSN added to frontend .env
- [ ] DSN added to backend .env / Fly secrets
- [ ] Trigger test error on frontend (check Sentry dashboard)
- [ ] Trigger test error on backend (check Sentry dashboard)
- [ ] Better Stack monitors added
- [ ] Alert notification configured
