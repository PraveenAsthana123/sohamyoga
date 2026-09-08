# KPI Catalog — Phase 11

Verified 2026-09-08. What's actually measurable today from real data, vs. what would need new
instrumentation. Not a business KPI wishlist — an engineering-observability KPI catalog.

## Measurable today (real data exists)

| KPI | Source | Current value (if queryable) |
|---|---|---|
| Module build-status ratio | `module_registry` | 180 real / 15 partial / 1 not_built (as of last query, moves as work lands) |
| Job success rate (market-research-portal) | `job_run` (139 rows) | Not aggregated in this pass — real per-row data exists |
| AI groundedness rejection rate (Research-AI Draft Job) | `phase_run_ai_log` | 16/119 rejected (13.4%) |
| API request volume (SohamYoga.Web) | `ApiRequestLog` | Not aggregated this pass — real per-request rows exist |
| Security finding count by severity | `security_scan_run`/`security_finding` | Covered in [SECURITY_RISK_REGISTER.md](../security/SECURITY_RISK_REGISTER.md) |
| Vapi API call success rate | `vapi_api_audit_log` | Real audit trail exists (12 rows at last count) |

## Not measurable today (no instrumentation exists)

- **Uptime/availability per portal** — no uptime monitoring exists; this audit found 2 outages
  (ai-orchestrator-platform, market-research-portal build) and 1 near-outage (nginx) purely by manual
  investigation, meaning the true historical uptime for any portal is genuinely unknown.
- **AI cost per feature** — zero cost tracking anywhere (Phase 10/11 finding).
- **Error rate trends over time** — error logs exist per-portal (Phase 11 architecture doc) but
  aren't rolled up into a trend/rate KPI anywhere.
- **User-facing latency (p50/p95/p99)** — only single-request spot measurements exist (Phase 9),
  no continuous latency tracking.

## Recommendation

Given the 3 real incidents this audit found were all availability failures invisible to any existing
system, **uptime/health-check monitoring is the single highest-value missing KPI** — ahead of AI cost
tracking or business-metric dashboards. A simple external health-check poller (even a 5-minute cron
hitting each portal's `/health`/`/api/health` endpoint and alerting on failure) would have caught all
3 incidents automatically instead of requiring a full audit to surface them.
