# Repository Reality Matrix — Phase 1 Audit

**Status:** IN PROGRESS. This document is being built incrementally and committed in checkpoints,
per this workspace's [GitHub Push & Engineering Audit Standard](../../.git) (evidence-based, no
status inflation). Sections below are complete for the portals listed; the remaining portals are
under active investigation and will be appended in a follow-up commit, not fabricated here to hit a
deadline.

**Methodology:** every row's `built_status`/UI columns come directly from the live `module_registry`
Postgres table (`docker exec sohamyoga-postgres psql -U sohamyoga -d sohamyoga`), queried at
**2026-09-08**, not from seed files, not from memory, not inferred from file existence. This table
is itself maintained by prior sessions doing real code reads and live verification — see each row's
"Evidence" column for the specific investigation that backs it. Where a row shows no evidence file
or last-verified date, that module was cataloged but not yet individually deep-verified in a
separate write-up — its `built_status` still reflects the registry's `has_user_ui`/`has_admin_ui`
booleans, which per [ADR-0003](../architecture/sohamyoga-frontend/ADR/0003-explicit-ui-flags-over-inference.md)
are explicit manually-set flags, not text-inferred.

**Coverage in this checkpoint:**
- ✅ sohamyoga-frontend (188 modules) — full registry-sourced table below
- ✅ market-research-portal, registry-tracked modules only (8 modules) — full registry-sourced table below
- ⏳ voice-agent-platform — investigation in progress, not yet in this file
- ⏳ market-research-portal — deeper backend/API pass beyond the 8 registry rows, in progress
- ⏳ ai-orchestrator-platform — investigation in progress, not yet in this file
- ✅ SohamYoga (.NET backend) — full table below (this checkpoint)
- ✅ password-manager — full column set below (this checkpoint)

**Column note:** the user-specified Reality Matrix schema (Portal, Domain, Module, Business purpose,
User persona, Entry point, UI exists?, API exists?, DB schema exists?, DB writes verified?, DB reads
verified?, External integration exists?, External integration tested?, AI/LLM used?, Agentic
workflow used?, Tests exist?, E2E demo verified?, Security controls, Observability, Deployment
status, Source origin, Original/AI-generated/OSS, Known dependency, Known issue, Missing item,
Current maturity, Evidence file/path, Last verified date) is 27 columns. The `module_registry` table
tracks a subset of these natively (module/name/status/UI-exists/DB-schema-tables/integrations/known-
issue/evidence/last-verified). The remaining columns (persona, entry point, DB writes/reads
verified, AI/LLM used, agentic workflow, tests exist, E2E demo verified, security controls,
observability, deployment status, source origin) are **not tracked per-module** in the registry and
have only been deep-verified for a subset of modules (mostly the `partial`/`not_built` ones, where a
specific gap needed root-causing). Producing all 27 columns for all 196 rows by hand would mean
fabricating ~15 columns × 196 rows of unverified content — this document does not do that. Instead:
the table below shows the registry-backed columns for every row, and a smaller set of already
deep-verified modules (see [FEATURES.md](../architecture/sohamyoga-frontend/FEATURES.md),
[PORTALS.md](../architecture/sohamyoga-frontend/PORTALS.md)) carry the fuller picture. Closing this
gap for all 196 rows is tracked as a real backlog item, not silently skipped — see
[Known limitations](#known-limitations-of-this-checkpoint) at the end.

---

## sohamyoga-frontend + market-research-portal (registry-tracked modules)

Live count at query time: **sohamyoga-frontend** 174 real / 13 partial / 1 not_built (188 total) ·
**market-research-portal** 6 real / 2 partial (8 total). These numbers move as work lands — the
registry is under active, real, continuous revision (visible in the "Last Verified" column, several
rows updated same-day as this audit).

| Portal | Module Key | Name | Status | User UI | Admin UI | Integrations | Known Gap (missing_items) | Evidence (source_doc) | Last Verified |
|---|---|---|---|---|---|---|---|---|---|
| market-research-portal | content-factory | Content Management (Content Factory) | PARTIAL | no | yes | - | content_factory_project/variant/metric/stage real, but types are video-only — no blog/whitepaper/case-study content type | docs/chatgpt-extracts/twenty-five-item-advanced-management-list.md | 2026-08-31 |
| market-research-portal | voice-ai | Voice AI (inbound/outbound calling) | PARTIAL | no | yes | - | No real PSTN telephony provider connected (schema/API/UI all real, calls stay honestly blocked); multi-language script s | docs/modules/voice-ai/README.md | 2026-08-31 |
| market-research-portal | crm-leads | CRM — Leads & Email Templates | REAL | yes | yes | - | No scheduled job; no lead scoring/enrichment (that exists separately and more fully in sohamyoga-frontend's own campaign | this session's CRM build + docs/chatgpt-extracts/voice-agent-outbound-inbound-calling-platform.md (lead-call link) | 2026-08-31 |
| market-research-portal | hooks | Hook Management | REAL | no | yes | - | No scheduled job; no A/B comparison between hooks yet (would use the new Experiments framework pattern, not built for th | docs/chatgpt-extracts/digital-marketing-flow-video-hooks.md | 2026-08-31 |
| market-research-portal | lead-scoring | Lead Scoring | REAL | no | yes | - | No automatic re-scoring on lead status change or time decay yet -- score is set once at creation, rescoring is manual. | chat session 2026-08-31 build | 2026-08-31 |
| market-research-portal | meeting-reports | Meeting Reports (Pre/Post-Meeting PDF Export) | REAL | yes | yes | - | No detail/edit page existed before this (list+create only); fixed one real bug found during live verification (pdf-lib W | Session decision log 2026-09-01 (meeting report PDF export build) |  |
| market-research-portal | operations-alerts | Operations & Failure Tracking | REAL | no | yes | - | Does not yet cover Playwright/e2e results, API-route error rates, browser/UI console errors, or schema-migration failure | this session's Operations & Failure Tracking build | 2026-08-31 |
| market-research-portal | service-catalog | Service Catalog (browse + inquire) | REAL | yes | yes | - | No checkout/payment -- no payment gateway exists anywhere in this codebase, so this is deliberately inquiry-only, not fa | chat session 2026-08-31 build | 2026-08-31 |
| sohamyoga-frontend | google-ads | Google Ads (platform-specific) | NOT_BUILT | no | no | - | Zero Google Ads API client code anywhere (grep-confirmed: googleads/google-ads-api/GoogleAdsApi = 0 hits). Only artifact | deep re-audit 2026-08-31 | 2026-08-31 |
| sohamyoga-frontend | booking | Class Booking | PARTIAL | yes | yes | - | QR check-in system, teacher rating schema, and lateness-threshold tracking do not exist anywhere in this codebase -- tho | chat session 2026-08-31 build — real booking-creation path added (was previously fully mock) | 2026-08-31 |
| sohamyoga-frontend | drip-campaigns | Drip Campaigns | PARTIAL | no | yes | - | Real sequencing logic; actual email delivery is honestly not possible (no SMTP/Novu deployed) -- every step is recorded  | chat session 2026-08-31 build -- closes the gap found in the brutal audit (drip campaigns had zero internal sequencing anywhere) | 2026-08-31 |
| sohamyoga-frontend | ecommerce | E-commerce | PARTIAL | no | no | - | The core gap: no real storefront/checkout flow exists, so sales_order is never populated by real customer action (grep-c | live code/schema audit 2026-08-31 (grep-verified no INSERT INTO sales_order anywhere) | 2026-08-31 |
| sohamyoga-frontend | email-management | Email Management | PARTIAL | no | yes | - | Corrected 2026-09-08: the "Test SMTP button calls a route that does not exist" claim was stale. Discovered live: NEXT_PU | deep re-audit 2026-08-31 | 2026-09-08 |
| sohamyoga-frontend | facebook-management | Facebook Management (organic posting) | PARTIAL | no | yes | - | Same Postiz credential/deployment gap as YouTube. | deep re-audit 2026-08-31 | 2026-08-31 |
| sohamyoga-frontend | first-wave-social-dispatch | Direct-API Social Dispatch (Telegram/Discord/Mastodon/Bluesky) | PARTIAL | no | yes | - | The adapter code (first-wave-adapters.ts) existed correctly since earlier this session but had ZERO production call site | Session decision log 2026-09-01 (business-side admin-panel audit + fix) |  |
| sohamyoga-frontend | geo-aeo-management | GEO/AEO Management (AI-search visibility) | PARTIAL | no | yes | - | AI-answer-engine (ChatGPT/Gemini/Perplexity) citation tracking -- blocked on external API credentials, not attempted. | docs/chatgpt-extracts/twenty-five-item-advanced-management-list.md | 2026-09-02 |
| sohamyoga-frontend | linkedin-management | LinkedIn Management (posting/automation) | PARTIAL | no | yes | - | Only works if/when Postiz itself is deployed and holds a LinkedIn OAuth token — this app has no fallback direct integrat | deep re-audit 2026-08-31 | 2026-08-31 |
| sohamyoga-frontend | mcp-gateway | MCP Gateway (Dashboard/Integrations/Bot Console/Reports) | PARTIAL | no | yes | - | Updated 2026-09-08: now 3 of 29 registered servers' tools have real working implementations (github.search_repositories, | Session decision log 2026-09-01 (Operational Portal Page & Tab Standard build) | 2026-09-08 |
| sohamyoga-frontend | paid-ads | Paid Ads Management | PARTIAL | no | yes | - | Campaign creation now real; launching a campaign to a real ad platform (Meta/Google/TikTok) is still not possible -- zer | chat session 2026-08-31 fix -- New Campaign button wired to a real POST /api/ads/campaigns | 2026-08-31 |
| sohamyoga-frontend | social-media-management | Social Media Management | PARTIAL | no | yes | - | Real publishing now covers Facebook/LinkedIn/YouTube (Postiz) AND, as of 2026-09-01, Telegram/Discord/Mastodon/Bluesky v | docs/advanced-management-feature-list-gap-analysis.md | 2026-08-31 |
| sohamyoga-frontend | telegram-management | Telegram Management | PARTIAL | no | yes | - | Corrected 2026-09-08 -- this note was stale. "Nothing in the app actually calls it" was true when first written but was  | deep re-audit 2026-08-31 | 2026-09-08 |
| sohamyoga-frontend | youtube-management | YouTube Management (organic posting) | PARTIAL | no | yes | - | Real code, gated on POSTIZ_PUBLIC_API_KEY (unset) and a deployed Postiz instance (not present in this repo) — currently  | deep re-audit 2026-08-31 | 2026-08-31 |
| sohamyoga-frontend | admin-viral-control-tower | Admin Viral Control Tower | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | ads-bidding-screen | Bidding Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | ads-placement-screen | Placement Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | ads-platform-selection | Ads Platform Selection | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | affiliate-tracking-links | B2B Affiliate Program (Tracking Links) | REAL | no | no | - | Built 2026-09-08. Closes: "attribution flows through vendor-owned storefront/products, not a unique external tracking li |  | 2026-09-08 |
| sohamyoga-frontend | ai-campaign-optimization-loop | AI Campaign Optimization Loop | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | ai-chatbot | AI Assistant (customer-facing chatbot) | REAL | yes | no | - | None found this pass -- genuinely real and already live. (Correction: was wrongly marked not-built in an earlier topic-l | correction 2026-08-31 -- verified live via real SSE call | 2026-08-31 |
| sohamyoga-frontend | ai-onboarding-assistant | AI Onboarding Assistant | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | attribution-modeling | Attribution Modeling | REAL | no | yes | - | Real last-touch UTM/traffic-source attribution via a genuine SQL join (tracking_event -> tracking_session), correctly fi | correction 2026-08-31 -- was wrongly marked not built in an earlier topic list without checking; confirmed real via code read | 2026-08-31 |
| sohamyoga-frontend | audio-editing | Audio Editing | REAL | no | no | - | Built 2026-09-08, extending the same VideoTimelineRenderer.ts built for video-editing (real code, not a separate stub).  | chat session 2026-08-31 fix -- real loudnorm+fade added to VideoRenderer.ts, live-verified via volumedetect | 2026-09-08 |
| sohamyoga-frontend | backorder-management | Backorder Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | banner-management | Banner & Display Management | REAL | no | yes | - | Full flow/schema/demo detail not yet cataloged (code is real: /admin/banners, "Banner Studio" module). | docs/advanced-management-feature-list-gap-analysis.md | 2026-08-31 |
| sohamyoga-frontend | behavioral-segmentation | Behavioral Segmentation | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | blog-cms | Blog / Content CMS | REAL | yes | yes | - | Real API confirmed (GET /api/blog returns real paginated shape, 0 posts -- honest empty state, not fabricated). Admin pa | correction 2026-08-31 -- another item wrongly assumed missing without checking | 2026-08-31 |
| sohamyoga-frontend | booking-to-invoice | Booking -> Invoice | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | booking-to-order | Booking to Order | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | brand-architecture | Brand Architecture | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | brand-asset-detail | Asset Detail Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | brand-asset-library | Brand Asset Library | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | brand-kit-version-management | Brand Kit Version Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | brand-positioning-map | Brand Positioning Map | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | brand-strategy-screen | Brand Strategy Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | brand-template-management | Brand Template Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | branding | Branding (Brand Kits) | REAL | no | yes | - | Built/corrected 2026-09-08. Two things closed: (1) Multi-brand support was actually ALREADY real -- this was a stale reg | chat session 2026-08-31 fix -- brand_kit primary/secondary colour now applied to VideoRenderer.ts, live-verified via pixel sampling | 2026-09-08 |
| sohamyoga-frontend | broken-link-redirect-management | Broken Link & Redirect Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | budget-guardrails | Budget Guardrails | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | business-readiness-score | Business Readiness Score | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | business-technical-correlation | Business -> Technical Correlation | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | campaign-management | Campaign Management | REAL | no | yes | - | Built 2026-09-08. Closes: "Launch/Pause only flips a status column -- no real email/notification/social dispatch is trig | deep re-audit 2026-08-31 (corrects the earlier real classification) | 2026-09-08 |
| sohamyoga-frontend | cart-management | Cart Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | ces | CES | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | channel-selection-engine | Channel Selection Engine | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | communication-health-score | Communication Health Score | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | competitor-intelligence | Competitor & Market Intelligence | REAL | no | yes | - | Full flow/schema/demo detail not yet cataloged (code real in both apps: competitor/competitor_feature, competitor/compet | docs/chatgpt-extracts/twenty-five-item-advanced-management-list.md | 2026-08-31 |
| sohamyoga-frontend | content-asset-library | Marketing Asset Library (DAM) | REAL | no | yes | - | Real schema and admin UI exist but content_asset=0 rows -- never populated. Separately, generated_marketing_asset has 63 |  | 2026-09-01 |
| sohamyoga-frontend | content-calendar | Marketing / Content Calendar | REAL | no | yes | - | Built 2026-09-07: real List/Grid view toggle at /admin/marketing-calendar. Grid reuses the exact month-grid math already | Marketing Calendar admin UI build session, 2026-09-03 (prior audit: real schema, 0 rows, no admin UI -- registry showed UI: false, Database: true (empty), Admin Portal: false) | 2026-09-08 |
| sohamyoga-frontend | content-versioning | Content Versioning | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | control-mapping-screen | Control Mapping Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | control-tower-objectives | Control Tower Objectives | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | conversation-360 | Conversation 360 | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | coupon-management | Offer & Promotion Management (Coupons) | REAL | no | yes | - | Full flow/schema/demo detail not yet cataloged (code real: coupon/coupon_redemption, 19 types, /admin/coupons). | docs/chatgpt-extracts/twenty-five-item-advanced-management-list.md | 2026-08-31 |
| sohamyoga-frontend | crisis-detection | Negative Virality / Crisis Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | cross-channel-conversation | Cross-Channel Conversation | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | cross-channel-roi-dashboard | Cross-Channel Marketing ROI Rollup | REAL | no | no | - | Built 2026-09-07 (was: "Per-campaign ROI is real; no single view rolls up spend/performance across paid ads + email + so |  | 2026-09-08 |
| sohamyoga-frontend | customer-360-cdp | Customer 360 / Unified Profile (CDP) | REAL | no | yes | - | Genuine identity unification, not siloed per-table data -- this was previously real but had no module_registry row at al |  | 2026-09-01 |
| sohamyoga-frontend | customer-billing-invoices | Customer Self-Service — Invoices & Billing | REAL | yes | yes | - | Still no real ERPNext sync job -- /admin/billing is now the only real way invoices are created (honest, not a stand-in f | Session decision log 2026-08-31/09-01 (customer self-service build) + 2026-09-01 gap audit |  |
| sohamyoga-frontend | customer-business-onboarding | Customer / Business Onboarding Wizard | REAL | yes | no | - | Built 2026-09-01, closing a confirmed zero-implementation gap. Existing 10 customers backfilled with onboarding_complete |  | 2026-09-01 |
| sohamyoga-frontend | customer-emergency-contacts | Customer Self-Service — Emergency Contacts | REAL | yes | yes | - | FIXED 2026-09-01 (was the real safety gap). Staff can view but not add/edit a contact directly on behalf of a student -- | Session decision log 2026-08-31/09-01 (customer self-service build) |  |
| sohamyoga-frontend | customer-goals | Customer Self-Service — Structured Goals | REAL | yes | yes | - | Staff can view but not edit/delete a student's goals directly (customer remains the sole author, by design) -- not block | Session decision log 2026-08-31/09-01 (customer self-service build) |  |
| sohamyoga-frontend | customer-journey-gamification | Customer Self-Service — My Journey (Streak/Points/Badges/Challenges) | REAL | yes | yes | - | CRITICAL bug chain found+fixed 2026-09-01 via a real end-to-end demo walkthrough: (1) attendance_record.enrollment_id wa | Session decision log 2026-08-31/09-01 (customer self-service build) |  |
| sohamyoga-frontend | customer-notification-inbox | Customer Self-Service — Notification Inbox | REAL | yes | yes | - | Fixed 2026-09-01: NotificationDispatchJob previously routed in_app through the external Novu API, 404ing 100% of the tim | Session decision log 2026-09-01 (notification_queue audit) |  |
| sohamyoga-frontend | customer-order-history | Customer Order History | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | customer-password-login-fix | Customer Password Login (real bug fix) | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | customer-personalized-plan | Customer Self-Service — Personalized Practice Plan | REAL | yes | yes | - | None blocking -- FIXED 2026-09-01. Was CRITICAL not_built (zero authoring surface anywhere); verified live end-to-end: a | Session decision log 2026-09-01 (admin-panel gap audit) |  |
| sohamyoga-frontend | customer-pose-mastery | Customer Self-Service — Pose Mastery Assessments | REAL | yes | yes | - | None blocking -- FIXED 2026-09-01. Was CRITICAL not_built (zero authoring surface anywhere); verified live end-to-end: a | Session decision log 2026-09-01 (admin-panel gap audit) |  |
| sohamyoga-frontend | customer-segmentation | Customer/Lead Segmentation | REAL | no | yes | - | Built 2026-09-08. 4 of the 5 documented unsupported fields now have a real, confirmed data source found live in this cod | chat session 2026-08-31 build -- closes the gap explicitly flagged as deferred in db-schema-audience-segment.sql | 2026-09-08 |
| sohamyoga-frontend | customer-self-service-seo | Customer Self-Service — SEO Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | customer-subscription-self-service | Customer Self-Service — Manage Subscription | REAL | yes | yes | - | None blocking -- fully functional end-to-end for both customer and admin. | Session decision log 2026-08-31/09-01 (customer self-service build) |  |
| sohamyoga-frontend | customer-support-tickets | Customer Self-Service — Support Tickets | REAL | yes | yes | - | support_ticket has no description/body column in the schema -- only subject/category are ever captured, by both customer | Session decision log 2026-08-31/09-01 (customer self-service build) |  |
| sohamyoga-frontend | customer-wellness-journal | Customer Self-Service — Practice Journal & Wellness Score | REAL | yes | yes | - | No admin-side aggregate view of wellness scores across all students (minor -- the pipeline is fully functional end-to-en | Session decision log 2026-08-31/09-01 (customer self-service build) |  |
| sohamyoga-frontend | data-import-validation | Data Import + Import Validation | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | different-order-types | Different Order Types | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | digital-product-fulfillment | Digital Product Fulfillment | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | discount-approval | Discount Approval | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | dunning-management | Dunning Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | dynamic-ad-builder | Dynamic Ad Builder | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | executive-communication-dashboard | Executive Communication Dashboard | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | experiments | Experiments (A/B Testing) | REAL | no | yes | - | No scheduled job (none needed — fully request-driven); no multivariate (more than one factor) testing; no automatic winn | chat session 2026-08-31 build | 2026-08-31 |
| sohamyoga-frontend | external-webhooks | External Platform Webhooks (GitHub/GitLab/Patreon) | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | feedback-health-score | Feedback Health Score | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | feedback-lifecycle | Feedback Lifecycle | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | form-management | Form Management | REAL | no | yes | - | Corrected 2026-09-08 -- this was a STALE registry note, not a real gap (same pattern as branding's "multi-brand support" | docs/chatgpt-extracts/twenty-five-item-advanced-management-list.md | 2026-09-08 |
| sohamyoga-frontend | frequency-management | Frequency Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | health-model | Health Model | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | healthcare-safety-dashboard | Healthcare & Safety Dashboard (Admin) | REAL | no | yes | - | None blocking. Deliberately does NOT compute a fabricated composite "risk score" -- only real counts/averages, with mood | Session decision log 2026-09-01 (admin-panel gap audit + build) |  |
| sohamyoga-frontend | heatmap-session-replay | Heatmaps / Session Recording (CRO) | REAL | no | no | - | Built 2026-09-08. Closes: "grep for posthog/openreplay finds only comments/flag descriptions -- no actual SDK import, sc |  | 2026-09-08 |
| sohamyoga-frontend | identity-resolution | Identity Resolution | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | importance-satisfaction-matrix | Importance x Satisfaction Matrix | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | industry-based-onboarding | Industry-Based Onboarding | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | influencer-authenticity | Authenticity / Fraud Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | influencer-comparison | Influencer Comparison Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | influencer-content-submission | Content Submission Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | influencer-discovery | Influencer Discovery Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | influencer-management | Influencer/Creator Management | REAL | no | yes | - | Full flow/schema/demo detail not yet cataloged (code real: influencer_profile/collaboration/value_score); deliberately n | docs/chatgpt-extracts/twenty-five-item-advanced-management-list.md | 2026-08-31 |
| sohamyoga-frontend | influencer-profile-screen | Influencer Profile Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | influencer-publishing | Publishing Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | integration-onboarding | Integration Onboarding | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | internal-linking-engine | Internal Linking Engine | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | inventory-reservation | Inventory Reservation | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | keyword-intelligence | Keyword Intelligence | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | keyword-opportunity-score | Keyword Opportunity Score | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | landing-page-ab-testing | Landing Page A/B Testing | REAL | yes | no | - | Only one banner is wired; the main hero carousel CTA is not yet experiment-driven. | chat session 2026-08-31 build -- closes the gap found in the brutal audit (Experiments framework existed with zero real page consumers) | 2026-08-31 |
| sohamyoga-frontend | lead-detail-screen | Lead Detail Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | lead-detection-flow | Lead Detection Flow | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | lead-followup-queue | Lead Follow-Up Queue | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | lead-routing-engine | Lead Routing Engine | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | lead-routing-screen | Lead Routing Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | lead-sla-control | Lead SLA Control | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | local-landing-page-factory | Local Landing Page Factory | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | local-search-conversion | Local Search Conversion | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | loyalty-admin-portal | Admin Portal | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | loyalty-earn-rule-builder | Earn Rule Builder | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | loyalty-main-dashboard | Main Loyalty Dashboard | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | market-intelligence-to-campaign | Market Intelligence -> Campaign | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | market-research-core-cards | Core cards | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | market-research-screen-01 | Screen 01 — Executive Research Command Center | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | market-trend-intelligence | Market Trend Intelligence | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | marketing-consent-suppression | Marketing Unsubscribe / Suppression / Consent Audit | REAL | no | no | - | Both tables have 0 rows today (no real suppressions/consents recorded yet) but the enforcement code path is real and wir |  | 2026-09-01 |
| sohamyoga-frontend | methodology-designer | Screen 04 — Methodology Designer | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | methodology-validation | Methodology Validation | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | multi-location-management | Multi-Location Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | on-page-seo-checker | On-Page SEO Checker | REAL | no | yes | - | No backlink or keyword-ranking data (would need a paid API) -- this is on-page only, by design. | chat session 2026-08-31 build -- new capability, zero external dependency | 2026-08-31 |
| sohamyoga-frontend | onboarding-admin-portal | Admin Portal — Onboarding Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | order-data-model | Order Data Model | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | order-exchange-management | Order Exchange Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | order-fulfillment-management | Order Fulfillment Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | order-refund-integration | Order Refund Integration | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | order-return-management | Order Return Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | order-state-machine | Order State Machine | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | physical-digital-service-fulfillment | Physical/Digital/Service Fulfillment | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | physical-product-fulfillment | Physical Product Fulfillment | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | platform-setup-center | Platform Setup & Integration Center | REAL | no | yes | - | Only discord/telegram/mastodon/bluesky have a real Test Connection implementation. The other 36 platforms either need en | Session decision log 2026-09-01 (Platform Setup and Integration Center build) |  |
| sohamyoga-frontend | poll-management | Poll Management | REAL | yes | yes | - | No scheduled job (none needed — it is fully request-driven); no poll analytics/export beyond live counts. | chat session correction 2026-08-31 (previously miscategorized as not found) | 2026-08-31 |
| sohamyoga-frontend | post-management | Post Management | REAL | no | yes | - | Built 2026-09-08. Closes: "Social scheduler exists; no unified generic post entity across content types." The real fix r | docs/advanced-management-feature-list-gap-analysis.md | 2026-09-08 |
| sohamyoga-frontend | price-index | Price Index | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | pricing-management | Pricing Management | REAL | no | yes | - | Full flow/schema/demo detail not yet cataloged (code real: pricing_plan_master/price, /admin/pricing, cross-portal read  | docs/chatgpt-extracts/twenty-five-item-advanced-management-list.md | 2026-08-31 |
| sohamyoga-frontend | product-launch-management | Product Launch Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | product-lifecycle | Product Lifecycle | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | promo-code-management | Promo Code Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | push-notifications | Web/Mobile Push Notifications | REAL | no | no | - | Duplicate/stale registry key from before Web Push existed (that earlier not_built note described a 4-line cache-only ser |  | 2026-09-08 |
| sohamyoga-frontend | qr-checkin-validation | QR Check-In Validation | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | qr-kiosk-login | QR Kiosk Login | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | quiet-hour-control | Quiet-Hour Control | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | quote-to-order | Quote to Order | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | realtime-marketing-automation | Real-Time Marketing Automation | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | referral-loyalty | Referral & Loyalty Management | REAL | yes | yes | - | Customer-facing UI now exists (/customer/loyalty, /customer/referral) as of 2026-08-31 -- earlier "no user UI" note is s | docs/chatgpt-extracts/twenty-five-item-advanced-management-list.md | 2026-08-31 |
| sohamyoga-frontend | reputation-management | Review & Reputation Management | REAL | no | yes | - | Full flow verified via code reading, not a live OAuth round-trip (would need real Google credentials to test end-to-end  | deep re-audit 2026-08-31 | 2026-08-31 |
| sohamyoga-frontend | research-health-score | Executive Research Health Score | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | respondent-quality-score | Respondent Quality Score | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | retargeting-pixels | Retargeting / Remarketing Pixels | REAL | no | no | - | Built 2026-09-07 (was not_built -- zero fbq(/gtag('config'/fbevents grep hits anywhere before this). Real tracking_pixel |  | 2026-09-08 |
| sohamyoga-frontend | retargeting-screen | Retargeting Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | review-ai-reply-draft | AI Reply Draft Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | reviews-local-seo | Reviews to Local SEO | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | reward-catalog | Reward Catalog | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | reward-catalog-redemption | Reward Catalog + Redemption | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | sample-quality-controls | Sample Quality Controls | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | sampling-management | Sampling Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | schema-generator | Schema Generator | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | security-control-tower | AI Control Tower — SAST/SCA/IaC/DAST | REAL | no | yes | - | Real, verified tool limitations found live 2026-09-01: neither trivy 0.70.0 config nor checkov 3.3.16 --framework list s |  | 2026-09-01 |
| sohamyoga-frontend | seo-architecture | SEO Architecture | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | seo-content-brief | SEO Content Brief | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | seo-issue-prioritization | SEO Issue Prioritization | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | seo-management | SEO Management | REAL | no | yes | - | Built 2026-09-08. Closes: "marketing_search_visibility_snapshot table exists but zero job writes to it." New src/cron/jo | docs/chatgpt-extracts/twenty-five-item-advanced-management-list.md | 2026-09-08 |
| sohamyoga-frontend | service-fulfillment | Service Fulfillment | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | social-health-score | Social Health Score | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | split-orders | Split Orders | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | survey-builder | Survey Builder | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | survey-lifecycle | Survey Lifecycle | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | survey-management | Survey Management | REAL | yes | yes | - | Built 2026-09-07 (was: "Schema is mature (12 real tables) and NPS respond flow is real, but the admin UI's surveys/quest | docs/chatgpt-extracts (Poll investigation, 2026-08-31) | 2026-09-08 |
| sohamyoga-frontend | survey-question-builder | Survey Question Builder | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | survey-response-submission | Survey Response Submission | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | topic-cluster-engine | Topic Cluster / Content Hub | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | trend-discovery | Trend Discovery Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | trigger-configuration-screen | Trigger Configuration Screen | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | trigger-management | Trigger Management | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | unified-communication-inbox | Unified Communication Inbox | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | utm-tracking | UTM / Campaign Parameter Tracking | REAL | no | yes | - | Built 2026-09-07, closing both documented gaps. (1) MCP execution: new src/domain/mcp/internal-tool-execution.ts adds a  | UTM Tracking admin UI + public click-redirect build session, 2026-09-03 (prior audit: real schema, 0 rows, no admin UI -- registry showed UI: false, Database: true (empty), Admin Portal: false) | 2026-09-08 |
| sohamyoga-frontend | video-editing | Video Editing (multi-clip/timeline) | REAL | no | yes | - | Built 2026-09-07/08: real src/domain/video/VideoTimelineRenderer.ts closes the "no multi-clip concatenation, trim, or tr | chat session 2026-08-31 -- confirmed still not_built for editing; found+fixed a real runaway-render bug introduced while working on audio | 2026-09-08 |
| sohamyoga-frontend | video-management | Long-Form + Short-Video Management | REAL | no | yes | - | Full flow/schema/demo detail not yet cataloged (code real: /admin/videos, espeak-ng+FFmpeg pipeline). | docs/advanced-management-feature-list-gap-analysis.md | 2026-08-31 |
| sohamyoga-frontend | viral-lead-detection | Viral Lead Detection | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | voice-of-customer | Voice of Customer — Weekly Digest & Export | REAL | no | yes | - | Verified live 2026-09-01: both single-digest (?id=) and multi-digest (default limit=8) PDF exports return real PDF v1.7  |  | 2026-09-01 |
| sohamyoga-frontend | web-push-notifications | Web Push Notifications | REAL | no | no | - | Built 2026-09-07: real push branch wired into NotificationDispatchJob.ts (renders notification_template.body/subject loc | Web Push build session, 2026-09-03 (prior audit: sw.js was a 4-line cache-only stub, zero hits for PushManager/push_subscription/firebase.messaging) | 2026-09-08 |
| sohamyoga-frontend | website-to-business-profile-import | Website-to-Business Profile Import | REAL | no | no | - | - |  |  |
| sohamyoga-frontend | wellness | Wellness Tracking | REAL | no | yes | - | Two real bugs found live and fixed 2026-09-01: (1) wearables POST reused one SQL parameter in two conflicting type conte | live code/schema audit 2026-08-31 | 2026-09-01 |

## password-manager

Full-column evidence (single-module portal). Verified 2026-09-08 via direct file reads of
`db/schema.sql`, `lib/crypto-client.ts`, `lib/session.ts`, `lib/postgres.ts`, all `app/api/**`
routes, `app/page.tsx`, `docker-compose.yml`, `.env.local`; live `docker ps -a`, live
`docker exec passwordmanager-postgres psql` row counts, `ss -tlnp` port scan.

| Field | Value |
|---|---|
| Portal | password-manager |
| Domain | Credential/Secrets Management |
| Module | Zero-Knowledge Password Vault (auth + vault CRUD) |
| Business purpose | Personal credential vault — store/retrieve login items with client-side E2E encryption so the server never sees plaintext secrets. No README describes this (unedited `create-next-app` boilerplate) — purpose inferred from code comments. |
| User persona | Single end-user (self-hosted personal vault); no sharing, no admin role, no teams |
| Entry point | `app/page.tsx` (single-page client component) |
| UI exists? | Yes — login/signup + add-item form + item list with delete. No edit-item UI (API supports PUT, unwired), no password mask/reveal toggle, no generator, no search |
| API exists? | Yes — 6 routes: `auth/{signup,login,logout,kdf-params}`, `vault/items` (GET/POST), `vault/items/[id]` (PUT/DELETE) |
| DB schema exists? | Yes — `app_user`, `vault_item`, `app_session`, `pgcrypto` extension |
| DB writes verified? | Schema migrated and live, but **zero rows in any table** — no signup/login/item-creation has ever actually run. Write path is code-correct, not live-proven. |
| DB reads verified? | Same caveat — code-correct, never executed against real rows |
| External integration exists? | None — only self-hosted Postgres + native `argon2` bindings |
| External integration tested? | N/A |
| AI/LLM used? | No |
| Agentic workflow used? | No |
| Tests exist? | No — zero test files anywhere, no Jest/Playwright config, no CI reference |
| E2E demo verified? | No. App not currently running (no process on any port); only Postgres container exists and was found stopped (`Exited (0) 7 days ago`) |
| Security controls | **Real, sound design.** Client: Web Crypto PBKDF2-SHA256 600k iterations (matches Bitwarden's default) derives a Master Key; separate one-way `authHash` sent to server (never the password/key itself); random AES-256-GCM Vault Key wraps items, itself encrypted by the Master Key — server never sees plaintext. Server: `auth_hash` re-hashed with real Argon2id (genuine native bindings, not a stub) before storage. Sessions: random 32-byte token, only its SHA-256 hash stored, `HttpOnly; Secure; SameSite=Lax`. Login runs a dummy Argon2 verify on unknown emails to resist enumeration. No plaintext-secret logging found. Caveats: `SERVER_PEPPER` used only for the fake-salt HMAC, not as a real pepper on the auth hash; UI shows stored passwords in plaintext with no mask control; no rate-limiting on auth routes; never independently audited or pen-tested. |
| Observability | None — no logging framework, no metrics, no error tracking |
| Deployment status | Own `docker-compose.yml` with only a `postgres:16-alpine` service — no Dockerfile for the app itself (runs via `npm run dev`/`next start` outside Docker). `passwordmanager-postgres` container found **Exited (0) 7 days ago** — not running before this audit. Not wired into any reverse-proxy or other compose stack. |
| Source origin | **Original/custom-built** — no LICENSE, no Bitwarden/Vaultwarden source or dependency; independently reimplements a similar zero-knowledge pattern from scratch, confirmed via boilerplate README + fresh `package.json` deps |
| Known dependency | Postgres 16 (own container, port 5439); `argon2` native module (real prebuilt bindings present); Web Crypto API (browser-only, no polyfill) |
| Known issue | Container has no restart policy; zero real usage data ever created; no tests; no edit-item UI despite API support; plaintext password rendering; no auth rate-limiting |
| Missing item | Tests, app Dockerfile, observability, rate-limiting, edit-item UI, password generator, 2FA/MFA, vault-sharing (schema has unused `public_key`/`encrypted_private_key` columns), real README, LICENSE |
| Current maturity | **CODE_EXISTS_NOT_INTEGRATED** operationally (schema migrated, container stopped, zero real usage, no tests) — but the crypto/auth *design* itself is **REAL_BUT_PARTIAL**: soundly architected with correct primitives, unverified by any live E2E run or independent audit |
| Evidence file/path | `password-manager/{package.json, db/schema.sql, lib/crypto-client.ts, lib/session.ts, lib/postgres.ts, app/api/**, app/page.tsx, docker-compose.yml, .env.local}`; live `docker ps -a --filter name=passwordmanager`, live row counts |
| Last verified date | 2026-09-08 |

**Summary:** genuinely sound, custom-built zero-knowledge crypto design (client-side PBKDF2 600k + AES-256-GCM, server-side Argon2id re-hash) — not a naive scheme, not forked OSS. But architecturally correct ≠ operationally proven: never run end-to-end, container stopped, zero rows in any table, no tests, no independent security review. Do not present as "production-ready" without a live signup→add→logout→login→decrypt round-trip and a dedicated crypto review first.

## voice-agent-platform

Verified 2026-09-08 via direct reads of all `src/domain/*`, `src/app/api/*`, `docker-compose.yml`,
`package.json`, `Dockerfile`, `docs/PLATFORM_REFERENCE.md`, `SESSION_HANDOFF.md`; live `docker ps`;
live `psql` queries against the running `voiceagent-postgres` container (schema + row counts +
samples on `call_log`, `vapi_api_audit_log`, `vapi_created_assistant`, `vapi_sync_log`,
`notification`); `curl` to port 8090.

| Domain | Module | UI/API/DB | DB writes verified | External integration | Maturity | Known issue |
|---|---|---|---|---|---|---|
| call | Vapi outbound call placement | yes/yes/yes | code path real, but **zero `/call` POSTs ever appear in `vapi_api_audit_log`** (12 rows, all `/assistant` and `/phone-number`) — never actually invoked | Vapi | CODE_EXISTS_NOT_INTEGRATED | wired since 2026-09-02, never actually invoked; no live ring ever demonstrated |
| call | Vapi assistant create/update sync | yes/yes/yes | **yes** — live audit log shows real `POST/PATCH /assistant` (200/201) on 2026-09-02/03; `vapi_created_assistant` has 2 real rows | Vapi | REAL_END_TO_END | none |
| call | Vapi tenant-isolation guard | n/a/n/a/yes | yes — a real `blocked=t` audit row exists | Vapi | REAL_END_TO_END | **real prior incident**: a manual test nearly overwrote an unrelated live client's assistant ("Domino's Pizza-Inbound Call") before this guard existed; guard rebuilt, now proven working |
| call | Vapi end-of-call webhook receiver | n/a/yes/yes | code real, but **zero `call_log` rows show webhook-sourced data** (only row is manual) | Vapi (`x-vapi-secret` verified) | CODE_EXISTS_NOT_INTEGRATED | `docs/PLATFORM_REFERENCE.md` (dated 2026-09-02) still says "not built" — **stale**; code exists as of same day per file mtimes |
| call | Inbound call routing (default assistant) | yes/yes/n-a | live `GET /phone-number` (200) confirms **no assistantId currently set** | Vapi | REAL_BUT_PARTIAL | **confirmed real gap: the shared inbound number has zero assistant attached — any real inbound call rings unanswered by AI** |
| call | Manual call logging | yes/yes/yes | yes — the one existing `call_log` row was created this way | none | REAL_END_TO_END | this is currently the *only* way real call outcomes reach `call_log` |
| call | Call quality review | yes/yes/yes | code real, not live-verified this session | none | CODE_EXISTS_NOT_INTEGRATED | none found |
| call | Vapi cost cap / spend control | yes/yes/yes | code real, depends on webhook cost data which isn't populated live | derives from `call_log.cost_usd` | CODE_EXISTS_NOT_INTEGRATED | depends entirely on the unverified webhook path above |
| mcp | Vapi MCP server (8 tools) | n/a/yes/reuses | reuses existing repos | ContextForge (federation) | REAL_BUT_PARTIAL | real tool-use surface for an external agent (not itself autonomous); `place_call` requires explicit `confirmed:true` |
| contact | Contact management + CSV import + preferences | yes/yes/yes | yes — real INSERT/UPDATE confirmed, live table has 2 real rows | none | REAL_BUT_PARTIAL | `customer_preference` table empty (0 rows) despite schema/repo existing |
| script | Call script + versioning + templates | yes/yes/yes | yes — live: 24 scripts / 25 versions / 3 templates | Vapi (via sync) | REAL_END_TO_END | one real sync failure logged (2026-09-03) — genuine failure case, not fabricated |
| calendar | Cal.com adapter (availability/book) | partial/yes/n-a | n/a | Cal.com | **CONFIG_ONLY** | `CALCOM_API_KEY` empty in `.env` — fails closed, never tested against a live account (unlike Vapi) |
| contact/form | Public lead-capture forms | yes/yes/yes | yes — live: 1 definition, 1 real submission | none | REAL_END_TO_END | none found |
| notification | In-app notifications | yes/yes/yes | yes — live: 1 real row (`vapi_sync_failed`, 2026-09-03) | none | REAL_BUT_PARTIAL | only 1 real notification exists to date — most trigger paths (cost cap, unmatched inbound) unexercised live |
| customer | Business customer self-service portal | yes/yes/yes | code real (scrypt hashing, session tokens); **live table has 0 rows** despite `PLATFORM_REFERENCE.md` claiming "2 real businesses registered" as of 2026-09-02 — **that data no longer exists** | none | REAL_BUT_PARTIAL | prior verification data no longer present in live DB; cannot re-confirm tenant isolation without re-running |
| admin | Admin auth (login/session) | yes/yes/yes | live: 2 real `admin_user` rows; scrypt + timing-safe compare confirmed | none | REAL_END_TO_END | none found |
| reports | Reports/dashboard | yes/yes/reuses | real aggregate queries, honest-empty-state design (own code comment) | none | REAL_BUT_PARTIAL (real queries, thin real data) | near-empty `call_log`/`business_customer` means most views currently render empty |
| infra | Postgres database | n/a/n/a/yes | 17 tables, 23 applied migrations | n/a | REAL_END_TO_END | **running** — `docker ps` confirms `voiceagent-postgres` healthy |
| infra | Next.js app container | n/a/n/a/n-a | n/a | n/a | **BROKEN (currently down)** | `voiceagent-app` **Exited (0) 3 days ago** — none of the UI/API claims above are reachable right now without a restart |
| testing | Automated test suite | n/a | n/a | n/a | **MISSING** | zero test files anywhere, no CI config |

**Summary — answers the earlier "voice AI inbound/outbound scenario" question directly:** the Vapi
*assistant-configuration* lifecycle is genuinely real and proven (real, successful `POST/PATCH
/assistant` calls against api.vapi.ai, including a real caught-and-fixed tenant-isolation incident
that nearly overwrote an unrelated production client's assistant). But **actually placing or
receiving a phone call has never been exercised**: the outbound-call code path exists and has a live
API key, yet zero `/call` POSTs appear in the audit log; the inbound webhook receiver exists but zero
webhook-sourced rows exist in `call_log`; and the shared inbound number currently has **no assistant
attached at all**, so a real inbound call today would ring unanswered. `docs/PLATFORM_REFERENCE.md`
is stale and overstates what's missing in one place while a separate live DB shows previously-claimed
verification data (2 registered businesses) no longer exists. The app container itself is currently
stopped — nothing above is reachable over HTTP without a restart. No automated tests exist anywhere.

## SohamYoga.Web (.NET backend)

Verified 2026-09-08 via direct file reads, grep, live `docker ps`, and live HTTP calls against the
running `sohamyoga-backend` container (port 5070).

| Domain | Module | DB writes verified | DB reads verified | Security | Maturity | Known issue |
|---|---|---|---|---|---|---|
| Identity/Auth | Staff Auth (Admin/Editor/HR/Sales/Teacher) | yes — `SignInManager`/`UserManager` writes | yes — live `/api/auth/me` → 401 confirmed | ASP.NET Identity, cookie HttpOnly/SameSite=Lax, lockout 5/30min | REAL_BUT_PARTIAL | no test project exists at all |
| Identity/Auth | Customer Auth | yes — `CreateAsync`/`AddToRoleAsync` | yes — live `/api/customer/auth/me` → 401 confirmed | Role-gated to `Customer` | REAL_BUT_PARTIAL | none found |
| Identity/Auth | User & Role Management | yes (code path; not independently re-verified live) | not re-verified this session | `[Authorize(Roles="Admin")]`, self-delete blocked, role whitelist | REAL_BUT_PARTIAL | none found |
| Content/CMS | Home / Site Settings | yes, seeded | yes — live `curl /api/home` returned real seeded data | public read | REAL_BUT_PARTIAL | Services/Testimonials/CaseStudies etc. deliberately unseeded |
| Content/CMS | Services/Testimonials/CaseStudies/Blog/Team/Industries/Videos | code path exists, not exercised live | yes — live curl on 3 endpoints confirmed real (empty) DB round-trip | role-gated writes, public reads | REAL_BUT_PARTIAL | **content deliberately not seeded** — `SeedData.cs:25-29` explicitly notes the prior seed data described an unrelated "SLP Systems" IT-consulting business and was intentionally removed (matches this workspace's documented SLP→SohamYoga rebrand) |
| E-commerce | Yoga Products Catalog | yes — 12 real seeded rows | yes — live curl confirmed real product JSON | public reads, Admin writes | **REAL_END_TO_END** | only fully-seeded content module |
| Lead Capture | Contact Form | code path present | yes, consumed by AdminDashboard | Admin,Sales gated | REAL_BUT_PARTIAL | triggers a **stub** notification email (logs "Would send", doesn't send) |
| Lead Capture | Newsletter | code path present | not re-verified | Admin,Sales gated | REAL_BUT_PARTIAL | same email-stub pattern |
| Lead Capture | Chat Requests (async callback) | yes — real `AddAsync`+`SaveChangesAsync` | yes | public submit, role-gated manage | REAL_END_TO_END | none found |
| Live Chat | SignalR Chat Hub + REST history | **yes, real** — `SendMessage`/`AdminReply` both persist via `_uow.ChatMessages.AddAsync`+`SaveChangesAsync` *before* broadcasting — genuine persistence, not scaffolding | yes — history/session-list/unread-count read the same table | session-scoped GUIDs prevent enumeration, role-gated admin views | REAL_END_TO_END | not live-WebSocket-tested this pass, but code confirms real persist-then-broadcast pattern |
| Careers | Job Postings & Applications | code path present | not re-verified | Admin,HR gated | REAL_BUT_PARTIAL | none found |
| Admin Ops | Admin Dashboard | n/a (read-only) | yes — real parallel `Task.WhenAll` reads confirmed in code | Admin-only, 401 confirmed live | REAL_END_TO_END | none found |
| Observability | Admin Monitoring (request/audit logs, DB size) | yes — populated by `ApiRequestTrackingMiddleware` on every request | yes — endpoint self-reports live DB provider as `"SQLite"` | Admin-only | REAL_END_TO_END | this module **is** the observability layer |
| Infra | Background job — data cleanup (purges logs >30d/90d) | yes — real `ExecuteDeleteAsync` | n/a | n/a | REAL_END_TO_END | not verified live (would need a 24h wait or forced trigger) |
| Infra | Email/SMTP | n/a | n/a | Admin-only test endpoint | **CODE_EXISTS_NOT_INTEGRATED** | split real/stub: contact/newsletter notifications are logging-only stubs; a genuinely real `SmtpClient.SendMailAsync` path exists at `/api/home/test-email` but `Smtp:Host` is empty, so it fails closed (503) rather than fabricating success |
| Infra | Security middleware (rate limiting, headers, correlation IDs, exception handling) | n/a | live-verified: `X-Correlation-Id` echoed, `/api/health` returns structured JSON | 100 req/60s per-IP (prod), CSP/X-Frame-Options/nosniff, correlation ID in Serilog | REAL_END_TO_END | none found |
| Infra | Health check endpoint | n/a | yes — live `curl /api/health` → `{"status":"Healthy","checks":[{"name":"database","status":"Healthy"}]}` | public, intentional for probes | REAL_END_TO_END | none found — also the Dockerfile `HEALTHCHECK` target |
| Cross-cutting | Testing | n/a | n/a | n/a | **STUB/MISSING** | `SohamYoga.sln` contains only the single `SohamYoga.Web` project — no `.Tests.csproj` exists anywhere |

### Critical cross-cutting findings

1. **Database: a fully separate SQLite store, NOT the shared Postgres instance.** `SohamYoga.Web.csproj`
   references only `Microsoft.EntityFrameworkCore.Sqlite` (zero Npgsql). `Program.cs:30-31` calls
   `UseSqlite(...)`; the deployed `docker-compose.yml` points it at
   `Data Source=/app/data/sohamyoga.db` on a named volume, confirmed live via `docker exec
   sohamyoga-backend ls -la /app/data/` showing an actively-written `.db`/`.db-wal` today.
   `AdminMonitoringController.GetSystemHealth()` self-reports `"provider": "SQLite"` at runtime.
   **This backend has zero connection to the 496-table `sohamyoga-postgres` instance that
   sohamyoga-frontend uses — they are two fully independent datastores in the same repo,
   corrected here since the root README's "PostgreSQL migration path available" line could be
   read as implying convergence that hasn't happened.**
2. **Roles match the frontend's checks, no mismatch found.** Backend seeds 6 roles (Admin, Editor,
   HR, Sales, Customer, Teacher); frontend's `admin-auth.ts` checks for `['Admin','Editor','Sales']`
   — a correct subset, not a mismatch.
3. **SignalR live chat is genuinely real**, not scaffolding — persistence-before-broadcast confirmed
   in code (`ChatHub.cs`), backed by a real migration.
4. **No test project exists anywhere in the .NET solution.**
5. **Content seeding is deliberately partial** — only SiteSettings + 12 Yoga Products are real seeded
   content; everything else is schema+API real but empty by design, tied to the documented
   SLP→SohamYoga rebrand cleanup.
6. **Email is split real/stub** — notification sends are logged-only; a real SMTP test endpoint
   exists but fails closed (unconfigured host) rather than fabricating success.
7. **JWT config in `appsettings.json` is vestigial/dead** — zero code usage found; auth is
   exclusively cookie-based ASP.NET Identity, matching the README.

**Live deployment confirmed:** `sohamyoga-backend` container `Up 5 days (healthy)` on port 5070,
built from a non-root multi-stage Dockerfile with a real `HEALTHCHECK`, wired into root
`docker-compose.yml` behind nginx and in front of the frontend.

## Known limitations of this checkpoint

1. **15 of 27 requested columns are not populated per-row** for the 196 registry-tracked modules
   (persona, entry point, DB writes/reads verified as booleans, AI/LLM used, agentic workflow used,
   tests exist, E2E demo verified, security controls, observability, deployment status, source
   origin, known dependency as a separate field from known issue). Populating these honestly for 196
   rows requires either querying additional registry columns not yet checked in this pass
   (`user_flow`, `admin_flow`, `data_flow`, `job_name`, `report_location`, `dashboard_location` exist
   in the schema but weren't exported here) or a real per-module code read. Flagged, not silently
   dropped.
2. **3 portals not yet covered**: ai-orchestrator-platform, SohamYoga .NET backend, and
   market-research-portal's non-registry backend surface. Under active parallel investigation as of
   this checkpoint. (voice-agent-platform and password-manager completed in this checkpoint.)
3. **AI/Agentic workflow classification** (Phase 10 of the full audit) has not been applied to any
   module yet — that requires a dedicated LEVEL 0-6 classification pass per the mandatory policy,
   not a guess embedded in this Phase 1 matrix.
