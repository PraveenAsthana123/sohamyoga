# Portals & Feature Inventory — sohamyoga-frontend + market-research-portal

**Last updated:** 2026-09-08 00:55 MDT · **Source of truth:** live `module_registry` Postgres table, queried directly (`psql -h 127.0.0.1 -p 5437 -U sohamyoga -d sohamyoga`), not seed files or memory. Every row below is either `REAL` (working end-to-end, verified live), `PARTIAL` (real code exists, a specific documented gap remains), or `NOT BUILT` (confirmed absent by grep, not assumed).

This document buckets every cataloged module into the five portals this codebase actually implements, since [FEATURES.md](FEATURES.md) lists them as one flat matrix. The bucketing rule is stated once here so it's auditable: `customer-*` module keys → Customer Self-Service; general cross-cutting admin/ops keys → Admin Portal; booking/ecommerce/loyalty/community-facing keys → Yoga Customer-Facing Portal; `market-research-portal` app rows + research/survey/methodology keys → Market Research Portal; everything else (the majority, by design — see the project's own core-objective decision that this is fundamentally a marketing suite with yoga as one vertical) → Digital Marketing Portal.

## Snapshot

| Portal | Cataloged | Real | Partial | Not built |
|---|---|---|---|---|
| Customer Self-Service | 16 | 15 | 1 | 0 |
| Admin Portal (general/ops) | 8 | 7 | 1 | 0 |
| Yoga Customer-Facing Portal | 38 | 36 | 2 | 0 |
| Digital Marketing Portal | 105 | 85 | 19 | 1 |
| Market Research Portal | 29 | 27 | 2 | 0 |
| **Total** | **196** | **170** | **25** | **1** |

(196 vs the 188+8=196 total in [FEATURES.md](FEATURES.md) — same registry, same moment in time, just re-grouped.)

---

## 1. Customer Self-Service — 16 cataloged (15 real, 1 partial)
The `/customer` self-service account area: everything a logged-in student manages about their own account.

- [REAL] **Customer / Business Onboarding Wizard** (`customer-business-onboarding`)
- [REAL] **Customer 360 / Unified Profile (CDP)** (`customer-360-cdp`)
- [REAL] **Customer Order History** (`customer-order-history`)
- [REAL] **Customer Password Login** (`customer-password-login-fix`)
- [REAL] **Emergency Contacts** (`customer-emergency-contacts`)
- [REAL] **Invoices & Billing** (`customer-billing-invoices`)
- [REAL] **Manage Subscription** (`customer-subscription-self-service`)
- [REAL] **My Journey — Streak/Points/Badges/Challenges** (`customer-journey-gamification`)
- [REAL] **Notification Inbox** (`customer-notification-inbox`)
- [REAL] **Personalized Practice Plan** (`customer-personalized-plan`)
- [REAL] **Pose Mastery Assessments** (`customer-pose-mastery`)
- [REAL] **Practice Journal & Wellness Score** (`customer-wellness-journal`)
- [REAL] **SEO Management** (`customer-self-service-seo`)
- [REAL] **Structured Goals** (`customer-goals`)
- [REAL] **Support Tickets** (`customer-support-tickets`)
- [PARTIAL] **Customer/Lead Segmentation** (`customer-segmentation`) — 5 fields (membership_plan, total_spend_cad, pose_score_avg, location, challenge_completed) have no confirmed real data mapping; the evaluator throws rather than fabricating a count.

## 2. Admin Portal (general/ops) — 8 cataloged (7 real, 1 partial)
Cross-cutting admin/platform capabilities not owned by a specific domain below.

- [REAL] **AI Control Tower — SAST/SCA/IaC/DAST** (`security-control-tower`)
- [REAL] **Admin Portal (Loyalty)** (`loyalty-admin-portal`)
- [REAL] **Admin Portal — Onboarding Management** (`onboarding-admin-portal`)
- [REAL] **Experiments (A/B Testing)** (`experiments`)
- [REAL] **External Platform Webhooks (GitHub/GitLab/Patreon)** (`external-webhooks`)
- [REAL] **Integration Onboarding** (`integration-onboarding`)
- [PARTIAL] **MCP Gateway** (`mcp-gateway`) — 2 of 29 registered servers' tools have real working implementations (as of 2026-09-07, +1 more: `build_utm_link` now executes for real too).
- [REAL] **Platform Setup & Integration Center** (`platform-setup-center`)

## 3. Yoga Customer-Facing Portal — 38 cataloged (36 real, 2 partial)
The public/transactional layer a yoga student actually uses: booking, shop, community, loyalty.

- [REAL] AI Assistant chatbot, AI Onboarding Assistant, Blog/Content CMS, Backorder Management, Booking→Invoice, Booking→Order, Cart Management, Different Order Types, Digital Product Fulfillment, Discount Approval, Dunning Management, Earn Rule Builder, Healthcare & Safety Dashboard, Industry-Based Onboarding, Inventory Reservation, Landing Page A/B Testing, Main Loyalty Dashboard, Multi-Location Management, Order Data Model/Exchange/Fulfillment/Refund/Return/State Machine, Physical Product Fulfillment, Physical/Digital/Service Fulfillment, Poll Management, QR Check-In Validation, QR Kiosk Login, Quote to Order, Referral & Loyalty Management, Reward Catalog (+ Redemption), Service Fulfillment, Split Orders, Wellness Tracking.
- [PARTIAL] **Class Booking** (`booking`) — no QR check-in, teacher rating schema, or lateness-threshold tracking.
- [PARTIAL] **E-commerce** (`ecommerce`) — no real storefront/checkout; `sales_order` never populated by real customer action (grep-confirmed).

## 4. Digital Marketing Portal — 105 cataloged (85 real, 19 partial, 1 not built)
The largest domain by design — this codebase's real product is a generic enterprise digital-marketing suite; yoga is one vertical running on it. Full alphabetical list with every non-real item's gap:

**Ads/PPC:** Ads Platform Selection (real), Bidding Screen (real), Placement Screen (real), Dynamic Ad Builder (real), Budget Guardrails (real), AI Campaign Optimization Loop (real), Retargeting Screen (real), Retargeting/Remarketing Pixels (real, built 2026-09-07), [PARTIAL] Paid Ads Management — campaign creation real, zero ad-platform API clients so launching to a real network isn't possible; [NOT BUILT] Google Ads (platform-specific) — zero Google Ads API client code anywhere.

**Campaigns/Content:** Content Versioning (real), Content Asset Library/DAM (real), Marketing/Content Calendar (real, grid+drag-drop+conflict detection built 2026-09-07), Cross-Channel Marketing ROI Rollup (real, built 2026-09-07), [PARTIAL] Campaign Management — Launch/Pause only flips a status column, no real dispatch triggered; [PARTIAL] Drip Campaigns — real sequencing, no SMTP/Novu deployed so delivery is honestly `queued`, never fabricated `sent`.

**Social:** Admin Viral Control Tower, Social Health Score, Unified Communication Inbox, Cross-Channel/Conversation-360 (all real). [PARTIAL] Social Media Management, Facebook/LinkedIn/YouTube/Telegram Management — real publish pipeline (Postiz + FirstWaveDispatchJob), gated on `POSTIZ_PUBLIC_API_KEY`/OAuth/bot-token credentials not present in this environment; [PARTIAL] Direct-API Social Dispatch (Telegram/Discord/Mastodon/Bluesky) — wiring fixed 2026-09-01, still needs real per-account credentials; [PARTIAL] Post Management — social scheduler real, no unified generic "post" entity.

**Brand:** Brand Architecture/Asset Library/Asset Detail/Kit Version Management/Positioning Map/Strategy Screen/Template Management (all real). [PARTIAL] Branding (Brand Kits) — real, one live bug fixed this session (bad column reference); [PARTIAL] Audio Editing — single-track TTS loudness/fade only, no multi-track mixing.

**Video:** see dedicated section 6 below.

**SEO:** SEO Architecture, Content Brief, Issue Prioritization, On-Page SEO Checker, Internal Linking Engine, Broken Link & Redirect Management, Topic Cluster/Content Hub, Local Search Conversion, Local Landing Page Factory, Website-to-Business-Profile Import, Reviews→Local SEO, Schema Generator (all real). [PARTIAL] SEO Management — on-page real, `marketing_search_visibility_snapshot` table exists but nothing writes to it yet; [PARTIAL] GEO/AEO Management — AI-answer-engine citation tracking blocked on external API credentials.

**Leads/CRM:** Lead Detail Screen, Detection Flow, Follow-Up Queue, Routing Engine/Screen, SLA Control, Identity Resolution, Behavioral Segmentation, Attribution Modeling (last-touch), Health/Feedback/Communication Score family (all real). [PARTIAL] B2B Affiliate Program (Tracking Links) — schema/logic real, no unique external tracking-link model yet; [PARTIAL] Form Management — capture flow real, no generic multi-purpose form builder; [PARTIAL] Heatmaps/Session Recording (CRO) — flag/design intent only, no real PostHog/OpenReplay SDK wired.

**Influencer:** Discovery/Comparison/Profile/Publishing/Content-Submission Screens, Authenticity/Fraud Screen, Influencer/Creator Management (all real).

**Comms/Notifications:** Web/Mobile Push Notifications (real, full E2E build 2026-09-07 — dispatch job branch, admin broadcast UI, resubscribe handling), UTM/Campaign Parameter Tracking (real, MCP handler + bot/UA fraud filtering added 2026-09-07), Marketing Unsubscribe/Suppression/Consent Audit, Trigger Configuration/Management, Quiet-Hour Control, Frequency Management, Realtime Marketing Automation, Executive Communication Dashboard (all real). [PARTIAL] Email Management — Novu not deployed, no working delivery in this environment.

**Coupons/Pricing:** Offer & Promotion Management (Coupons), Pricing Management, Promo Code Management, Product Launch Management, Product Lifecycle (all real).

**Reputation:** Review & Reputation Management, AI Reply Draft Screen, Voice of Customer weekly digest (all real).

## 5. Market Research Portal — 29 cataloged (27 real, 2 partial)
Standalone `market-research-portal` app + related sohamyoga-frontend research modules. See dedicated section 7 below for the full list.

---

## 6. Video Editing — feature detail (called out explicitly)
| Module | Status | Detail |
|---|---|---|
| **Long-Form + Short-Video Management** (`video-management`) | REAL | `/admin/videos` — real espeak-ng + FFmpeg pipeline: generate-script → approve → render → publish/archive. Produces real, checksummed MP4 output. |
| **Video Editing (multi-clip/timeline)** (`video-editing`) | PARTIAL | Single-script-to-video only — no multi-clip concatenation, trim, or transitions yet. A self-introduced bug (an infinite `lavfi` colour source not terminating against `-shortest`) was found and fixed live 2026-09-01. **Next planned build** (this session's active backlog). |
| Sample output | — | A real 15-second HyperFrames-built sample exists and plays at `/video-sample` — a genuinely rendered artifact, not a mock. |

## 7. Market Research Portal — feature detail (called out explicitly)
| Module | App | Status | Detail |
|---|---|---|---|
| CRM — Leads & Email Templates | market-research-portal | REAL | |
| Competitor & Market Intelligence | sohamyoga-frontend | REAL | |
| Content Management (Content Factory) | market-research-portal | PARTIAL | Video-only content types — no blog/whitepaper/case-study. |
| Core cards / Screen 01 Executive Research Command Center / Screen 04 Methodology Designer | sohamyoga-frontend | REAL | |
| Executive Research Health Score | sohamyoga-frontend | REAL | |
| Hook Management | market-research-portal | REAL | |
| Importance × Satisfaction Matrix | sohamyoga-frontend | REAL | |
| Keyword Intelligence / Keyword Opportunity Score | sohamyoga-frontend | REAL | |
| Lead Scoring | market-research-portal | REAL | |
| Market Trend Intelligence | sohamyoga-frontend | REAL | |
| Meeting Reports (Pre/Post-Meeting PDF Export) | market-research-portal | REAL | |
| Methodology Validation | sohamyoga-frontend | REAL | |
| Operations & Failure Tracking | market-research-portal | REAL | |
| Price Index | sohamyoga-frontend | REAL | |
| Respondent Quality Score | sohamyoga-frontend | REAL | |
| Sample Quality Controls / Sampling Management | sohamyoga-frontend | REAL | |
| Schema Generator | sohamyoga-frontend | REAL | |
| Service Catalog (browse + inquire) | market-research-portal | REAL | Inquiry-only — no payment gateway exists anywhere in this codebase, by design. |
| Survey Builder / Lifecycle / Management / Question Builder / Response Submission | sohamyoga-frontend | REAL | Survey Management dashboard fully wired to real data 2026-09-07 (was MOCK_* constants). |
| Trend Discovery Screen | sohamyoga-frontend | REAL | |
| Voice AI (inbound/outbound calling) | market-research-portal | PARTIAL | Schema/API/UI all real; no real PSTN telephony provider connected — calls stay honestly blocked. |

---

## What this document does NOT cover
- **Agent prompts / MCP tool catalog**: see [INTEGRATION.md](INTEGRATION.md) for external integrations; a full MCP tool-by-tool prompt/schema catalog is a separate, larger doc not produced here to avoid duplicating `src/domain/mcp/*-registry.ts`, which is the actual source of truth for tool definitions.
- **Test/eval inventory**: Jest + Playwright are the real test stack (see [HLD.md §3](HLD.md)); a consolidated test-coverage-by-module report has not been produced — would require a real coverage run, not an estimate.
- **Failure/incident log**: `.overnight-logs/*.log` and `.overnight-tasks.md` are the real overnight-automation log; no consolidated cross-session incident log exists yet.
- **UI navigation map**: see [HLD.md §4](HLD.md) for the module/domain map (57 domains, 221 pages, 383 API routes); a rendered nav-tree diagram has not been produced.

*Version 1.0 · Last edited by: Claude (sohamyoga session, autonomous backlog burn-down) · Archive copy: this file, versioned in git.*
