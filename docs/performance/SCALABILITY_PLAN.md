# Scalability Plan — Phase 9

Verified 2026-09-08. Per the audit framework's explicit instruction: **do not claim scalability
without load evidence.** No load test exists in this repo — every statement below is either a
structural observation (what would need to change) or explicitly marked unverified.

## Scale tiers — honest assessment

| Tier | Verified? | Basis |
|---|---|---|
| 1 user | **Yes** — this is the current real usage pattern | Direct observation; every portal is effectively single-operator/single-tenant today |
| 10 users | **Not verified** — no load test run | Structurally plausible given light resource footprint (Phase 9 baseline: all containers <100MB, <1% CPU idle), but plausibility is not evidence |
| 100 users | **Not verified, likely to expose real gaps** | The single in-memory rate limiter (market-research-portal's `rate-limit.ts`, explicitly documented in its own comment as "single-process only, won't work multi-instance without Redis") and the complete absence of any caching layer (Phase 2 finding — no Redis anywhere) would both become relevant around this tier |
| 1,000 users | **Not verified, structural blockers likely** | No connection pooling limits were stress-tested (Postgres pools cap at `max: 10` per portal per Phase 4/8 findings — 10 connections would likely be a real bottleneck under concurrent load); no horizontal scaling path exists for any portal (single container each, no load balancer beyond nginx's single upstream) |
| 10,000 users | **Not verified, would require real architectural work** | No portal's current architecture (modular monolith, single Postgres instance, no queue, no cache) is designed for this tier — would need connection pooling (PgBouncer), caching (Redis), and likely read replicas before this is realistic |

## What would actually need to change, by tier (structural, not measured)

- **10-100 users:** raise Postgres pool `max` from 10, add Redis for market-research-portal's rate
  limiter (already self-documented as needing this), verify nginx's `worker_connections 1024` and
  rate-limit zones (`api:10m rate=20r/s`, `general:10m rate=50r/s` — real, already configured, not
  yet tested under real concurrent load) are sized correctly.
- **100-1,000 users:** introduce a real caching layer (none exists today), consider read replicas
  for the 498-table `sohamyoga` database, move the in-process `node-cron` schedulers to something
  that survives horizontal scaling (multiple frontend instances would each try to run the same cron
  job today — a real duplicate-execution risk at this tier that doesn't exist at 1 instance).
- **1,000-10,000 users:** this would be a genuine re-architecture, not a tuning exercise — connection
  pooling middleware (PgBouncer), horizontal scaling of the frontend/backend containers behind a real
  load balancer (nginx today has exactly one upstream address per service), and likely splitting the
  57-domain sohamyoga-frontend monolith would all become real considerations. Not recommended to
  pre-build any of this now — per the audit framework's own Phase 18 "Stop Building" control, this
  is premature optimization for a system with 1 real user today.

## Recommendation

Do not invest in scale work now. The honest, evidence-based statement is: **this system is
verified to work correctly at its actual current scale (single operator, light local traffic)**, and
the path to higher tiers is understood structurally but genuinely untested. The single highest-value
action if real user growth is imminent would be a real load test (k6 or Artillery, not installed
today) against sohamyoga-frontend specifically, since it's both the largest codebase and the one with
actual customer-facing traffic potential.
