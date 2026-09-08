# Observability Architecture — Phase 11

Verified 2026-09-08. Consolidates observability findings scattered across Phases 1, 8, and 9 into
one place.

## What exists (real, per-portal, not centralized)

| Portal | Logs | Metrics | Traces | Correlation ID |
|---|---|---|---|---|
| sohamyoga-frontend | Console (Docker logs); `security_scan_run`/`security_finding` tables for scan history | None | None | Not propagated (2 files reference it, per Phase 5) |
| SohamYoga.Web | **Real** — Serilog + `ApiRequestLog`/`AuditLog` tables populated by real middleware on every request | `AdminMonitoringController` self-reports DB size/record counts | **Real** — `CorrelationIdMiddleware`, propagated into Serilog context | Yes, real |
| market-research-portal | `api_error_log`, `ui_error_log`, `test_run`, `operations_alert` — a real, DB-backed cross-cutting error/event log, functioning as the app's own observability layer | `Operations Alert Sweep` (10 real source-table sweeps) | None | Not found |
| voice-agent-platform | `vapi_api_audit_log` (real, detailed — every Vapi API call logged with duration, initiator, success/failure) | None beyond that audit log | None | Not found |
| password-manager | None found | None | None | N/A |
| ai-orchestrator-platform | `local_ai_maintenance.py` (real, currently-firing systemd timer, JSON/JSONL health snapshots every 10 min) | Dashboard computed from real `tasks` table | None | None |

**No centralized/third-party observability platform is configured anywhere** — confirmed absent:
Datadog, New Relic, Grafana, Prometheus, Sentry, OpenTelemetry (the only OTel references found are
transitive `node_modules` dependencies bundled by Next.js itself, never actually initialized/used by
any portal's own code).

## The real, functioning pattern: per-portal DB-backed event logs

Despite no centralized platform, 4 of 6 portals independently built the same underlying pattern: a
Postgres table that records real operational events (requests, errors, job runs, API calls) queried
by an admin-facing dashboard. This is genuinely functional observability, just not aggregated across
portals — an operator has to check 4 different places to get a full picture, but each individual
place is real, not a stub.

## The direct consequence of no centralized observability (cross-referencing Phase 8/9)

**All 3 real incidents this audit found and fixed** (ai-orchestrator-platform's dead backend, market-research-portal's
broken build, nginx's stale-DNS 502) **were invisible to every logging system listed above** — none
of them alert on "the process is not running" or "the proxy target is unreachable." Each was
discovered exclusively through manual, live investigation during this audit, not through any
existing observability signal. This is the single most concrete, evidence-backed finding of this
phase: the gap is not "we have bad observability," it's "we have zero observability for the specific
failure class (process death, stale infrastructure state) that has already caused real incidents."
