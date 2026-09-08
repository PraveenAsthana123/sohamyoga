# Test Strategy — Phase 6

Verified 2026-09-08. Real test-pyramid inventory across all 6 portals.

## Test pyramid (real counts)

| Layer | sohamyoga-frontend | market-research-portal | voice-agent-platform | password-manager | ai-orchestrator-platform | SohamYoga.Web |
|---|---|---|---|---|---|---|
| Unit (Jest/pytest/xUnit) | 125 files | 0 dedicated unit files (covered by e2e instead) | 0 | 0 | 0 | 0 (.NET, no test project exists at all) |
| Integration | Not separately tracked from unit | — | 0 | 0 | 0 | 0 |
| E2E (Playwright) | 28 spec files | 8 real `test()` blocks in `pipeline.spec.ts`, writing to a real `test_run` table | 0 | 0 | 0 | 0 |
| Accessibility | 1 file uses `@axe-core/playwright` | 0 | 0 | 0 | 0 | 0 |
| Security (SAST/DAST) | Real, but in-app/cron-triggered, not CI (Phase 7) | Not found | Not found | Not found | Not found | Not found |
| Performance/load | **0 anywhere in the repo** | 0 | 0 | 0 | 0 | 0 |
| AI output eval / prompt regression | **0 anywhere in the repo** | 0 | 0 | 0 | 0 | 0 |
| Tool-call / agent workflow tests | 0 | 0 | 0 (MCP server exists, untested this pass) | — | 0 | — |

**Finding TEST-01 (High):** 5 of 6 portals have **zero automated tests of any kind**.
sohamyoga-frontend and market-research-portal are the only two with real coverage, and even there,
performance/load testing and AI-output evaluation are completely absent repo-wide.

## sohamyoga-frontend domain coverage (proxy metric: does a domain have a matching `__tests__/domain/<name>/` directory)

56 domains total, 32 have a matching test directory = **57% domain-level coverage by this proxy**.
24 domains show no dedicated unit-test directory: `assurance`, `attendance`, `branding`,
`competitor`, `core`, `cta`, `customer`, `event`, `experimentation`, `form`, `funnel`, `growth`,
`ingestion`, `landingpage`, `marketresearch`, `module-registry`, `observability`, `onboarding`,
`platform-setup`, `reputation`, `seo`, `shared`, `usecase-registry`, `video`.

**Caveat, stated honestly:** this is a directory-naming proxy, not a true coverage measurement — some
of these 24 (notably `customer`) are known from Phase 1/PORTALS.md to be heavily covered by the 28
Playwright e2e specs instead of Jest unit tests (e.g. `customer-self-service.spec.ts` exists and is
real). A true statement requires a real coverage run (`npm run test:coverage`), not this proxy — see
COVERAGE_GAP_MATRIX.md for what a real run would need to confirm.

## Critical flows: covered vs. uncovered (cross-referencing Reality Matrix + this pass)

| Critical flow | Test coverage |
|---|---|
| Admin/customer auth gate (253 routes) | Not directly unit/e2e tested per-route; verified this audit via static grep instead (Phase 7) — a real testing gap, not just a documentation gap |
| Booking → Invoice/Order | Real, per module-registry `job_run`/verification notes, but not confirmed as an automated regression test specifically |
| Vapi assistant sync (voice-agent-platform) | **Zero automated tests** — only verified via live manual audit-log inspection this session |
| Zero-knowledge crypto (password-manager) | **Zero automated tests** — never run end-to-end at all, per Phase 1 |
| Multi-provider AI routing (ai-orchestrator-platform) | **Zero automated tests** |
| 17-phase research pipeline (market-research-portal) | Real — `pipeline.spec.ts` explicitly asserts "17 phase rows are real" |

## Recommended quality gate (proposal — see QUALITY_GATES.md for the CI-enforcement version)

Given 5 of 6 portals have zero tests, the highest-leverage next step is not "more tests everywhere"
but a **minimum smoke test per portal** (does the app start, does the health endpoint respond, does
login work) — cheap, catches exactly the kind of P0 incidents found in Phase 1 (dead backend,
broken build) automatically instead of via manual audit.
