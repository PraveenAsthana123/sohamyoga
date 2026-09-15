# Architecture: Audience Intelligence (Segments)

Backlog item #5/30.

## Important correction to the original roadmap cross-check

The 2026-09-14 roadmap cross-check doc classified this as **NOT BUILT**
("No dedicated segment/persona/intent/channel-affinity domain model was
found"). That was wrong — the grep pattern used
(`persona\|audience.intelligence`) missed the real, substantial
implementation that already existed under different naming:
`src/domain/campaign/AudienceSegment.ts` (a validated criteria/logic
domain class) and `src/domain/campaign/SegmentEvaluator.ts` (a real
criteria-to-SQL evaluator supporting 10 fields — `last_active_days`,
`signup_days_ago`, `birthday_month`, `preferred_style`, `class_count`,
`has_referrals`, `membership_plan`, `total_spend_cad`, `pose_score_avg`,
`challenge_completed` — each with a documented real data source, and
explicitly throwing rather than fabricating a count for any unsupported
field like `location`), backed by a real `audience_segment` table and a
fully-wired `/api/crm/segments` GET/POST/PATCH API with real computed
counts.

**Caught by accident, not by re-reading the cross-check doc**: applying
this session's own schema for a new `audience_segment_snapshot` table
hit a Postgres index-name collision (`idx_audience_segment_tenant`
already existed) — investigating the collision revealed the real
existing system. The duplicate table was dropped immediately, not kept
alongside the real one.

## What was actually missing (and built)

Just the admin UI. `/admin/segments`: shows the 4 real built-in
segments (High-Value Members, At-Risk Members, Win-Back Candidates,
Corporate Prospects — all live-computed against real `customer`/
`churn_prediction`/`campaign_lead` tables), a real criteria builder for
custom segments (restricted to the 10 real supported fields — the UI
does not offer `location` as an option, since the evaluator has no real
data source for it), and a recompute action per custom segment.

## Deliberately not built

No fabricated persona narratives ("busy Sarah, 35, ..."). This session's
own real student data was checked live and found homogeneous on every
demographic field (`experience_level`, `dosha_type`,
`yoga_style_preference`, `country` — see the Competitor Benchmark
Engine doc for the same finding applied elsewhere) — inventing rich
persona narratives on top of data that doesn't actually vary would be
exactly the kind of fabrication this session has been avoiding
throughout. Real, computed segment counts are the honest substitute.

## Verification

- `npx tsc --noEmit`: clean.
- Live (frontend :8095, real Postgres): confirmed the 4 real built-in
  segment counts (0/1/0/0), created a real custom segment
  (`signup_days_ago <= 14`), confirmed its real computed count (107)
  exactly matches a direct `SELECT COUNT(*)` against `student.enrolled_at`
  run independently. Test segment deleted and confirmed gone. Full log:
  `docs/testing/2026-09-14_audience-segments-log.txt`.
- `module_registry` updated: `audience_intelligence` built_status →
  `real`, description corrected to explain the original miss.

## Status

Built (backend pre-existing, UI new this session), live-verified. Fifth
of 30 registered backlog items — and a reminder to verify each
remaining item's real state directly rather than trusting the original
cross-check's verdict at face value. Next: Lead Scoring + Next-Best-Action
(#6/30).
