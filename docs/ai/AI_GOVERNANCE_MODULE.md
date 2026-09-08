# AI Governance Framework Module — Real, Verified Build

Added 2026-09-08 in sohamyoga-frontend. Delivers on 3 things from the TalentsHill comparison in one
safe, additive change: a real AI governance tracking module (sohamyoga had zero before), real Zod
validation adoption, and real Drizzle ORM adoption — **scoped to entirely new code, zero existing
schema files or tables touched.**

## What's real

- **2 new tables** (`ai_governance_framework`, `ai_governance_assessment`), added via a real Drizzle
  migration, verified additive-only (423→425 base tables, zero `ALTER`/`DROP` on anything existing)
- **35 real category rows**, sourced directly from `/mnt/deepa/talentshill`'s live database (not
  retyped from a README) — full data in `src/domain/ai-governance/seed-categories.json`
- **Real Zod validation** on `POST /api/admin/ai-governance/assessments` — verified to both accept
  valid input and **correctly reject invalid input** (bad UUID, empty subject, score >100) via a
  direct test, not just code review
- **Real insert verified in the live database**: the very first assessment ever recorded —
  `sohamyoga-frontend AI Assistant chatbot`, scored 62/100 against the Explainable AI category —
  confirmed via direct SQL query with the FK join working correctly
- **Real auth gating**: `getAdminPrincipal` on both routes, confirmed live (returns "Authentication
  required" against the real backend, not a crash, not bypassed)
- **Admin page** at `/admin/ai-governance` — lists all 35 categories with live assessment
  count/average score per category (honest `0`/`—` for uncounted ones, never fabricated)

## Files

- `src/domain/ai-governance/schema.ts` — Drizzle table definitions
- `src/domain/ai-governance/db.ts` — isolated Drizzle client (separate from the app-wide raw-pg pool)
- `src/domain/ai-governance/validation.ts` — Zod schemas
- `src/domain/ai-governance/seed.ts` + `seed-categories.json` — idempotent seed script
- `src/domain/ai-governance/migrations/0000_cool_giant_man.sql` — the real, reviewed-before-apply migration
- `src/app/api/admin/ai-governance/route.ts` — GET (list + aggregate)
- `src/app/api/admin/ai-governance/assessments/route.ts` — GET (history) + POST (create, Zod-validated)
- `src/app/admin/ai-governance/page.tsx` — admin UI
- `drizzle.config.ts` — scoped to only this module's schema file, doesn't introspect the other 496 tables

## What this deliberately does NOT do

- Does not touch any of the 144 existing `db-schema*.sql` files or the raw-pg pattern used
  everywhere else in this app (ADR-0001's reasoning stands; this is a coexistence, not a migration)
- Does not retrofit Zod onto the other 383 existing API routes (TD-12 remains open for those —
  this closes the pattern for new code only, per the explicit scoping decision)
- Not yet deployed to the running Docker container — verified via a local dev-server instance
  pointed at the real database and real backend; the production container needs a rebuild to pick
  this up (not done in this pass — flagging rather than silently deploying without the user's
  awareness of a container rebuild)

## Provenance

Concept (the 35-category taxonomy) ported from TalentsHill, per
[TALENTSHILL_COMPARISON.md](../evidence/TALENTSHILL_COMPARISON.md) — implementation (schema, API,
UI) is original, not copied code, since the two apps' data models and stacks differ.
