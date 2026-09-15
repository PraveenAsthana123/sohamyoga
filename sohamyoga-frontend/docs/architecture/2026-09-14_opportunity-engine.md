# Architecture: Opportunity & Benchmark Engine

Backlog item #3/30, depends on KPI Engine (#2) + Evidence Ledger (#1).

## Scope decision

Real candidate generation over real `kpi_snapshot` rows only — never a
synthetic opportunity. A dimension becomes a candidate only if its real
confidence is LOW/UNKNOWN, or its real value crosses a disclosed,
hardcoded threshold (a business judgment call, not derived from any
external benchmark — none exists in this build, stated plainly rather
than presented as industry data). Per the roadmap's own rule (Epic N:
"never recommend a solution that isn't itself demo-ready"), every
`recommendedSolution` names a real, already-built module in this
codebase, or is explicitly `null` when none exists yet.

## Live result (from the real 8 KPI dimensions computed for item #2)

4 real candidates generated, ranked by priority:
1. `referral_growth` (0, low_confidence) → points to the real Referral/Affiliate domain
2. `reputation` (0, low_confidence) → points to the real Google Business integration
3. `revenue` (0, low_confidence) → points to the real Ecommerce/payment domain
4. `operational_health` (75% vs. disclosed 90% threshold) → no mapped solution (honestly `null`, not invented)

All three zero-value dimensions correctly surfaced as top candidates
with real, actionable, already-built remediation paths — not because
they were forced to the top, but because they're both genuinely
low-confidence (0 real samples) and have real existing modules that
could address them.

## What was built

- `src/domain/opportunity/db-schema.sql`: `opportunity_candidate`.
- `src/domain/opportunity/OpportunityEngine.ts`: pure, unit-tested
  `computeImpactScore`/`computeFeasibilityScore`/`computePriorityScore`,
  plus `runOpportunityEngine()` orchestrator and `getTop3Opportunities()`.
- `/api/admin/opportunities` (GET/POST) + `/admin/opportunities` UI.
- `src/__tests__/domain/opportunity/OpportunityEngine.test.ts`: 8 tests.

## Verification

- `npx tsc --noEmit`: clean.
- `npx jest`: 19/19 passing across Evidence Ledger + KPI Engine +
  Opportunity Engine suites.
- Live (frontend :8095, real Postgres): unauthenticated rejected; POST
  generated 4 real candidates from the real KPI snapshots computed for
  item #2, correctly ranked, correctly citing real solution modules;
  GET confirmed persistence. Full log:
  `docs/testing/2026-09-14_opportunity-engine-log.txt`.
- `module_registry` updated: `opportunity_engine` built_status → `real`.

## Deliberately not built yet

- Thresholds are hardcoded for 3 of 8 dimensions (engagement, retention,
  operational_health) — the other 5 have no disclosed threshold, so
  they can only ever surface as candidates via the low-confidence path,
  never the below-threshold path.
- Only 5 of 8 dimensions have a mapped real solution.
- No scheduled cron job — on-demand only, same as the KPI Engine it
  depends on.

## Status

Built, live-verified. Third of 30 registered backlog items. Next:
Competitor Benchmark Engine (#4/30), extending the existing real
`competitor/` price-tracking domain.
