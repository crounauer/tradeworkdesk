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

### 3. Email Alerts (Better Stack + Sentry)

Use this baseline alert profile to detect customer-impact risk early.

#### Better Stack Alerts (email)

Create these monitors and notifications:

1. **API health monitor**
   - URL: `https://tradeworkdesk-api.fly.dev/health`
   - Method: `GET`
   - Frequency: `60s`
   - Regions: at least `2`
   - Alert when down for `2` consecutive checks
   - Send recovery emails: enabled

2. **Homepage synthetic monitor**
   - URL: your production frontend homepage
   - Method: `GET`
   - Frequency: `60s`
   - Alert if status is non-2xx for `2` checks

3. **Lead-submit synthetic monitor**
   - Endpoint: key lead capture path (or safe synthetic route)
   - Frequency: `60s`
   - Alert if status non-2xx/3xx for `2` checks

4. **Email recipients**
   - Add your main email as primary recipient
   - Add at least one backup email recipient
   - Enable both incident and recovery notifications

#### Sentry Alerts (email)

Create Sentry alert rules with email actions:

1. **New high-severity issue**
   - Condition: new issue with level `error` or `fatal`
   - Environment: `production`
   - Action: email immediately

2. **Error rate spike**
   - Condition: error events above normal baseline (or above your fixed threshold)
   - Window: `5m`
   - Action: email immediately

3. **Regression rule**
   - Condition: issue regressed in `production`
   - Action: email immediately

4. **Ownership and noise control**
   - Route alerts to owner/team inbox
   - Mute noisy known issues after triage

### 4. Escalation Timing

Use this escalation timing to avoid delayed response:

1. **P1 (customer-facing outage)**
   - Trigger examples: health check down, login/lead flow failing
   - First alert: immediate email
   - Escalate if unresolved after `10 minutes`

2. **P2 (degraded performance)**
   - Trigger examples: p95 latency > 700ms for 10 minutes, 5xx > 1% for 5 minutes
   - First alert: immediate email
   - Escalate if unresolved after `20 minutes`

3. **P3 (warning trend)**
   - Trigger examples: machine count pinned at max, rising slow requests
   - First alert: immediate email
   - Escalate if unresolved after `60 minutes`

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
- [ ] Better Stack email recipients configured (primary + backup)
- [ ] Sentry alert rules configured for new issue, error spike, and regression
- [ ] Alert notification configured

## Weekly Alert Review Checklist

Run this once per week:

- [ ] Review Better Stack incidents and confirm root causes are documented
- [ ] Review Sentry top production issues and remove stale mute rules
- [ ] Check if p95 latency breached 700ms more than once
- [ ] Check if 5xx rate breached 1% more than once
- [ ] Check whether machine count was pinned at max during business hours
- [ ] Decide: keep settings or switch to peak profile for upcoming traffic windows
