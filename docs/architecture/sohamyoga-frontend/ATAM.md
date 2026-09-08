# ATAM-style Architecture Tradeoff Analysis — sohamyoga-frontend

Lightweight ATAM pass (utility tree + sensitivity/tradeoff/risk points), grounded in the LLD
investigation. Not a full formal ATAM workshop — no stakeholder scenario-elicitation session has
been run; this is a single-analyst pass against real code.

## Utility tree (quality attributes, prioritized by what the codebase itself treats as important)

- **Security** (High business impact / High architectural difficulty)
  - Role separation enforced per-route (Admin/Editor/Sales vs. Customer vs. public)
  - Secrets fetched from OpenBao vault at runtime, not env-var-only
  - In-app SAST/DAST/SCA/IaC scanning subsystem exists and persists findings
- **Modifiability** (High / Medium)
  - 57 independently-schemaed domains, each with its own `db-schema*.sql`
  - No ORM, no central migrations — schema changes are manual per-domain
- **Testability** (Medium / Medium)
  - 125 Jest unit test files + 28 Playwright e2e specs exist
  - Not enforced in CI (lint/typecheck/build only)
- **Availability** (Medium / Low)
  - Single Postgres instance, no read replica or failover config found in `docker-compose.yml`
  - Healthchecks exist for `postgres`, `backend`, `ollama-bridge`, `frontend`

## Sensitivity points, tradeoffs, and risks

| ID | Point | Attribute(s) | Finding |
|---|---|---|---|
| S-1 | No `middleware.ts` | Security | Access control is per-route (`requireAdmin`/`requireCustomer` called in 230/38 files respectively) rather than centrally enforced at the edge. **Risk:** a new API route that forgets to call the gate helper is silently unprotected — nothing catches this structurally. Mitigate with a lint rule or a route-inventory audit, not yet present. |
| S-2 | No central migrations | Modifiability | 144 domain-sharded `db-schema*.sql` files, applied by hand. **Risk:** no migration history, no rollback, no environment-drift detection as the schema grows past 496 tables. |
| T-1 | Security scanning in-app, not CI-gated | Security vs. Deployability | [ADR-0004](ADR/0004-security-scans-in-app-not-ci.md) — real scanners exist but don't block merges. **Tradeoff:** faster iteration now, at the cost of no automated pre-merge security gate. |
| T-1b | IaC scanner can't cover `docker-compose.yml` | Security | Documented tool limitation (Trivy 0.70.0 / Checkov 3.3.16), not a code bug — accepted gap. |
| R-1 (non-risk) | No graph/vector DB | — | Confirmed absent, and nothing in the current codebase depends on one existing — not a risk, just a capability gap for future RAG work. |
| R-2 | `teaching/` domain is an empty stub | Completeness | Directory exists with zero files — either dead scaffolding or an unstarted domain; needs a decision either way. |
| R-3 | CI has no test-execution step | Testability | 153 real test files exist but a broken test would not block a merge today. |

## Recommendation summary (not yet actioned — for the project owner to prioritize)

1. Decide whether to add a lint rule / route-inventory check to catch API routes missing an auth
   gate call (closes S-1).
2. Decide whether CI should run `npm test`/`npm run test:e2e` as a merge gate (closes R-3).
3. Decide whether the in-app security scan results should also fail CI on high-severity findings
   (closes T-1), and whether an SBOM/Dependabot config is worth adding.
4. Resolve the empty `teaching/` domain (delete or scope it) (closes R-2).
