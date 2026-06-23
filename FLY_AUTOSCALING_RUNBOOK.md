# Fly Autoscaling Runbook

This runbook defines when to keep settings unchanged and when to switch between normal and peak scaling profiles.

## Profiles

- Normal (default): fly.toml
  - min_machines_running = 1
  - max_machines_running = 4
  - concurrency soft/hard = 60/90
- Peak: fly.peak.toml
  - min_machines_running = 1
  - max_machines_running = 4
  - concurrency soft/hard = 40/60

## How to Switch Profiles

- Turn peak mode on:
  - flyctl deploy -c fly.peak.toml
- Return to normal mode:
  - flyctl deploy -c fly.toml

## Peak Window Playbook

- 24-48h before expected peak:
  - Deploy peak mode.
  - Confirm app health: curl -sS https://tradeworkdesk-api.fly.dev/health
  - Confirm at least 1 machine started: flyctl machine list -a tradeworkdesk-api
- During peak:
  - Watch Fly dashboard latency and machine count.
  - Watch Sentry issue volume and error rate.
- After peak ends:
  - Deploy normal profile.

## Alert Thresholds (Recommended)

Configure alerting in your monitoring system with these starting thresholds:

- p95 latency > 700ms for 10 minutes
- 5xx error rate > 1% for 5 minutes
- Machine count at max for 10+ minutes
- Health endpoint failures from 2+ regions

## Alert Channels and Escalation

Set email notifications for each threshold and follow this escalation:

- P1 (outage): health endpoint failing or critical user flow down
  - Email immediately
  - Escalate after 10 minutes if unresolved
- P2 (degradation): p95 > 700ms for 10 minutes or 5xx > 1% for 5 minutes
  - Email immediately
  - Escalate after 20 minutes if unresolved
- P3 (capacity warning): machine count pinned at max for 10+ minutes
  - Email immediately
  - Escalate after 60 minutes if unresolved

## Weekly Change / No-Change Checklist

1. Capacity
- Was machine count pinned at max during business hours?
- Did p95 latency exceed 700ms repeatedly?

2. Reliability
- Did 5xx errors exceed 1% at any point?
- Were there customer-visible incidents?

3. Cost efficiency
- Was machine 2+ rarely used while p95 stayed under 300ms?

Decision:
- If two or more capacity/reliability checks are "yes": move toward peak profile or raise capacity.
- If reliability is stable and extra machines are rarely used: keep normal profile.
- If cost pressure is high and p95 is consistently low: consider higher concurrency or lower max cap.

## Weekly Alert Hygiene Checklist

- [ ] Confirm all email recipients are still valid (primary + backup)
- [ ] Confirm Better Stack monitors are green and not muted incorrectly
- [ ] Confirm Sentry production alert rules are enabled
- [ ] Review top 5 incidents and record follow-up actions
- [ ] Remove or update noisy alert rules after root-cause fixes

## Safe Change Order

When tuning settings, change one dimension at a time:

1. concurrency soft/hard limits
2. max_machines_running
3. min_machines_running

After each change:

- Deploy
- Verify /health
- Observe for one business cycle before next change

## Notes for This Project

- Keep min_machines_running >= 1 in normal mode because in-process schedulers are used.
- Keep the health monitor pointed at /health, not /api/health.
