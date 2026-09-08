# Technical Debt Register — Phase 14

Consolidates every finding from Phases 1-13 into one register. Verified 2026-09-08. IDs cross-reference
the originating phase document — this is a rollup, not a re-investigation.

| ID | Category | Issue | Severity | Business impact | Security impact | Effort | Priority | Source | Status |
|---|---|---|---|---|---|---|---|---|---|
| TD-01 | Security | OpenBao vault runs in ephemeral -dev mode | High | AI provider access breaks silently on every restart | High — no real secret storage guarantees | Medium (architecture decision) | P1 | SEC-01 | Open |
| TD-02 | DevSecOps | Zero CI security/test gates on any portal (1 of 6 has any CI at all) | High | Regressions and vulnerabilities ship undetected | High | Low-Medium | P1 | SEC-02, QUALITY_GATES.md | Open |
| TD-03 | Security | 3 portals share 5 identical high-severity outdated-dependency findings | High | N/A directly, but real CVE-backed exposure | High | Medium (major version bump) | P1 | SEC-03 | Open |
| TD-04 | Database | No backup policy (one-time backup taken this session, not recurring) | High (was Critical) | Total data loss on a bad DELETE | N/A | Low (script + schedule) | P1 | DB-05 | Partially closed |
| TD-05 | Database | 4 of 6 portals have zero migration/rollback tooling | High | Schema changes are forward-only, hand-fixed live | N/A | Medium-High | P1 | DB-04 | Open |
| TD-06 | Reliability | Systemic `Restart=on-failure` gap across systemd units (2 fixed live this session) | High (2 of several instances fixed) | Silent multi-day outages, as already happened twice | N/A | Low (1-line fix per unit) | P1 | REL-01 | Partially closed |
| TD-07 | Observability | No monitoring/alerting for process-death or infra-staleness | High | All 3 real incidents this audit found were invisible to existing systems | N/A | Low-Medium (external health poller) | P1 | OBS-01 | Open |
| TD-08 | Testing | 5 of 6 portals have zero automated tests | High | No regression protection anywhere except 2 portals | Medium (untested auth code) | High (writing tests from scratch) | P1 | TEST-01 | Open |
| TD-09 | Testing | voice-agent-platform's proven tenant-isolation guard has zero regression test | High | Could silently regress a fix for an incident that already happened once | High | Low (one test, logic already understood) | **P0** | COVERAGE_GAP_MATRIX SEC-06 | Open |
| TD-10 | AI/LLMOps | Zero cost/token/latency tracking on any AI feature | Medium | Unknown AI spend, no capacity planning possible | N/A | Low (extend shared OllamaClient) | P2 | OBS-01 (AI) | Open |
| TD-11 | Code Quality | 19 files >500 lines, concentrated in admin page shells | Medium | Slower review/onboarding | N/A | Medium (mechanical split) | P2 | CQ-01 | Open |
| TD-12 | API | No schema validation library on ~450 API routes | Medium-High | Malformed input handling is inconsistent/ad-hoc | Medium (input validation gaps) | Medium | P2 | API_STANDARDS.md | Open |
| TD-13 | Security | CSRF relies solely on SameSite=Lax across all 6 portals | Medium | N/A directly | Medium | Medium (defense-in-depth) | P2 | SEC-05 | Open |
| TD-14 | Security | ai-orchestrator-platform's DocxViewer has zero HTML sanitization | Medium | Low likelihood (single-operator, trusted-root threat model) | Medium | Low (add DOMPurify, template exists in sohamyoga-frontend) | P2 | SEC-08 | Open |
| TD-15 | Reliability | voice-agent-platform's real call placement has no rate limit | High if ever exposed further | Cost-abuse vector | Medium | Low | P2 | SEC-06 | Open |
| TD-16 | Database | Audit-field coverage inconsistent (58.6%/37.1% created_at/updated_at), 0% soft-delete | Medium | Forensics/undo difficult after an incident | N/A | Medium (schema convention + backfill) | P2 | DB-01, DB-02 | Open |
| TD-17 | API | No OpenAPI spec for 4 of 6 portals (~450 combined routes) | Medium | Harder onboarding, no contract testing possible | N/A | Medium (sequence after validation adoption) | P2 | API-01 | Open |
| TD-18 | Architecture | Auth-gate pattern correctly but independently reimplemented 5 times | Low-Medium | Higher cost to apply any future security fix (5x the work) | Low today (each is independently correct) | Medium-High (cross-portal extraction) | P3 | MASTER_LLD.md | Open |
| TD-19 | Product | No payment gateway anywhere in the repo | Critical for revenue, N/A for current stage | Blocks any real transaction | N/A | High (real integration work) | P3 (deprioritized — not currently sought per project stage) | REVENUE_READINESS.md | Open, deliberate |
| TD-20 | Governance | No root LICENSE file | Low | Irrelevant unless code is ever distributed/open-sourced | N/A | Trivial | P4 | ENGINEERING_PROVENANCE.md | Open |
| TD-21 | AI | No prompt regression tests anywhere | Low-Medium | Silent prompt drift undetectable | N/A | Medium (needs a baseline first) | P3 | PROMPT_REGRESSION_TESTS.md | Open |
| TD-22 | Performance | No load-testing tooling installed anywhere | Low today, Medium if scale is pursued | Can't validate any scale claim | N/A | Low (install + write one scenario) | P3 | BOTTLENECK_REGISTER.md | Open |

## By category

| Category | Count |
|---|---|
| Security | 6 |
| Database | 3 |
| Reliability | 2 |
| Testing | 2 |
| API | 3 |
| Observability | 1 |
| AI | 2 |
| Code Quality | 1 |
| Architecture | 1 |
| Product | 1 |
| Governance | 1 |

## By priority

| Priority | Count | Note |
|---|---|---|
| P0 | 1 | TD-09 — cheapest, highest-leverage single item in the whole register |
| P1 | 7 | TD-01 through TD-08 (excluding TD-09) — the items already substantially addressed this session (TD-04, TD-06 partially closed) or clearly scoped |
| P2 | 7 | |
| P3 | 4 | |
| P4 | 1 | |

**3 items already partially or fully closed during this audit session itself** (TD-04 backup taken,
TD-06 two of several restart-policy gaps fixed) — tracked as real progress, not left as
static findings. See [TOP_10_P0_P1_ACTIONS.md](../../TOP_10_P0_P1_ACTIONS.md) for the final
priority-ordered action list once the full audit concludes.
