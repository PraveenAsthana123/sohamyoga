# SohamYoga — Advanced Testing Summary

**Run date:** 2026-06-02T19:43Z
**Stack:** docker-compose (sohamyoga-backend healthy, sohamyoga-frontend healthy, sohamyoga-nginx)
**Commit:** `59f6600` (server-API URL fix + healthcheck) + this commit (test suites)

## Headline

**61 of 61 tests pass** across three surfaces: public API matrix, authenticated
API matrix, and Playwright browser smoke. Zero regressions after the
server-side API URL fix.

| Surface | Tool | Total | Pass | Fail | Report |
|---|---|---:|---:|---:|---|
| Public API matrix | `urllib` over nginx :8085 + backend :5070 | 32 | 32 | 0 | [api_test_*.md](api_test_20260602T194033Z.md) |
| Authenticated API matrix | `urllib` + cookie jar, admin + customer flows | 22 | 22 | 0 | [api_test_auth_*.md](api_test_auth_20260602T194014Z.md) |
| Playwright browser smoke | chromium headless via cached browsers | 7 | 7 | 0 | [playwright_smoke_*.md](playwright_smoke_2026-06-02T19-42-01Z.md) |

## What's covered

### Public API — 32 endpoints
- Health × 3 (direct + via-nginx + nginx root)
- Catalog GETs × 18 (home, settings, blog list/recent/categories, casestudies,
  industries + per-slug, services + featured + per-slug, testimonials, team,
  videos, jobs + departments)
- Negative slug 404s × 4 (industries, services, blog, jobs)
- Auth-gate 401s × 4 (admin /me, customer /me, admin/dashboard, live-chat sessions)
- POSTs × 2 (newsletter subscribe, contact submit — both 201 Created)
- Error envelope shape check on a known 404 (per global §6.2)

### Authenticated API — 22 endpoints (admin + customer)
- Admin login → /me → 12 admin-only endpoints (dashboard, contacts, newsletter,
  live-chat × 3, jobs × 2, team)
- **Role boundary**: admin hitting `[Authorize(Roles="Customer")]` → 403 (positive lock)
- Admin logout → /me → 401 (negative)
- Customer register → login → /me → logout → /me → 401 (full flow)
- Wrong password → 401
- Unknown user → 401

### Playwright browser smoke — 7 routes
- `/`, `/about`, `/blog`, `/industries/banking-finance`, `/industries/oil-gas`,
  `/services/sharepoint`, `/contact`
- Per route: HTTP status, title match, console-error count, full-page screenshot,
  body-text scan for any of `["This page could not be found", "Industry Not Found",
  "Service Not Found", "Post Not Found"]` (uses `innerText` to skip hidden script
  content).

## Not run (and why)

| Surface | Why not | What it would need |
|---|---|---|
| **CUA** (Anthropic Computer Use) | Paid Anthropic API key required; this stack is a Next.js + .NET CRUD app where Playwright already covers the browser-agent need. | Set `ANTHROPIC_API_KEY`, install `cua_sdk` per §77 row 1402, write a goal-driven scenario. |
| **Stagehand** (Browserbase) | Paid Browserbase account required; same coverage rationale. | Set `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID`, install `@browserbasehq/stagehand`, write semantic actions. |
| Built-in `api` / `frontend` surfaces of `agent test-runner all` | Stale — point at `localhost:8000` (insur_project bootstrap default); not retargeted for SohamYoga. | Edit `~/.claude/scripts/agent-test-runner.sh` constants OR override per-project via `.agent/`. |
| Built-in TDD / vector / chunking / guardrail / sync surfaces | Designed for AI/RAG projects; SohamYoga is a traditional web app — these will always be red/skip and the noise hides real signal. | Either disable for this project or wire SohamYoga-specific drills (§43). |
| Admin write operations (POST/PUT/DELETE on /api/blog, /api/services, etc.) | Invasive — creates DB rows; would need teardown to be idempotent. | Add a fixture cleanup hook OR run against a disposable test DB clone. |

## How to re-run

```bash
cd /mnt/deepa/slp
# Public matrix
/media/praveen/praveenlinux21/praveen/aman/cuda/venv/bin/python jobs/reports/run_api_tests.py
# Authenticated matrix
/media/praveen/praveenlinux21/praveen/aman/cuda/venv/bin/python jobs/reports/run_api_tests_authenticated.py
# Playwright smoke (one-time: npm i playwright in /tmp/sohamyoga-pw)
NODE_PATH=/tmp/sohamyoga-pw/node_modules node jobs/reports/run_playwright_smoke.js
```

## Composes with global policy

- §43 drill discipline — every test has at least one negative assertion
  (auth gates, role boundaries, slug-not-found, wrong credentials, post-logout)
- §47.6 SOC2 CC6.2 — role boundary `admin → 403 on Customer-only route`
  is a positive lock, not just an absence
- §51 forensic substrate — each run writes a dated JSON + MD snapshot under `jobs/reports/`
- §62 checklist format — pass/fail is the only thing the operator needs at a glance
- §64.30 (12-tier) + §65.8 (8-surface) — these scripts populate the **api** + **smoke** rows for SohamYoga
- §74.5 task matrix — "API: start service + curl test + error-log check" done
- §75.7 evidence — exit code + JSON + Markdown + screenshots constitute reproducible artifacts
- §77 row 1411 (multi-agent runtime) + 1422 (vector DB) — N/A for this project; intentionally skipped
- §78 TDD-first — these are integration drills, not unit; complement the §78 drill-per-feature pattern
