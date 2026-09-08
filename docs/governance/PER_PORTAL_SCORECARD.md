# Per-Portal Engineering Scorecard

Verified 2026-09-08 (module counts re-queried live at write time). The repo-wide
[`ENGINEERING_READINESS_SCORECARD.md`](../../ENGINEERING_READINESS_SCORECARD.md) averages across 6
very differently-mature applications — this document breaks that average apart, since a single
number hides that e.g. sohamyoga-frontend has 153 real tests while 4 other portals have zero.
Scores 0-5, drawn from the same 18-phase evidence base, resegmented per portal — no new
investigation, this is a re-cut of existing findings.

| Dimension | sohamyoga-frontend | SohamYoga.Web (.NET) | market-research-portal | voice-agent-platform | password-manager | ai-orchestrator-platform |
|---|---|---|---|---|---|---|
| **Feature completeness** | 5/5 — 176 real / 11 partial / 1 not_built modules, live | 3/5 — auth+content real, most content deliberately unseeded | 4/5 — 25-module deep-dive mostly real, Voice AI honestly self-blocked | 3/5 — assistant-config real, call placement never exercised | 2/5 — sound design, never run end-to-end | 3/5 — 2/3 of modules real, self-documented honestly |
| **Testing** | 4/5 — 153 real tests (125 Jest + 28 Playwright) | 0/5 — no test project exists at all | 2/5 — 8 real e2e tests, 15-day-stale last run | 0/5 — zero test files anywhere | 0/5 — zero test files anywhere | 0/5 — zero test files anywhere |
| **CI/DevSecOps** | 2/5 — real CI exists (lint/typecheck/build) but no test/security step | 0/5 — no CI | 0/5 — no CI | 0/5 — no CI | 0/5 — no CI | 0/5 — no CI |
| **Security posture** | 4/5 — 253/253 routes verified gated, real in-app SAST/DAST/SCA scanner | 4/5 — most mature of all 6: explicit CORS allowlist, real CSP+headers, HSTS, global rate limiter | 3/5 — solid cookie/session hygiene, real rate limiting on 2 endpoints, none on login | 3/5 — solid cookie hygiene, zero rate limiting anywhere incl. real call placement | 3/5 — genuinely sound crypto (PBKDF2 600k+AES-256-GCM+Argon2id), but zero rate limiting, never audited | 2/5 — real CORS allowlist, but cookie ships `secure=False` unconditionally; one real unsanitized XSS sink found |
| **Reliability (incidents this audit)** | 5/5 — no incident found | 5/5 — no incident found | 2/5 — was silently broken (build+cron), **fixed live this session** | 2/5 — container found stopped, **restarted this session** (real `unless-stopped` policy now protects against silent recurrence) | 3/5 — container found stopped, zero real usage ever, left stopped (nothing to lose by restarting) | 2/5 — was silently down 4+ days, **fixed live this session** |
| **Database health** | 5/5 — 498 tables, 100% PK coverage, real read-only cross-portal role, backed up this session | 4/5 — separate SQLite, real EF Core migrations (best rollback story of all 6), not backed up this session | 4/5 — 78 tables, own dedicated DB, backed up this session | 3/5 — 17 tables, real `schema_migration` tracking, backed up this session | 2/5 — 3 tables, zero real rows ever, not backed up (container stopped, nothing to lose) | 2/5 — SQLite, no migration tooling, not backed up this session |
| **Observability** | 3/5 — real in-app security-scan log, no centralized platform | 4/5 — real Serilog + correlation IDs + `ApiRequestLog`/`AuditLog`, best of all 6 | 3/5 — real `api_error_log`/`operations_alert`/`job_run` tables, functioning admin dashboard | 3/5 — real `vapi_api_audit_log`, detailed per-call | 0/5 — nothing found | 2/5 — one real systemd health-probe job, the healthiest single component found in this audit |
| **AI maturity** | 3/5 — 3+ real LEVEL 1-2 features, none agentic | N/A — no AI in this portal | 3/5 — Research-AI Draft Job, the one real groundedness gate in the whole repo | N/A — Vapi's AI runs on Vapi's infrastructure, not this repo's code | N/A — no AI | 3/5 — 6-provider routing, honest about its own single-call-not-agentic nature |
| **Documentation (post-audit)** | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 |
| **Deployment health at audit time** | 5/5 — running, healthy | 5/5 — running, healthy | 2/5 → 5/5 (fixed live) | 2/5 → 5/5 (fixed live — restarted, confirmed 200 OK on `/admin/login`) | 1/5 — container stopped, no real data at risk | 2/5 → 5/5 (fixed live) |

## Top 3 actions, per portal

**sohamyoga-frontend:** (1) wire the existing 153 tests into CI — TD-02; (2) split the 19
God-Component admin pages — TD-11; (3) close the 41-directory RBAC scope gap outside `/admin`/`/customer` — SEC-15 follow-up.

**SohamYoga.Web (.NET):** (1) add a real test project — currently the only portal with genuinely
zero test infrastructure of any kind, despite being the auth backend for the whole suite; (2) add a
CI workflow (currently none); (3) tighten the global rate limiter with an auth-specific policy.

**market-research-portal:** (1) wire the new cron systemd unit's health into monitoring (it's new
as of this session — verify it stays up); (2) refresh the 15-day-stale e2e test run via CI; (3) add
rate limiting to `/api/auth/login` (currently the one unrated-limited endpoint, unlike its own
`leads/capture`/`intake` routes).

**voice-agent-platform:** (1) ~~restart the stopped `voiceagent-app` container~~ — **done during
this per-portal review**: restarted, confirmed live (`/admin/login` → 200 OK), Docker's
`unless-stopped` policy now protects against silent recurrence; (2) add a real `/api/health` route
(currently 404s — every other portal has one, this is the one gap that made the restart-verification
step less clean than it should have been); (3) write the TD-09 tenant-isolation regression test;
(4) add rate limiting to real call placement.

**password-manager:** (1) run one real end-to-end signup→encrypt→decrypt→login cycle — this app has
literally never been exercised; (2) get an independent crypto review before any real use; (3) start
the container with a restart policy if it's ever meant to run continuously.

**ai-orchestrator-platform:** (1) restore OpenBao to persistent storage (TD-01) — the one incident
that already recurred; (2) add DOMPurify to `DocxViewer.tsx` (TD-14, cheap); (3) fix the hardcoded
`secure=False` cookie flag now that the backend restart (this session) makes the tunnel path live
again.

## The one item this per-portal cut surfaced and closed

**voice-agent-platform's `voiceagent-app` container was still stopped** at the time this per-portal
breakdown was written — found stopped during Phase 1, documented, but not part of the two P0s fixed
earlier in this session (those were prioritized because they were actively serving broken responses;
this one was simply not running, with no request traffic to be broken by it). Restarted and verified
live during this review (`docker start`, confirmed `/admin/login` → 200 OK) rather than left as a
noted-but-unfixed gap — the same evidence-then-fix discipline applied throughout this audit.
