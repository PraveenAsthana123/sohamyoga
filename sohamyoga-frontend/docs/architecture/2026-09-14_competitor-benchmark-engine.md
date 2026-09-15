# Architecture: Competitor Benchmark Engine

Backlog item #4/30. Extends the existing real `competitor/`
price-tracking domain (added earlier, scoped to price only) into 8 real
benchmark dimensions, following the exact same honesty pattern already
established in that domain's own schema comment: "no external API can
honestly fetch a competitor's real digital-presence data — the real,
buildable feature is admin-entered observation, tracked over time."

## What was built

- `src/domain/competitor/db-schema-benchmark.sql`:
  `competitor_benchmark_score` — real, admin-entered 0-100 score per
  competitor per dimension (discoverability/website_quality/seo/
  local_presence/reputation/social_presence/content_quality/
  pricing_competitiveness), with a real `notes` field requiring what was
  actually observed.
- `src/domain/competitor/BenchmarkEngine.ts`: pure, unit-tested
  `computeCompositeScore` (average of only the real dimensions actually
  scored, never padded) and `computeGaps` (a real head-to-head gap only
  where a real comparable own-KPI value exists — currently just
  `reputation`, mapped to the real KPI Engine's reputation dimension).
- `/api/admin/competitors/benchmark` (GET/POST) +
  `/admin/competitors-benchmark` UI.
- `src/__tests__/domain/competitor/BenchmarkEngine.test.ts`: 6 tests.

## Live verification

Created a real, tagged test competitor via the existing
`/api/competitors` route, recorded two real observed scores
(reputation=85, seo=60), confirmed: composite = 73 (real average of the
two), and a real gap on reputation (their 85 vs. our real KPI-Engine
reputation value of 0 — honestly 0 because no real Google Business
reviews have synced yet, not a fabricated comparison number). No gap
computed for `seo` since this codebase has no comparable real own-SEO
KPI yet — correctly omitted, not guessed. Test competitor and scores
deleted and confirmed gone.

## Deliberately not built yet

- Only 1 of 8 dimensions (`reputation`) has a real comparable own-KPI
  to gap against; the other 7 remain competitor-only observations.
- No automatic competitor discovery or Direct/Search/Social/Aspirational
  labeling — competitors are still added manually via the pre-existing
  `/api/competitors` route.
- No Competitive Opportunity Matrix (impact × confidence × feasibility)
  specifically for competitor gaps — the general Opportunity Engine
  (#3/30) doesn't yet consume `competitor_benchmark_score`.

## Status

Built, live-verified. Fourth of 30 registered backlog items. Next:
Audience Intelligence (#5/30).
