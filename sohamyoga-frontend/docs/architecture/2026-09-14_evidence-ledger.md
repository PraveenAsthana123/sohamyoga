# Architecture: Evidence Ledger

Backlog item #1 (priority 1) of the 30-item roadmap backlog registered in
`module_registry` from the 2026-09-14 roadmap cross-check
(`docs/chatgpt-extracts/2026-09-14_marketing-greeting-exchange-soham-roadmap.md`).
The roadmap treats this classification model as its single most important
architectural spine — several later backlog items (KPI Engine, Opportunity
Engine, Competitor Benchmark, Pre-Sales Intelligence Engine) explicitly
depend on it.

## Scope decision

Real schema + real service + real wiring into one already-real producer
(`VoiceOfCustomerJob`), not a standalone table with synthetic rows. Every
`evidence_record` traces to a real `source_ref` — `recordEvidence()`
throws if `sourceRef` is empty, so there is no code path that lets a
caller write an untraceable claim.

## What was built

- `src/domain/evidence/db-schema.sql`: `evidence_record` table — real
  five-way `evidence_type` classification (FACT/ESTIMATE/INFERENCE/
  HYPOTHESIS/UNKNOWN), `confidence`, mandatory `source_type`/`source_ref`,
  soft polymorphic `subject_type`/`subject_id` (no FK, since evidence
  attaches to different real tables depending on subject type).
- `src/domain/evidence/EvidenceLedger.ts`: `recordEvidence`,
  `getEvidenceForSubject`, `getRecentEvidence`, plus two pure,
  unit-tested functions — `isCurrent` (real freshness check) and
  `findUnsupportedClaims` (the roadmap's own rule: a report may only
  assert a claim it can cite evidence for).
- Wired into `VoiceOfCustomerJob.ts`: each real Ollama-clustered theme
  (from real `campaign_lead.message`/`sentiment_log` text) now also
  writes one real `evidence_record` row — `evidenceType='INFERENCE'`
  (it's a model-derived grouping of real text, not a directly-observed
  fact), confidence via a disclosed deterministic heuristic (theme's
  share of real messages: ≥50% HIGH, ≥20% MEDIUM, else LOW),
  `sourceRef` pointing back to the real digest row.
- `/api/admin/evidence` + `/admin/evidence`: real admin viewer (KPIs by
  type, recent records table), nav link added.
- `src/__tests__/domain/evidence/EvidenceLedger.test.ts`: 7 tests for
  the two pure functions.

## Honest finding: a real staleness bug caught by reading the record back, not assumed

The first live run set `validUntil: periodEnd`, where `periodEnd` is
computed at the *start* of the job. Because the job's own Ollama call
takes 30-50 real seconds, and `collected_at` defaults to `now()` at
insert time (after the Ollama call completes), every evidence record was
already past its own `validUntil` the instant it was written —
`isCurrent()` would have reported every record as stale immediately.
Caught by querying `valid_until > collected_at` on the real inserted row
(false), not by inspecting the code alone. Fixed to set `validUntil` to
`periodEnd + 7 days` (when the next weekly digest naturally supersedes
this one) instead of `periodEnd` itself. Re-run confirmed
`valid_until > collected_at = true`.

## Verification

- `npx tsc --noEmit`: clean.
- `npx jest`: 4267/4269 passing (2 pre-existing failures in
  `SocialAccount.test.ts`, unrelated to this change — no files in
  `src/domain/social` were touched this session).
- Live (frontend :8095, backend :15070, real Postgres, real Ollama):
  inserted one real, tagged test contact-form message, triggered
  `VoiceOfCustomerJob` via the existing generic run-job endpoint (~40-48s,
  real Ollama call), confirmed real `evidence_record` rows written with
  correct claim text/confidence/source_ref, confirmed the `/admin/evidence`
  API reflects them, caught and fixed the staleness bug above, re-verified.
  Test data (campaign_lead row, digest row, evidence records) deleted and
  confirmed gone.
- `module_registry` updated: `evidence_ledger` built_status → `real`.

## Deliberately not built yet

- Only one producer wired (`VoiceOfCustomerJob`). Competitor findings,
  KPI computations, and opportunity scores will add more producers as
  those backlog items are built on top of this ledger — not done in
  this pass.
- No admin-side manual evidence entry form yet (viewer only).
- No automated staleness sweep/alert (an evidence record past its
  `valid_until` is queryable via `isCurrent()` but nothing currently
  runs that check on a schedule).

## Status

Built, live-verified, one real bug caught and fixed. First of 30
registered backlog items (see `module_registry` for the rest, in
priority order — KPI Engine is next, since it depends on this ledger).
