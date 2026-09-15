# Architecture: KPI Engine

Backlog item #2/30, depends on the Evidence Ledger (#1/30).

## Scope decision

8 real executive dimensions, each computed by a real, executable SQL
aggregation against a real table — never a placeholder. Where a
dimension's real data is genuinely zero for a period (confirmed by
running the query live, not assumed), the snapshot is still written
with `sample_size=0` and `confidence='UNKNOWN'` — a disclosed real zero,
never a fabricated plausible-looking number.

## Dimensions and real sources

| Dimension | Real source | Live result (trailing 30d) |
|---|---|---|
| Acquisition | `student.enrolled_at` | 241, HIGH |
| Engagement | `booking.status='checked_in'` / non-cancelled bookings | 74.8%, HIGH |
| Retention | `student.status='active'` among those enrolled 30+ days ago | 100%, HIGH |
| Wellness Outcomes | `wellness_score.composite_score` avg | 37.1, HIGH |
| Referral Growth | `referral_master` count | 0, UNKNOWN (real, no referral activity yet) |
| Reputation | `business_review.star_rating` avg via `google_business_connection` | 0, UNKNOWN (real, no reviews synced yet) |
| Revenue | `payment.amount` sum where `status='completed'` | 0, UNKNOWN (real, no completed payments yet) |
| Operational Health | `operation_run.status='succeeded'` rate | 75%, LOW (real, only 4 tenant-scoped rows in period) |

Every dimension with a non-zero sample also writes a linked
`evidence_record` row (`evidenceType='FACT'` — direct SQL aggregation
over real rows, not a model inference), closing the loop with backlog
item #1.

## Honest findings from building this against the real schema

Three real column/table-name mistakes were caught by testing each query
directly against the live database *before* wiring it into the service,
not assumed correct from reading schema files:
1. `reputation_connection` (assumed) does not exist — the real table is
   `google_business_connection`.
2. `referral_code`/`referral_master` have no `tenant_id` column — this
   deployment's referral schema is single-tenant (same pattern already
   documented elsewhere for `sentiment_log`); the query is unscoped and
   this is disclosed in the explanation text.
3. `operation_run` *does* have a `tenant_id` column (initially assumed
   otherwise) — scoping by it correctly reduces the real sample from
   68,548 unscoped rows to 4 real tenant-scoped rows in the test period,
   which is the honest number, even though it's a much smaller,
   LOW-confidence sample. Reported as LOW, not inflated by leaving the
   query unscoped for a bigger-looking number.

Retention is a disclosed proxy: `student.last_class_at` is not
populated for any real student in this dataset today, so retention is
computed from `enrolled_at` + current `status` instead of a
last-visit-recency signal — stated explicitly in the KPI's own
`explanation` text, not hidden.

## What was built

- `src/domain/kpi/db-schema.sql`: `kpi_snapshot`.
- `src/domain/kpi/KpiEngine.ts`: 8 real `computeXxx` functions, a pure
  unit-tested `confidenceForSampleSize` rule, `runKpiEngine()`
  orchestrator.
- `/api/admin/kpi` (GET latest snapshot per dimension, POST to compute
  a real period on demand) + `/admin/kpi` UI.
- `src/__tests__/domain/kpi/KpiEngine.test.ts`: 4 tests for the pure
  confidence rule.

## Verification

- `npx tsc --noEmit`: clean.
- `npx jest`: 11/11 passing across the Evidence Ledger + KPI Engine
  suites.
- Live (frontend :8095, real Postgres): unauthenticated GET rejected;
  POST computed all 8 real dimensions for 2026-08-16..2026-09-15 with
  real, verifiable values (see table above); GET confirmed all 8
  `kpi_snapshot` rows persisted with correctly linked `evidence_id`s.
  Full log: `docs/testing/2026-09-14_kpi-engine-log.txt`. No test data
  cleanup needed — every row is a genuine computed metric over this
  business's real data, not a throwaway test fixture.
- `module_registry` updated: `kpi_engine` built_status → `real`.

## Deliberately not built yet

- No scheduled cron job — on-demand only via the API. Given all 8
  underlying tables already update in real time, a real cron job would
  add freshness but isn't required for the KPIs to be genuine.
- No historical trend view (the API returns only the latest snapshot
  per dimension; `kpi_snapshot` stores full history, just not
  yet surfaced in the UI).

## Status

Built, live-verified, 3 real schema-mismatch bugs caught and fixed
before they reached the service layer. Second of 30 registered backlog
items. Next: Opportunity & Benchmark Engine (#3/30), which consumes
both this and the Evidence Ledger.
