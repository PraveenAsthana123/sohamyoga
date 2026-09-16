# Extracted: "Affiliate Marketing Use Cases" (taxonomy + market research + 9 industry-vertical playbooks)

**Source:** [ChatGPT shared conversation](https://chatgpt.com/share/6aa78af4-1834-83e8-a034-e684f335d120), title "Affiliate Marketing Use Cases", 49 messages.
**Extracted:** 2026-09-13, via the mandatory `python3 /home/praveen/.claude/scripts/chatgpt_share_extract.py <url>` script (per the Global ChatGPT Shared-Link Extraction Policy — plain WebFetch is not used).
**Raw JSON:** `/home/praveen/.claude/projects/-mnt-deepa-sohamyoga/c9bb9633-09fe-44f5-b4ef-6ccc776eb0a8/tool-results/bmczcn7g9.txt` (231.5KB).
**Per-message split:** `/tmp/claude-1000/-mnt-deepa-sohamyoga/c9bb9633-09fe-44f5-b4ef-6ccc776eb0a8/scratchpad/chatgpt-extract/{index}_{role}.txt` (49 files).

## Full enumeration of all 17 user turns (100%, not a sample)

| # | Index | User turn verbatim | Answered by (assistant idx) | Read in full? |
|---|---|---|---|---|
| 1 | 0 | "affilate marketing ..list of sceanrio , tool used , end to end usecase , demo story" | 5 (18,613 chars) | Yes |
| 2 | 6 | "affilate marketing vs performance market" | 7 (5,969 chars) | Yes |
| 3 | 8 | "add lead generartive vs etc" | 9 (9,997 chars) | Yes |
| 4 | 10 | "each market type ..paid tool , high in demand , open soruce" | 17 (12,690 chars) | Yes |
| 5 | 18 | "list of demo usecase for each market type end to end and value for customer" | 19 (15,085 chars) | Yes |
| 6 | 20 | "list of usecase from market reserach" | 21 (12,512 chars) | Yes |
| 7 | 22 | "shopify interation poral ..to sell the product" | 26 (15,740 chars) | Yes |
| 8 | 27 | "school...marketing ..list of market type -video,infulence, ads, lead,customer aqusition ,branding, market reserch, etc" | 28 (9,640 chars) | Yes |
| 9 | 29 | "create end to end flow" | 30 (11,322 chars) | Yes |
| 10 | 31 | "dental" | 32 (13,972 chars) | Yes |
| 11 | 33 | "yoga" | 34 (11,924 chars) | Yes |
| 12 | 35 | "ophthalmology" | 36 (11,920 chars) | Yes |
| 13 | 37 | "dominos piza center" | 40 (12,383 chars) | Yes |
| 14 | 41 | "mekup -eyebrow design" | 42 (12,435 chars) | Yes |
| 15 | 43 | "online teaching" | 44 (11,709 chars) | Yes |
| 16 | 45 | "real estate" | 46 (13,143 chars) | Yes |
| 17 | 47 | "astrology online - nuroligist , palm, etc other" | 48 (11,340 chars) | Yes |

**Redacted/unrecoverable tool messages (12 total, all "The output of this plugin was redacted."):** indices 2, 3, 4, 12, 13, 14, 15, 16, 24, 25, 38, 39. All 12 sit between a short user prompt and a long assistant answer that opens with "Yes." — consistent with browsing/citation-lookup plugin calls whose results are folded into the next assistant message rather than surfaced separately. Nothing else in the transcript depends on their content; the substantive answer for each of those turns was still read in full at its resolving assistant index.

**Honest count: 17 of 17 user turns enumerated (100%, not a sample). 17 of 17 read in full (100%). 12 of 12 redacted tool messages identified and disclosed (their absence does not remove any user-visible content).**

## What the conversation actually contains

This is a single long strategy session (not "next"-cadence padding like the market-research-250 extract) building an **agency service-line taxonomy**, then applying it to **9 industry verticals** as identical end-to-end playbooks. Structure:

1. **Msg 0/5** — Affiliate Marketing as a full agency service line: scenarios (content affiliate, coupon/deal, comparison sites, influencer affiliate, email affiliate, cashback/loyalty, marketplace affiliate, SaaS referral), named tools (Impact, PartnerStack, Tapfiliate, Post Affiliate Pro, Refersion, FirstPromoter + open-source options), an end-to-end demo flow, and a "demo story."
2. **Msg 6/7** — Affiliate vs. Performance Marketing: affiliate is scoped as a subset of performance marketing; performance marketing additionally covers PPC, paid-social performance, programmatic CPA, app-install/UA — with a channel/payment-model/attribution comparison table.
3. **Msg 8/9** — Adds Lead Generation, Demand Generation, and Growth Marketing as adjacent, distinctly-defined categories.
4. **Msg 10/17** — A tool-selection matrix (paid / high-demand / open-source) across every marketing type named so far.
5. **Msg 18/19** — A demo-use-case library: one end-to-end demo + customer value statement per marketing type.
6. **Msg 20/21** — A market-research-specific use-case catalog (client-facing use cases, not the 250-report-type catalog already captured in the separate `market-research-report-catalog-250.md` extract — this is a different, shorter list).
7. **Msg 22/26** — A "Market Research → Shopify Commerce Integration" demo concept: using research signals to drive an actual product-selling Shopify storefront.
8. **Msg 27-45 (9 verticals)** — School/college, dental clinic, yoga studio, ophthalmology clinic, Domino's-style pizza/QSR, makeup/eyebrow-design studio, online teaching, real estate, and (msg 47/48) an online astrology/numerology/palmistry/tarot spiritual-advisory marketplace. Each vertical gets the same repeated template: a service/market-type table, ASCII end-to-end flow diagrams (acquisition → conversion → retention), demo use cases, revenue models, customer-acquisition channels, an "AI layer" (matching/content/prediction), a control-tower dashboard sketch, and a ranked "best demos to build first" list. The astrology one (fully read, msg 48) is the most detailed: 40-row service catalog, 14 ASCII flow diagrams, a revenue-model table (pay-per-session, pay-per-minute, subscription, report sales, marketplace commission, courses), and explicit non-diagnostic-framing caveats for AI-assisted palmistry/compatibility/matching features.

## Cross-check against the current codebase

Checked live (not from memory) against both TalentsHill (`/mnt/deepa/talentshill`) and sohamyoga (`/mnt/deepa/sohamyoga`), since this session built 41 TalentsHill admin modules including Ads Management, Market Research, and Influencer Video.

| Conversation concept | Already real anywhere? | Evidence |
|---|---|---|
| Affiliate marketing as an agency **service** (managing affiliate/partner programs for TalentsHill's clients) | **No.** | `grep -ril affiliate app lib` in `/mnt/deepa/talentshill` returns nothing. TalentsHill's Module 34 "Ads Management" is paid-ad-campaign CRUD (Google/Meta), a different concept from affiliate/partner-network management. |
| Affiliate/referral tracking (any form) | **Partial, but a different product.** | `sohamyoga-frontend` has a real, working affiliate/referral system (`src/domain/referral/AffiliateLedger.ts`, `AffiliateDestination.ts`, `ReferralCode.ts`, `app/admin/affiliates`, `app/r/[code]/route.ts`, tested in `__tests__/domain/referral/AffiliateTracking.test.ts`) — but this tracks referrals **into** sohamyoga's own yoga product, not an agency capability for running affiliate programs on behalf of other clients. Different purpose; not a substitute. |
| Market-research use-case catalog (msg 20/21) | **No — and distinct from the 250-report catalog already tracked as a gap.** | Prior extract `market-research-report-catalog-250.md` already recorded 0/250 report types implemented in `market-research-portal`. This conversation's msg 21 catalog is a separate, shorter use-case list (not report specs) and is equally unbuilt — no `report_type`/`use_case_catalog` table exists anywhere. |
| Shopify integration (msg 22/26) | **No.** | `grep -ril shopify` returns zero hits in both `sohamyoga` and `/mnt/deepa/talentshill`. Genuinely new, unbuilt concept. |
| School, dental, ophthalmology, pizza/QSR, makeup/eyebrow, online-teaching, real-estate, astrology vertical playbooks (8 of the 9) | **No.** | TalentsHill's `app/industries/page.tsx` is a 33-line stub with no per-vertical content (`title: 'Industries'` only). `app/solutions/*` covers generic service lines (ads-management, market-research, digital-marketing, seo-geo, etc.) — none scoped to any of these 8 industries. |
| Yoga studio vertical playbook (msg 33/34) | **Overlaps with prior extract, already reconciled there.** | `yoga-marketing-hooks-and-platform-completeness.md` already covers yoga-specific hooks/storytelling content and confirms no new platform/infra gap from that separate conversation. This new msg 34 content (yoga vertical end-to-end flow, revenue models, AI layer) is additional and not previously captured — it is real, usable vertical-strategy content for sohamyoga's own product, distinct from the hook/storytelling framework already logged. |
| Influencer-marketing content within each vertical playbook | **Partially adjacent, not a match.** | TalentsHill Module 39 "Influencer Video" is generic influencer/video-campaign CRUD (readiness-scored, admin-only) — it has no vertical-specific playbook content (e.g., "which influencer approach works for a dental clinic vs. a pizza QSR"). The conversation's per-vertical influencer angle is strategy content, not a system gap Module 39 already fills. |

## Verdict

This conversation is a **service-line and vertical-strategy specification**, not idle chat — same category as the market-research-250 and yoga-hooks extracts. It contains two genuinely new, unbuilt items (affiliate-marketing-as-an-agency-service, and a Shopify integration concept) plus 8 vertical playbooks with zero existing representation in either codebase, plus one vertical (yoga) that partially overlaps a prior extract without duplicating it. Nothing here should be treated as already covered by the 41 TalentsHill modules built this session — Ads Management, Market Research, and Influencer Video are real but answer different questions than this conversation raises.

No build action has been taken on this content. Per the "no standing instruction" gap noted for this task, the user should be asked what to do with it before any of it is built.

## Use-case count and pending status (added 2026-09-14, live-verified against `module_registry`)

The conversation contains exactly two numbered "usecase" catalogs (its own term, msg 18/19 and msg 20/21) — **130 use cases total**. Status below is checked against TalentsHill's real `module_registry` table (`sqlite3 /mnt/deepa/talentshill/data/talentshill.db`) plus a live `grep`/`find` sweep for modules with no registry row (social-media management, reviews/reputation, loyalty, churn, personalization, CRO, podcast, retargeting, local/geofencing all confirmed absent — zero files).

**Honest verdict: 0 of 130 are built as the specific AI-driven demo described in the conversation (scoring, attribution, control-tower dashboards, etc.).** The distinction below is only "does *any* underlying admin module exist to extend" vs. "nothing exists at all."

### A. Marketing-type demo use cases (40 total, from msg 19)

| Status | Count | Use cases |
|---|---:|---|
| **Partial infrastructure exists** (a real/partial admin module covers the base entity, but not the AI logic/flow described) | 17 | 1 Performance Marketing (`ads_management`), 2 Lead Generation (`leads`), 5 Influencer Marketing (`influencer_video`), 7 Paid Search/PPC (`ads_management`), 8 Paid Social (`ads_management`), 11 Content Marketing (`content`), 13 Email Marketing (`templates`/`email_compose`), 14 Lifecycle Marketing (`campaigns`), 18 Brand Marketing (`branding`), 21 Market Research (`market_research`), 26 Conversational Marketing (`chat`), 27 Voice AI Marketing (`voice_ai`), 28 SMS/WhatsApp Marketing (`broadcasts`), 31 Event/Webinar Marketing (`appointments`), 32 Video Marketing (`video_editing`/`videos`), 33 YouTube Marketing (`youtube`), 39 Competitive Intelligence Marketing (`competitor_analysis` — closest to a real match) |
| **Zero coverage** (no matching module anywhere) | 23 | 3 Demand Generation, 4 Affiliate Marketing, 6 Referral Marketing, 9 SEO (public page only, no admin capability), 10 AEO/GEO, 12 Social Media Marketing, 15 Marketing Automation (`workflows` is approval-routing, not nurture automation), 16 Customer Marketing (upsell/cross-sell), 17 Loyalty Marketing, 19 Reputation/Review Marketing, 20 Social Listening, 22 ABM, 23 Partner Marketing, 24 CRO, 25 Product-Led Growth, 29 Local Marketing, 30 Community Marketing, 34 Podcast Marketing, 35 E-commerce Marketing, 36 Retargeting, 37 Personalization Marketing, 38 Customer Journey Orchestration, 40 Pricing/Promotion Marketing |

### B. Market-research use cases (90 total, from msg 21)

**All 90 pending — 0 built as distinct capabilities.** The `market_research` module is registry-status `partial` and has a real Ollama-grounded synthesis agent (built earlier this session, Module 37), but it performs generic brief synthesis from analyst-provided notes — it does not implement any of the 90 named methodologies (TAM/SAM/SOM calculator, Van Westendorp pricing study, conjoint analysis, PESTLE, Porter's Five Forces, churn/win-loss research, etc.) as a distinct, data-driven capability. No `report_type`/`use_case_catalog` table exists to even track them individually (same gap already documented in the separate `market-research-report-catalog-250.md` extract for its 250-report catalog — this 90-item list is additional, not a subset).

### Total

**130 use cases enumerated. 0 fully built. 17 have partial underlying infrastructure to extend. 113 have zero existing code to build from.**

## Staleness check (added 2026-09-14, second pass — link re-pasted by user, no accompanying text)

The user re-pasted this exact conversation's share link with no new text. Per the extraction policy's search-first discipline, this was **not** re-extracted from scratch — this file already satisfies the mandatory enumeration/cross-check requirements. Instead, the "0 of 130 built" verdict above was re-checked against `module_registry` as it stands now, since a large TalentsHill gap-analysis backlog (55+ new modules) was built and live-verified in the days after 2026-09-13.

**Verdict: the "0 of 130 built" framing is now stale for 4 of the 23 "zero coverage" marketing-type items**, plus one "partial infrastructure" item materially strengthened. The 90-item market-research table is **unchanged** — no TAM/SAM/SOM/PESTLE/Porter's/conjoint/etc. methodology was built as a distinct capability; `market_research`'s only 2026-09-14 change was an analyst-scored opportunity-ranking feature, not a new methodology.

Moved from **zero coverage → real underlying module exists**:

| # | Use case | New module | What it actually does | Important caveat |
|---|---|---|---|---|
| 10 | AEO/GEO | `geo_visibility` | Real admin-entered AI-answer-engine (ChatGPT/Perplexity/Gemini/Copilot) mention logging + mention-rate computation, live-verified (2 obs, 50% rate) | Manual logging, no AI-search-engine API integration |
| 22 | ABM | `b2b_abm_engine` | Real named-account rollup grouping `contact_submissions` by normalized company name for multi-stakeholder visibility, live-verified (accountScore=85) | Tracks TalentsHill's *own* inbound leads, not a client-facing ABM campaign tool |
| 23 | Partner Marketing | `partner_ecosystem` | Real admin-entered partner tracking (6 types, prospecting/active/inactive), live-verified status transition | No partner-portal/CRM-sync integration; tracks TalentsHill's own partners |
| 24 | CRO | `cro_friction_engine` | Real logged friction findings (7 types, severity 1-5) with a disclosed readiness-score formula, live-verified (severity-4 finding dropped score 100→76) | No automated site crawler/UX-analytics integration; manual entry only |

Strengthened within **partial infrastructure** (was already partial, now has more real logic underneath):

| # | Use case | Change |
|---|---|---|
| 39 | Competitive Intelligence Marketing | `competitor_benchmark_engine` added real 8-dimension numeric head-to-head scoring on top of the pre-existing `competitor_analysis` module, live-verified (Microsoft digital_presence gap = -18) |

Checked and confirmed **still genuinely zero coverage** despite the adjacent-sounding `pr_earned_media` module (real Share-of-Voice computation over sentiment-tagged brand mentions, live-verified 25% positive share): this measures PR/media-mention sentiment, not customer review management (Google/Yelp-style), so **#19 Reputation/Review Marketing stays zero coverage** — flagged here only so it isn't mistaken for a match later.

**Net revised total: 130 use cases. 0 fully built as the AI-driven, client-facing demo the conversation describes. 18 have partial infrastructure (up from 17). 19 have zero coverage but a reusable internal module now exists to extend (up from 0, down from 23). 94 have zero existing code to build from (down from 113).**

One structural caveat that applies to all 5 newly-real modules above: they were built as **TalentsHill's own internal growth-ops tooling** (tracking TalentsHill's own accounts/partners/website/AI-visibility), not as a **productized service offering to demo to prospective clients** — which is what the conversation's 40-item catalog actually describes. The underlying logic (rollup, scoring, friction-weighting) is real and reusable, but turning any of these into a client-facing demo is still unbuilt work, not a relabeling exercise.

No build action has been taken on this refreshed picture. Still waiting on the user for direction: update in place is now done (this section); building any specific still-zero-coverage item, or repurposing one of the 5 internal modules into a client-facing demo, both remain open asks.

## Build executed (added 2026-09-15) — 7 prioritized client-facing demos

User instructed "investigate all older module as well", then "build all", then clarified: an autonomous, end-to-end demo list for a digital marketing agency to showcase. Rather than building all 40 marketing-type use cases shallowly, adopted the source conversation's own "Best demos to build first" recommendation (msg 19: "I would not build all 40 separately... build a single platform and expose these as modules") — 7 prioritized demos + a master Control Tower.

Built in TalentsHill (`/mnt/deepa/talentshill`), commit `c487c56`, pushed to `origin/main`:
- **Control Tower** and **Lead Generation AI** — `readiness=ready`, pure composition of already-real engines (KPI Engine, Growth Readiness, Opportunity Engine, Scenario Simulator, Lead Scoring/NBA/Research-Router).
- **Affiliate Revenue Control Tower** and **Lifecycle/Churn AI** — net-new real engines (recruit→link→click→conversion→commission→fraud-check; deterministic lifecycle/churn classification), `readiness=partial` (disclosed gaps: no payout gateway, no behavioral-event log).
- **SEO+Content AI**, **Social+Influencer AI**, **Performance Marketing AI** — real composition/extension of existing partial modules, `readiness=partial`, each honestly disclosing its real gap in the UI.

Full evidence: `docs/testing/2026-09-15_demo-showcase-log.txt` in the TalentsHill repo (10/10 new unit tests, 285/285 full suite, 0 typecheck errors, live curl walkthrough including the fraud-heuristic boundary). Live at `/admin/demos` once TalentsHill's dev server is running.

**Still explicitly out of scope, by design, not by omission**: 33 of the 40 marketing-type use cases and all 90 market-research use cases from this conversation's two catalogs remain un-demoed.
