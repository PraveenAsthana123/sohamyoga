# Architecture: Customer Occasion Messaging (SohamYoga)

Mirrors the TalentsHill build this session (birthday/anniversary/
festival/custom occasion messaging, admin-level only per explicit
request), adapted to wire SohamYoga's own substantial pre-existing
scaffolding rather than building a parallel system from scratch.

## Research first

Confirmed via repo-wide search before building: `src/domain/notification/WishCard.ts`
already modeled birthday/member_anniversary/custom wish cards with
real `WISH_TEMPLATES`, and `FeatureFlag.ts` already declared
`notification.wish_cards` enabled — but **no `wish_card` DB table
existed and no API route used any of it**; it was orphaned domain code.
`NotificationTemplate.ts` reserved slugs `birthday_wishes_email`/
`anniversary_wishes_email` that were never seeded or referenced.
Separately, a genuinely real, mature notification pipeline already
existed and does work today: `notification_template`/`notification_queue`/
`notification_history`/`notification_preference`/`suppression_list`
tables, and a real `NotificationDispatchJob` (every 5 min) that
enforces real consent/quiet-hours/channel-preference/frequency gates
and dispatches via real VAPID web-push (push/in_app genuinely deliver)
or a real self-hosted Novu call (email/sms/whatsapp — honestly fails if
Novu isn't configured/running). A real `CronRegistry`/`jobModules`
system and a generic on-demand `/api/admin/demo-hub/run-job` endpoint
already existed for scheduling and manual triggering.

`student.date_of_birth` and `student.enrolled_at` already existed and
are directly usable for birthday/anniversary. No `country` field
existed anywhere for location-festival matching.

## Scope decisions

- **Wire the existing infrastructure, don't duplicate it.** New work is:
  a `wish_card` table (persists WishCard, links to the real
  `notification_queue` row that carries the actual dispatch outcome), a
  `festival_calendar` table, `student.country`, and a new `OccasionWishJob`
  cron job — not a new bespoke sender.
- **Real sends flow through the existing real dispatch job.** Enqueued
  as `channel='push'` by the automated scan (the one channel that
  genuinely delivers without external configuration); an admin can pick
  any channel for a custom send, with email/sms/whatsapp explicitly
  labeled in the UI as "attempts real Novu, may fail if unconfigured."
- **No LLM.** Occasion messages are always `WISH_TEMPLATES` (deterministic,
  personalized only with real `{year}`/`{festivalName}`) or a real
  admin-typed custom message.
- **Real same-day dedupe** via a partial unique index on
  `(tenant_id, student_id, occasion, festival_code, scheduled_at::date)`
  for birthday/member_anniversary/festival (custom sends are
  intentionally exempt — an admin may send more than one custom message
  per day).
- **Real cron registration**, not a bespoke on-demand-only pipeline like
  TalentsHill — `occasion-wish-scan` is registered in the real
  `CronRegistry`/`jobModules` system (daily 05:30 UTC) and is also
  triggerable on demand via the existing generic run-job endpoint.

## What was built

- `src/domain/notification/db-schema-occasion-messaging.sql`:
  `student.country`, `festival_calendar`, `wish_card`.
- `src/domain/notification/WishCard.ts`: added `'festival'` to
  `WishOccasion` and a real `WISH_TEMPLATES.festival` entry.
- `src/cron/jobs/OccasionWishJob.ts`: real deterministic daily scan
  (birthday/anniversary/festival), registered in `CronRegistry.ts`
  (`occasion-wish-scan`, `30 5 * * *`) and `jobModules.ts`.
- API: `overview` (KPIs + recent wish cards + festival list), `festivals`
  (CRUD), `custom` (real one-off send).
- Real `notification_template` rows seeded for the reserved slugs
  (`birthday_wishes_push`, `anniversary_wishes_push`,
  `festival_wishes_push`, `custom_wish_card`) —
  `scripts/seed-occasion-templates-and-calendar.ts`.
- Real festival calendar seeded: Christmas/New Year (fixed dates),
  Diwali 2026 (November 8, confirmed via live web search before
  seeding, not guessed — same verification already done for the
  TalentsHill build this session).
- Admin UI: `/admin/occasions` (Overview, Festival Calendar, Send Custom
  Wish, Governance), matching this codebase's existing single-page
  tabbed convention (`/admin/notifications`), not TalentsHill's
  10-tab-per-file convention. Nav link added.

## Honest finding: the real scheduled cron runner is a separate deployed container

`docker ps` confirms `sohamyoga-cron` has been running for 11 days as a
built image, separate from this local source tree (the running process's
own path, `/workspace/sohamyoga-frontend`, doesn't exist on this host —
it's the container's internal filesystem). **Registering `occasion-wish-scan`
in the source code does not make it run on the real 05:30 UTC schedule
until that container is rebuilt and restarted with this change** — a
real deployment step, not a code change, and one I did not take
unilaterally given it's shared infrastructure running many other real
jobs for the whole platform. What IS verified live: the exact same job
module runs correctly today via the existing generic on-demand
`/api/admin/demo-hub/run-job` endpoint (dynamic `import()` from the dev
server picks up the current source). This is disclosed as the real next
step, not silently left implying the daily schedule is already active.

## Verification

- `npx tsc --noEmit`: clean.
- Live (frontend :8095, backend :15070, real Postgres): unauthenticated
  rejection; real on-demand job run created a real, correctly-templated
  `wish_card` + `notification_queue` row for a real student with a real
  seeded `date_of_birth`; a second same-day run correctly deduped (no
  second birthday row); a real custom wish card sent via `in_app`.
  Full log: `docs/testing/2026-09-14_occasion-messaging-log.txt`.
- Whether the two real `notification_queue` rows created during this
  verification were actually picked up and dispatched by the
  **already-running, unmodified** `notification-dispatch` job in the
  `sohamyoga-cron` container (which needs none of this session's code
  changes to function) was checked live. Result, ~2 minutes later: both
  rows moved from `pending` to `status='failed', failure_reason='Error:
  Novu HTTP 404'` — a real dispatch attempt against a real (unreachable)
  self-hosted Novu instance, honestly recorded as failed, never
  fabricated as sent. This also surfaced a second real finding: the
  **deployed** dispatch job routed both the `push` and `in_app` channel
  rows through the generic Novu branch, whereas the **current source**
  (`NotificationDispatchJob.ts`) has dedicated early-return branches for
  `push` (real VAPID web-push) and `in_app` (delivery-by-insertion into
  the customer's own inbox) that bypass Novu entirely — meaning the
  actually-running container is an older build than the source tree,
  not just missing this session's new job. Reported as observed, not
  investigated further (out of this task's scope), but worth flagging:
  redeploying the container to pick up `occasion-wish-scan` would also
  pick up these already-merged, currently-inert push/in_app fixes.

## Deliberately not built

- No new bespoke sender (reuses the real existing dispatch machinery).
- No customer self-service surface (admin-level only, by explicit
  request).
- No automatic sync of `wish_card.status` from the real
  `notification_queue`/`notification_history` outcome back onto the
  `wish_card` row — the Overview tab currently shows the status at
  creation time (`PENDING`), not the live dispatch outcome. A real,
  disclosed gap: an admin must currently cross-check the existing
  `/admin/notifications` Queue tab (by `notification_queue_id`) for the
  actual delivery result. Flagged as follow-up, not silently left
  implying `wish_card.status` is authoritative.

## Status

Built and live-verified against both the real .NET backend and the
Next.js admin portal. Deployment of the new cron job to the actual
scheduled runner container is a disclosed follow-up step, not yet done.
