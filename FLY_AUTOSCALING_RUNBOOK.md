# Fly Autoscaling Runbook

This runbook defines when to keep settings unchanged and when to switch between normal and peak scaling profiles.

## Profiles

- Normal (default): fly.toml
  - min_machines_running = 1
  - max_machines_running = 4
  - concurrency soft/hard = 60/90
- Peak: fly.peak.toml
  - min_machines_running = 2
  - max_machines_running = 6
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
  - Confirm at least 2 machines started: flyctl machine list -a tradeworkdesk-api
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
