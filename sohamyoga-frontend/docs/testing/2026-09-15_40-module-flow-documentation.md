# 40-Module user_flow/admin_flow Documentation Pass — 2026-09-15

## Scope

The user asked to "fix all pending 40 module[s]." Investigation found this
matched exactly: 40 `module_registry` rows tagged `verified_by IN
('claude-session-339c0b70', 'claude-session-2026-09-14-live-verified')`
(both from this session's own earlier work) with `user_flow` and/or
`admin_flow` still `NULL` — the two required fields under this workspace's
mandatory Module Understanding Standard.

This is a distinct, smaller task from the drift-sweep's full finding of
196 (now 157 after this pass) registry rows missing these fields
registry-wide — most of the remainder are much older, pre-existing rows
that would need fresh investigation from scratch, a separate and much
larger undertaking flagged but not attempted here.

## Method

Dispatched 4 parallel read-only research agents (10 modules each),
required to ground every claim in an actual file read (cited path), and
explicitly instructed: if a module genuinely has no customer-facing flow,
say so — never invent one; same for admin_flow if no dedicated UI exists
(cite the real API route instead of fabricating a UI walkthrough).

All 40 rows updated via direct SQL, `verified_by='claude-session-2026-09-15-flow-docs'`.
Verified via direct count query: 40/40 rows now have non-NULL user_flow
AND admin_flow.

## Real discrepancies found during this pass (not previously disclosed)

Investigating actual code to write these flows surfaced 6 real
inaccuracies in prior documentation/naming — each corrected in the
row's own admin_flow/user_flow text rather than silently overwritten:

1. **lead-scoring**: previously described as "deterministic scoring of
   real lead attributes." Actually `LeadNurturingJob.ts` calls a live
   Ollama LLM (fast tier) to score leads — not a formula. No automatic
   re-score on status change or time decay exists.
2. **sales_copilot**: module name references a "Discovery Questionnaire"
   — grep across the whole repo found zero matching code. Only the
   deterministic talking-points composition is real; the name overclaims.
3. **coupon-management**: the customer-facing "Coupon Code" field on
   `/customer/register` is decorative — captured in local React state but
   never transmitted to `/api/customer/complete-registration`, and
   `CouponRedemption.ts` is never called from any route. No real
   redemption flow exists despite the UI field.
4. **prospect_scoring_router**: confirmed via grep that
   `LeadNurturingJob.ts` has zero references to `ResearchDepthRouter` —
   the disclosed "not wired in yet" gap is accurate, now confirmed rather
   than assumed.
5. **landing-page-ab-testing**: confirmed `HeroCarousel.tsx` has zero
   references to `experiment` — only one banner (`homepage-final-cta`)
   is actually experiment-driven, the disclosed gap is accurate.
6. **referral-loyalty**: confirmed `/api/admin/loyalty/transactions`
   exports GET only (no PATCH/void route) and all referral admin routes
   are GET-only except reward approval — no real route exists to adjust a
   loyalty transaction or investigate a disputed referral, now confirmed
   rather than assumed.

## Also confirmed real (no discrepancy, just verified)

- **ai-chatbot**: real, live, mounted in `LayoutWrapper.tsx` on every
  public page, backed by local Ollama via `/api/ai/chat`.
- **video_growth_engine** / **video-management**: both have real,
  substantial customer-facing flows (`/customer/videos`, `/videos/[slug]`)
  in addition to the admin pipeline — not admin-only as some other rows
  in this batch are.
- **referral-loyalty**: `/customer/loyalty` and `/customer/referral`
  customer pages confirmed real and wired to real data.

## Registry-wide state after this pass

40/40 targeted rows fixed. 157 rows remain registry-wide with missing
user_flow/admin_flow (down from 196) — predominantly older, pre-existing
modules from before this session that would need fresh code investigation
to document accurately, not something to backfill with plausible-sounding
but unverified text. Flagged as a separate, larger task.
