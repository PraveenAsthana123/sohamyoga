# Quality Gates — Phase 6

Verified 2026-09-08. Cross-references [SECURITY_GATES.md](../security/SECURITY_GATES.md) (Phase 7,
CI security gates) — this document is the testing-specific companion.

## Current CI enforcement (real, from Phase 7 investigation)

Only `sohamyoga-frontend/.github/workflows/ci.yml` exists among all 6 portals, and it runs:
`next lint` → `tsc --noEmit` → `next build`. **No test execution step of any kind.** 153 real test
files (125 Jest + 28 Playwright) exist and are never run automatically.

## Proposed minimum quality gate set (proposal, not implemented — matches the framework's own
instruction not to make the pipeline unreasonably slow)

| Gate | Where | Est. added CI time | Justification |
|---|---|---|---|
| `npm test` (Jest, 125 files) | sohamyoga-frontend `ci.yml` | Low (~1-2 min typical for this file count) | Highest-value, lowest-cost addition — tests already exist and pass locally per prior sessions' verification notes |
| `npm audit --audit-level=high` | sohamyoga-frontend `ci.yml` | Seconds | Already scoped in SECURITY_GATES.md; closes SEC-02/03/04 from the risk register |
| A minimal smoke-test workflow (health-check + login) | market-research-portal, voice-agent-platform, ai-orchestrator-platform, password-manager, SohamYoga.Web | Low per portal | These 5 portals have zero CI of any kind — even a build+health-check catches exactly the P0 incidents found in Phase 1 (dead backend, broken build) before they reach production, automatically |
| Playwright e2e (28 specs) as a separate, non-blocking or nightly job | sohamyoga-frontend | Higher (~5-15 min typical) | Valuable but slower — recommend nightly/on-demand rather than blocking every push, per the framework's own "don't make the pipeline unreasonably slow" instruction |

## What NOT to do (per this audit's own discipline)

Do not add all of the above in one PR — each is a separate, reviewable change. Do not make e2e tests
a blocking gate on every push given their runtime cost relative to the lint/build/unit gate. Do not
build a bespoke test-orchestration platform — `npm test` and a `workflow_dispatch`/`schedule`-triggered
e2e job are sufficient for the current scale (single-operator, 6 portals, no team to coordinate a
heavier CI investment against).

This document is a proposal — implementing it means editing `.github/workflows/*.yml` files, a real
code change outside the scope of "audit and document," offered here as a scoped, ready-to-execute
recommendation pending confirmation.
