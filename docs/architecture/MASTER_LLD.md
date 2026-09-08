# Master Low-Level Design — Repository-Wide

Verified 2026-09-08. Cross-portal implementation patterns — repeated designs worth naming once
rather than re-describing per portal (each portal's own LLD, where one exists, has the full detail).

## Auth gate pattern (repeated 5 times, independently)

Every custom-built portal (all except SohamYoga.Web, which uses ASP.NET Identity) implements the
same shape: a `requireX(req)`/`getXPrincipal(req)` helper that (1) reads a cookie, (2) looks up a
hashed token in a DB session table, (3) checks `expires_at`, (4) returns `{principal, denied}`. This
pattern is correctly implemented independently 5 times — real evidence found zero gaps in any of
the 5 implementations individually — but it is genuinely duplicated logic across the repo. A shared
`@sohamyoga/auth-core` package (mirroring the existing `shared-backend` pattern) would remove the
duplication without changing behavior — a real, low-risk refactor candidate for Phase 3 (Code
Quality) to weigh.

## Domain-sharded SQL pattern (sohamyoga-frontend, market-research-portal, voice-agent-platform, password-manager)

All 4 Node-based portals with a real schema use the same low-level pattern: no ORM, a hand-rolled
`pg` pool wrapper, and one-or-more `db-schema*.sql` file per domain/feature, applied by hand (no
central migrations table with rollback support anywhere — see Phase 4 for the detailed database
audit). This is consistent across the whole workspace, not just sohamyoga-frontend.

## "Honest degradation" pattern (repeated, deliberate, and verified real)

A named, recurring code pattern found independently in multiple portals: when a real integration is
missing (no SMTP host, no PSTN provider, no Postiz key), the code returns an explicit
`NOT_CONFIGURED`/`blocked`/`queued`-never-`sent` state rather than fabricating success. Found in:
sohamyoga-frontend's Drip Campaigns, market-research-portal's Campaign Send and Voice Call Dispatch,
SohamYoga.Web's email test endpoint. This is a genuine, repeated architectural discipline — worth
naming as a pattern because Phase 12 (Product Readiness) and Phase 13 (Provenance) both need to
distinguish "not built" from "honestly blocked, code is real."

## Health-score computation pattern (sohamyoga-frontend only)

`src/domain/shared/HealthModel.ts` is reused by 6 domain-specific health scores (Social, Feedback,
Research, Course, Communication, Brand) — a genuine shared abstraction within one portal, not
duplicated 6 times. Contrast with the auth-gate pattern above, which IS duplicated — this shows the
codebase does deduplicate when the abstraction is easy (single-portal, single-language) and doesn't
when it would require cross-portal package extraction (harder, not yet done).

## Cron/scheduling pattern

No portal uses a real job queue (Bull, Celery-equivalent, etc.). Every scheduled job in this repo is
either `node-cron` in-process (sohamyoga-frontend, market-research-portal — the latter's runner had
no persistent host process until this session's Phase 1 fix) or a systemd timer calling a script
(ai-orchestrator-platform's `local_ai_maintenance.py`). No distributed job coordination exists — not
needed at current single-instance-per-portal scale, but would need to change before any horizontal
scaling of a portal.
