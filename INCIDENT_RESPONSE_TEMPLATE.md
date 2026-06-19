# Incident Response Template

Use this template whenever a production alert fires.

## 1. Incident Header

- Date/time detected:
- Incident ID:
- Severity: P1 / P2 / P3
- Detected by: Better Stack / Sentry / User report
- Primary owner:
- Backup owner:

## 2. Trigger Details

- Alert name:
- First alert timestamp:
- Affected service(s):
- Affected region(s):
- Current customer impact:
  - New users blocked: yes/no
  - Existing users degraded: yes/no
  - Lead submissions affected: yes/no

## 3. Immediate Triage (0-10 minutes)

- [ ] Confirm incident is real (not false positive)
- [ ] Check API health endpoint:
  - curl -sS https://tradeworkdesk-api.fly.dev/health
- [ ] Check machine state:
  - flyctl status -a tradeworkdesk-api
  - flyctl machine list -a tradeworkdesk-api
- [ ] Check recent logs:
  - flyctl logs -a tradeworkdesk-api --no-tail | tail -n 200
- [ ] Check Sentry for new/regressed production issues
- [ ] Post initial status update internally

## 4. Severity Guide

- P1: Outage or critical flow broken (login, lead capture, core API)
  - Escalate if unresolved after 10 minutes
- P2: Degraded performance (high latency, elevated 5xx)
  - Escalate if unresolved after 20 minutes
- P3: Capacity warning or trend issue
  - Escalate if unresolved after 60 minutes

## 5. Stabilization Actions

Apply one change at a time and re-check health after each change.

### A. Capacity/Latency

- [ ] If machine count pinned at max, deploy peak profile:
  - flyctl deploy -c fly.peak.toml
- [ ] If already on peak profile and still degraded, investigate DB bottlenecks
- [ ] If needed, roll back to previous known-good release:
  - flyctl releases -a tradeworkdesk-api
  - flyctl releases revert <version> -a tradeworkdesk-api

### B. Error Spike

- [ ] Identify top error signature in Sentry
- [ ] Mitigate quickly (feature flag, rollback, temporary guard)
- [ ] Validate drop in error rate before closing

### C. External Dependency Failure

- [ ] Confirm provider status
- [ ] Enable fallback path if available
- [ ] Update customer messaging if impact persists

## 6. Communication Cadence

- Initial update: within 10 minutes
- Ongoing updates:
  - P1 every 15 minutes
  - P2 every 30 minutes
  - P3 every 60 minutes
- Resolution update: include root cause and customer impact summary

## 7. Resolution Checklist

- [ ] Key endpoints healthy
- [ ] Error rate back to baseline
- [ ] p95 latency back within target
- [ ] No active customer-impacting symptoms
- [ ] Monitoring alerts recovered

## 8. Post-Incident Review (within 24-48h)

- Timeline:
- Root cause:
- Why detection did/did not happen early:
- What fixed it:
- Preventive actions (owner + due date):
  - Action 1:
  - Action 2:
  - Action 3:

## 9. Linked Runbooks

- Autoscaling decisions: FLY_AUTOSCALING_RUNBOOK.md
- Monitoring setup: MONITORING_SETUP.md
