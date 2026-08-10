# test_api — API testing reference

> Per operator 2026-06-02. Composes with §43 drill + §78 TDD-first + §64.30 12-tier testing + §64.42 master testing matrix.

## What's tested

**157 endpoints across 36 routers** — see `jobs/reports/api_audit_<TS>.md` for per-router scores.

## Run it

```bash
# All 8 surfaces (api + 7 others)
agent test all

# Just the api surface
agent test api

# Per-endpoint deep audit
agent-api-audit

# Auto-fix proposed gaps (dry-run)
agent-api-audit --dispatch

# Schedule daily 03:30
agent-api-audit install-cron
```

## What "production-grade" means (8 dimensions scored)

| Dim | Pass criterion | Why |
|---|---|---|
| auth | `Depends(...)` calling `verify_token`/`api_key`/`require_role` | §47.6 SOC2 CC6.1 |
| rate_limit | `slowapi` / `RateLimit` / `throttle` middleware | §41.4 rate limiting |
| audit | `request_id` / `correlation_id` / audit row write | §38.3 decision audit |
| pydantic | `response_model=` + `BaseModel` input | §3 layer rule + §74.5 validation |
| error_handle | `try/except` blocks ≥ endpoint count / 4 | §57.7 explicit failure |
| validation | `Query()` / `Path()` / `Field()` constraints | §75.11 input validation |
| observe | `logger.*` / `logging.*` | §57.6 canonical fields |
| tests | matching `tests/**/*<router>*` file | §43 drill, §78 TDD |

## Reports produced

| Report | What |
|---|---|
| `jobs/reports/api_audit_<TS>.json` | machine-readable per-router scores + endpoints |
| `jobs/reports/api_audit_<TS>.md` | human summary (sortable table) |
| `.agent/api_remediation_plan.jsonl` | one row per (router, gap) — feeds `agent fix` |
| `jobs/reports/test_api_<TS>.json` | last `agent test api` smoke result |

## How issues get fixed

1. **Discover** (deterministic) — `agent-api-audit` writes the remediation plan
2. **Fix** (stochastic) — `agent fix --apply` dispatches each plan row to `agent-auto-fix-worker.py`
   - Worker classifies (tier, risk)
   - Worker calls Ollama at the right tier (small/medium/large)
   - Worker applies `git apply --check` → real apply
   - Worker validates (ast.parse / bash -n / json)
   - Worker runs council review (3-stage) on medium/high risk
   - Worker writes HITL request for medium/high risk
   - Worker auto-commits low risk
3. **Verify** (deterministic) — `agent test api` re-runs against the fixed router

## Cron auto-fire

```
# Test runner
0  2 * * *   PROJECT=insur_project agent test all           # nightly 02:00
0  * * * *   PROJECT=insur_project agent test api           # hourly :00
30 * * * *   PROJECT=insur_project agent test tdd           # hourly :30

# API-specific audit + fix-loop
30 3 * * *   PROJECT=insur_project agent-api-audit          # daily 03:30
0  * * * *   PROJECT=insur_project agent fix --max-fixes 3  # hourly dry-run
```

## Current state (latest audit run)

| Metric | Value |
|---|---|
| Routers | 35 |
| Endpoints | 157 |
| Avg score | 3.0 / 8 |
| Production-ready (≥ 7/8) | 0 |
| Needs work (< 5/8) | 31 |
| Missing auth | 35 / 35 (100%) |
| Missing rate_limit | 35 / 35 (100%) |
| Missing observe | 27 / 35 (77%) |
| Missing error_handle | 25 / 35 (71%) |
| Missing pydantic | 21 / 35 (60%) |

## Composes with

- §3 layer rule (no SQL in routers — fixed in commit `dcddd21`)
- §38.3 decision audit row
- §41.4 rate limiting middleware
- §43 drill discipline
- §47.6 SOC2 CC6.1/CC6.2 (auth + RBAC)
- §57 production-grade discipline (5 layers)
- §64.30 12-tier testing scaffold (this is tier 3 api)
- §64.42 master testing matrix (Karate / Tavern / Bruno alternatives)
- §73 autonomous task handling (every test scheduled)
- §74.5 task matrix — API change = "edit + run tests"
- §75.6 Definition of Done #2 (validation per task-type matrix)
- §78 TDD-first global policy

## Tools for API testing

| Layer | Tool | Wired? |
|---|---|---|
| Smoke (HTTP) | `urllib` / `curl` | ✓ (test-runner api surface) |
| Browser-driven UI | Playwright | ✓ (test-runner frontend surface) |
| Semantic browser | Stagehand | ✓ (3.21 installed) |
| Computer Use Agent | `cua_sdk` | ✓ ready-to-key |
| Property-based fuzz | `hypothesis` / Schemathesis | ⚠ deps installed, not wired |
| Contract testing | Pact | ⚠ not installed |
| Load testing | `k6` / `locust` | ✓ locust pip installed |
| Spec-first generation | Spec Kit | ✓ specify-cli + ~/.spec-kit clone |
| Security | OWASP ZAP / nuclei | ⚠ not installed |
