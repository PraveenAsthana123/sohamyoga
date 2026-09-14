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
