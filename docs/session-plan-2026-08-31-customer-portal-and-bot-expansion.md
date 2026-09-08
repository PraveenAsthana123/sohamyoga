# Captured requirements: Customer Self-Service Portal + Per-Module BOT + Admin Completeness

Captured verbatim from a rapid burst of requests, 2026-08-31, while the user was stepping
away. This is a plan/spec document — not yet built — so architecture choices can be
confirmed before a large build starts, consistent with this session's discipline of
never fabricating scope.

## What was asked, consolidated

1. **Customer self-service portal** must include both a Digital Marketing module and a
   Market Research module (echoes the earlier "3-portal" ChatGPT conversation: Admin /
   Customer Self-Service / Marketing Research, already assessed as an architecture
   framing, not a new build).
2. **Market Research Portal** should have a customer-facing side: a list of digital
   marketing services and a list of market-research services/offerings a customer can
   browse.
3. **A real service catalog** on the customer-facing side: dropdown/list of each service,
   selectable, purchasable — plus a blog.
4. **Admin portal** must expose every admin feature for both Market Research and Digital
   Marketing domains — full CRUD (change/add/delete), complaint handling, job control,
   and a BOT interface.
5. **Customer-related operations** — dashboard, report, billing, notifications, email —
   "all the service must present" for the customer.
6. **Every module/operation should have a BOT AI feature** — i.e. the Agent Console
   pattern (built earlier today at `/admin/agent-console`) extended per-module, not just
   as one central console.

## Cross-checked against what's real today (no guessing)

| Piece requested | Real status today |
|---|---|
| Service catalog (browse services) | **Not built.** `product_master`/e-commerce schema exists (sohamyoga-frontend) but has zero storefront UI — confirmed via the deep audit earlier this session (`grep -rn "INSERT INTO sales_order"` = 0 hits anywhere). market-research-portal has `campaign`/`content_factory_project` but no customer-browsable "service" concept at all. |
| Purchase/checkout | **Not built anywhere.** No payment gateway integration exists in either app (confirmed absent in all audits this session). This cannot be built honestly without real payment credentials (Stripe/Razorpay/etc.) — same category of blocker as the telephony/PSTN gap found for Voice AI. |
| Billing | **Not built.** `wallet`/`wallet_transaction` tables exist in the e-commerce schema but nothing writes to them (same "schema exists, zero real flow" pattern as booking/e-commerce before this session's fixes). |
| Blog | **Not built.** No blog/CMS content type exists in either app's schema. |
| Notifications/Email to customer | **Partially real, credential-blocked** — `NotificationDispatchJob.ts` is real client code for a self-hosted Novu instance, but Novu isn't deployed and `NOVU_API_KEY` is unset (found in the platform-modules deep audit). |
| Admin full CRUD for Market Research + Digital Marketing | **Partially real** — most individual admin pages have real CRUD (ads, banners, coupons, pricing, referral, influencer, competitor — see `module_registry`), but several primary actions are dead (Ads "New Campaign"/"AI Generate" buttons have no handler; Campaign launch is a status-flip only). |
< Complaint handling | **Partial** — `ComplaintAlertJob.ts` exists (real cron job); no dedicated customer-facing complaint submission UI confirmed yet. |
| BOT per operation | **1 built** (`/admin/agent-console`, general-purpose, backed by the real agentic-ollama-platform gateway). Extending it *per module* (e.g. a Voice-AI-specific bot, a Booking-specific bot) is real, additional UI work — the underlying gateway already supports arbitrary goals, so this is wiring, not new AI infrastructure. |

## Why this isn't being built blind, right now

Two of the six requested pieces (**purchase/checkout**, **billing**) hit the same wall
this whole session has respected: they need real external credentials (a payment
gateway) that don't exist. Building a fake "Buy Now" button that doesn't actually charge
anyone would violate the core discipline this session has held to everywhere else
(Voice AI's PSTN gap, Ads' missing platform APIs, Email's missing Novu key) — so those
two pieces are correctly blocked pending a real decision on which payment provider to
use and its credentials, not a coding gap.

The other four (service catalog browsing, blog, richer admin CRUD, per-module BOT) are
genuinely buildable now with existing infrastructure and no missing credentials.

## Proposed build order (for confirmation, not yet started)

1. **Service catalog (browse only, no checkout)** — a real, admin-populated list of
   Market Research + Digital Marketing services a visitor can browse and inquire about
   via the existing real lead-capture flow (`/api/leads/capture`) — this reuses CRM/Leads
   (already `real`) instead of inventing a parallel inquiry mechanism.
2. **Blog** — a minimal real schema (post/category, draft→published lifecycle) plus a
   public listing/detail page, following the same pattern as Hooks/Poll (small, real,
   no external dependency).
3. **Admin CRUD completeness pass** — fix the dead "New Campaign"/"AI Generate Ad"
   buttons and the Campaign launch status-flip found in the deep audit, since those are
   confirmed-broken primary actions, not missing features.
4. **Per-module BOT wiring** — add a scoped "Ask the agent about this module" entry
   point on the Voice AI, Booking, and Module Registry pages, each pre-seeding the
   Agent Console's goal with module context, rather than duplicating the gateway.
5. **Purchase/billing** — deferred until a real payment provider and credentials are
   chosen (explicit decision needed, not a coding task).

This order was chosen to build everything that's honestly buildable first, and to make
the credential-blocked pieces explicit and separable rather than blocking the whole
epic on a decision that isn't code's to make.

## Update — items 1-4 progress, plus a second wave of requests captured 2026-08-31 (later same session)

**Item 1 (service catalog) is now built and live-verified**, not just planned:
`service_catalog_item` table (market-research-portal), `/api/service-catalog` (public
GET, admin POST/PATCH), public `/services` page with category dropdown + inquiry modal,
inquiry reuses the real `/api/leads/capture` path (extended with an optional
`serviceItemId` FK). Verified live: created 2 real published services, confirmed public
GET shows only published items, submitted a real inquiry and confirmed the resulting
`lead` row correctly links to the specific service, confirmed the actual page renders
and the modal opens via headless browser. Also closed a previously-flagged adversarial-
review gap while touching this endpoint: `/api/leads/capture` had no rate limiting or
email-format validation — both added and verified live (6th rapid request in 60s
correctly 429s; a malformed email correctly 400s).

A second wave of requests arrived while item 1 was being finished, captured here rather
than acted on blind:

- **"Production grade, top 1%, handle 1000 concurrent users"** — real load testing
  (e.g. k6/Artillery against the actual API routes) has not been run this session. The
  one concrete related fix made was closing the leads/capture rate-limit gap. A genuine
  "handle 1000 users" claim needs an actual load test run and reported numbers, not an
  assumption — flagged as real, separate work, not yet done.
- **Email campaign design + running, calendar integration (Cal.com)** — Email
  Management is already cataloged as `partial` (real Novu client, undeployed). Campaign
  Management is cataloged as `partial` (launch is a status-flip, no real send). Cal.com
  integration for booking is new scope, not yet investigated — Cal.com has a real public
  API; this would plug into the now-real Booking module rather than replacing it.
  Neither started.
- **Voice AI / video creation / editing tracking "must work end to end with demo and
  test data"** — Voice AI is already cataloged `partial` (real except PSTN calling).
  Video creation/editing already has a real local pipeline (espeak-ng+FFmpeg,
  `VideoRenderer.ts`) per earlier session work — not re-verified again this pass.
  Nothing new built here this round; restating existing status, not a regression.

None of this second wave was built yet — captured here so it isn't lost, to be picked
up as explicit next work rather than attempted simultaneously with everything else
mid-flight.
