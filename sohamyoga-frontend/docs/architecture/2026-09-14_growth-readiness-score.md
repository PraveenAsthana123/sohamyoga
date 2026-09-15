# Architecture: Growth Readiness Score

Backlog item #7/30. Confirmed genuinely absent (`grep -rln
"readiness_score|readinessScore|growth_score|GrowthScore"` returned zero
hits) before building — unlike items #5 and #6, this one was a real gap.

## Scope decision

Rather than build a new research pipeline from scratch, this rolls up
the real KPI Engine (#2) and Opportunity Engine (#3) already built this
session — matching the roadmap's own "business → research → evidence →
KPIs → score → report" flow, most of which was already real by the time
this item was reached. Only the 5 KPI dimensions on a real comparable
0-100 scale (`engagement`, `retention`, `operational_health`,
`wellness_outcomes`, `reputation`) are confidence-weighted into the
score; `acquisition`/`referral_growth`/`revenue` (count/currency units)
are shown as raw context, never force-normalized into a fabricated
0-100 — there's no honest way to do that without an external benchmark
this build doesn't have.

## Live result

`68.1/100`, confidence-weighted over 5 real dimensions. Verified by hand:
`(74.8×1 + 75×0.4 + 0×0.15 + 100×1 + 37.1×1) / (1+0.4+0.15+1+1) = 241.9/3.55 = 68.14`
— matches the live API output exactly.

## What was built

- `src/domain/kpi/GrowthReadinessScore.ts`: pure, unit-tested
  `computeGrowthReadinessScore` + `getGrowthReadinessReport()` (two-tier:
  customer one-pager + internal deep report, pulling real
  `kpi_snapshot` + `opportunity_candidate` rows).
- `/api/admin/growth-readiness` + `/admin/growth-readiness` UI.
- `src/__tests__/domain/kpi/GrowthReadinessScore.test.ts`: 3 tests.

## Verification

- `npx tsc --noEmit`: clean.
- `npx jest`: 7/7 passing (KPI Engine + Growth Readiness Score suites).
- Live (frontend :8095, real Postgres): confirmed 68.1/100, correct
  inclusion/exclusion of dimensions, real top opportunity pulled through
  from the Opportunity Engine. Full log:
  `docs/testing/2026-09-14_growth-readiness-log.txt`.
- `module_registry` updated: `market_research_golden_path` built_status
  → `real`.

## Deliberately not built

- No public customer-facing share-link page (admin-only report today).
- No historical trend of the score over time (each call recomputes live
  from the latest snapshots; nothing persists the composite itself).

## Status

Built, live-verified. Seventh of 30 registered backlog items.
