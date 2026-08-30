# 41-Phase Digital Marketing Mega-Spec — Gap Analysis

**Source:** ChatGPT conversation "Digital Marketing Flow" (`https://chatgpt.com/share/6a8f8583-45a4-83e8-89e2-07436ca6a4c7`),
85 messages, generated almost entirely via repeated "next" — the same runaway-scope pattern already
identified and rejected once this session (the 60-phase voice-agent spec). This is the larger sequel:
41 phases plus an intro, spanning marketing, CRM, sales, video production, and enterprise operations.

**Method:** 6 parallel audit agents (relaunched twice after two got stuck deferring to self-spawned
children instead of delivering findings — a real, recurring agent-orchestration failure worth noting),
each covering a phase range, checking every claim against real code across all 7 projects built this
session (sohamyoga-frontend, market-research-portal, voice-agent-platform, ai-orchestrator-platform,
agentic-ollama-platform, password-manager, plus the reconfigured open-webui). Cross-referenced against
the three prior gap-analysis docs already in this directory. Real/Partial/Not-found classification
at capability-cluster granularity (774+ raw numbered items across 41 phases don't map 1:1 to
independently-checkable claims — most are diagram restatements of the same underlying capability).

## Headline numbers

| Phase range | Real+Partial | Note |
|---|---|---|
| 1–2 (Market Intelligence, Branding) | 26.1% | Reputation mgmt is the one fully-solid item |
| 3–4 (Content/Creative, Paid Media) | ~40% combined | Publishing/ads/attribution genuinely strong |
| 5–6 (Lead/CRM/Sales, CS/Retention/Loyalty) | Phase 5 weak, Phase 6 stronger | Referral/loyalty (10/15) carries Phase 6 |
| 7–14 (Automation→Governance) | Phases 13–14 strongest of the whole spec | MCP gateway, ingestion pipeline, vault, AI governance all real |
| 15–21 (Video production) | **6.2%** | Weakest slice in the entire spec — tied with the worst prior audit |
| 22–28 (Research→Local Marketing) | Wildly uneven, 0%–30% by phase | Real where it overlaps genuine business need (survey, competitor pricing, reviews) |
| 29–35 (Influencer→Security) | **~18%** | Second-weakest — MDM/CDP/community/MMM enterprise layer |
| 36–41 (AIOps→Strategy) | 31.9% | Real AIOps primitives exist, just in a different app, unwired |

**Overall: the spec substantially re-describes the earlier 25-module list at 3-4x the length**, with
one genuinely new, weak area (video production) and one genuinely new, strong area (Phases 13-14's
MCP/ingestion/governance infrastructure, which happened to be built this session for other reasons).

## 🔴 Urgent, non-aspirational finding: 5 fake-live admin dashboards

Independent of the spec's aspirational content, the audit surfaced **five** admin pages presenting
fabricated data as live — up from the three found in the original 25-module audit:

1. `/admin/integrations` (previously fixed)
2. `/admin/notifications` (previously fixed)
3. `/admin/banners` (previously fixed)
4. **`/admin/executive`** — 284 lines, zero `fetch()` calls, hardcoded `'Total Revenue (Aug)': '$84,320'`,
   `'Active Members': '2,847'` style KPIs across 7 tabs. Confirmed independently by 3 separate audit passes.
5. **`/admin/pricing`** — 566 lines, zero `fetch()` calls, fabricated customer names ("Alice Chen"),
   fake MRR. The worst instance: the real backend behind it (`src/domain/pricing/db-schema.sql` —
   plans, price history, bundles, subscriptions) is genuinely the most complete schema found in this
   whole audit, with a codebase comment admitting outright: *"had a complete, real schema since Wave 8
   but ZERO rows... `/admin/pricing` has been displaying these exact 8 plans as a hardcoded mock array
   the whole time."* **No `/api/pricing`, `/api/subscriptions`, or `/api/bundle` route exists at all.**

Fixing #5 has a real second-order benefit: `market-research-portal`'s `PricingCrossPortalJob.ts`
already queries `pricing_plan_master`/`pricing_plan_price` read-only for competitor-benchmark studies —
it's silently getting nothing back because the table is empty. Seeding it makes that job real too.

## 🟡 Real code that exists but was never wired (a distinct failure mode — not dishonest, just incomplete)

- **`BrandKit.ts` + `CampaignBrief.ts`** (`src/domain/marketing/`) — real, well-validated classes
  (hex-color validation, tone-word limits, banned-phrase checks, multi-brand support via `isDefault`).
  No DB table, no API route, no UI. Imported only by their own unit tests.
- **`marketing_content_learning`, `marketing_search_visibility_snapshot`, `marketing_budget_guardrail`**
  — real, well-designed tables, confirmed by repo-wide grep to have zero readers/writers anywhere.
- **Two unreconciled subscription systems**: `src/domain/membership/Subscription.ts` (Stripe-shaped,
  AI-coaching-app plans: Free/Monthly $49/Annual $399) vs `src/domain/pricing/Subscription.ts`
  (ERPNext-shaped, yoga-studio membership: silver/gold/platinum/family/corporate). The public checkout
  page (`/payments/checkout`) hardcodes the *membership* system's prices, confirming these are two
  competing, never-merged product visions, not a refactor-in-progress.
- **No gift-card domain object** — `GiftVoucher.ts` (in the coupon domain) is the only real
  implementation; elsewhere "gift card" is just a `product_type` enum value with no balance/fraud logic.
- **Class booking bypasses the ecommerce cart entirely** — `Reservation.ts` runs its own independent
  payment/cancellation flow, contradicting the ecommerce module's own integration spec.

## 🐛 Confirmed live bug (unrelated to any spec item, found incidentally)

`AiCoachJob` has been writing to a table (`ai_recommendation`) that has never existed — failing
`"relation ai_recommendation does not exist"` on every single run since it was built, per the
codebase's own comment confirming this was live-observed 2026-08-11.

## What's genuinely strong (don't touch, don't rebuild)

Publishing/approval pipeline, MCP gateway (risk-tiered human approval), AI-ingestion connector
pipeline (Drive/Slack/local-folder/ChatGPT-share with checkpointing), OpenBao vault, referral+loyalty
(10/15, the strongest module in the whole spec), coupon engine (real reservation→commit concurrency
pattern), ads hierarchy + attribution query, Customer 360, churn/NPS/VoC Ollama jobs, ecommerce
(fully wired, real fetch calls throughout — the honest counterpart to `/admin/pricing`'s dishonesty).

## Genuinely missing but architecturally in-scope (the real "build one by one" list)

Ranked by leverage — each reuses existing real infrastructure rather than inventing new stack:

1. **Fix the 5 fake-live dashboards** — `/admin/pricing` first (wire the existing rich schema to real
   API routes; this alone also fixes the market-research-portal cross-portal job), then `/admin/executive`.
2. **Wire `BrandKit.ts`/`CampaignBrief.ts`** — add the missing table/route/UI for code that's already
   validated and tested; smallest-effort real win in the whole audit.
3. **Fix the `AiCoachJob` phantom-table bug** — a real, currently-silently-failing job.
4. **Scoped video production** (per the msg-30 trace-back): a `VideoScriptDraftJob` following the
   existing `CampaignCopyDraftJob.ts` pattern, port `market-research-portal`'s real
   `VideoRenderer.ts` (TTS + FFmpeg caption burn-in) into sohamyoga-frontend and wire it to
   `VideoAsset`, plus a fixed watermark overlay in the same render step. Explicitly NOT the 774-item
   Studio-UI/multi-agent/live-streaming/print-factory fantasy around it.
5. **Reconcile the two subscription systems** — pick one (`pricing/Subscription.ts` is the more
   complete model) and migrate `/payments/checkout` + `membership/` off the other, or clearly
   partition which product each governs if both are intentional.
6. **Real gift-card domain object** — extract from `GiftVoucher.ts`'s pattern rather than leaving it
   as a bare enum value with unvalidated pass-through amounts.

## Explicitly not building (correctly out of scope, confirmed by this audit)

MDM/CDP/lakehouse/vector-DB data architecture, multi-agent orchestration framework (every "AI Agent"
in every phase is confirmed to be single-shot Ollama calls, never a persistent agent-mesh), B2B
CPQ/e-signature/contract-lifecycle suite (no B2B sales motion exists in this B2C product), formal
MMM/incrementality/causal-inference statistics engine, dedicated FinOps/SIEM/SOC platforms, community/
forum/membership platform (Phase 30, ~0% and no business case), affiliate/reseller/partner-channel
program (doesn't exist as code, and this is a single-location direct-to-consumer studio), PR/media
relations/crisis-communications apparatus (Phase 24, 0/19 — no PR function exists in this business),
multi-location/franchise local-marketing engine (Phase 28's premise — single-location studio),
video Studio-UI/live-streaming/print-asset-factory (774-item fantasy around one real, grounded ask).

This list matches the deliberate Next.js/Postgres monolith architecture documented in every prior
audit this session — none of it is a gap so much as infrastructure this project correctly never
needed.
