# Coverage Gap Matrix — Phase 6

Verified 2026-09-08. Consolidates TEST_STRATEGY.md's findings into a gap-priority view.

| Portal | Has any tests? | Real coverage gap | Priority to close |
|---|---|---|---|
| voice-agent-platform | No | Zero coverage on the Vapi tenant-isolation guard (which has already caught one real incident manually — see Phase 1) is the single highest-value missing test in this entire repo: a regression here would silently reopen a proven, previously-exploited failure mode | **P0** |
| password-manager | No | Zero coverage on the crypto round-trip (signup → encrypt → store → decrypt → login) — the app has literally never been run end-to-end, automated or manual | **P0** |
| ai-orchestrator-platform | No | Zero coverage on provider routing/fallback — directly relevant given this session found and fixed a 4-day undetected outage | **P0** |
| SohamYoga.Web | No (.NET) | Zero coverage on auth (ASP.NET Identity config, role checks) despite being the auth backend for the whole sohamyoga-frontend admin/customer surface | **P1** |
| market-research-portal | Partial (8 e2e tests) | No unit-level coverage; e2e suite exists but its last recorded run is 15 days stale (no CI hook) | **P1** |
| sohamyoga-frontend | Yes (153 files) | 24/56 domains lack dedicated unit tests; not run in CI at all (Phase 3/7 finding) — coverage exists but isn't enforced | **P2** (coverage exists, enforcement is the gap — see QUALITY_GATES.md) |

## No coverage tooling run in this pass

`npm run test:coverage` exists as a script in sohamyoga-frontend's `package.json` but was not
executed in this audit (would require installing/running the full suite, a meaningfully larger
action than the read-only investigation pattern used elsewhere in this audit). This is a real,
stated limitation — the 57% domain-proxy figure in TEST_STRATEGY.md is the best evidence-based
estimate available without that run, not a substitute for it.
