# Feature Status Matrix — sohamyoga-frontend

Source of truth: live `module_registry` Postgres table, queried directly on 2026-09-07
(`docker exec sohamyoga-postgres psql -U sohamyoga -d sohamyoga`) — not the incremental seed files,
which are stale/partial by design (see [LLD.md](LLD.md) §3).

## 1. Status matrix (real counts, not estimated)

| built_status | count | % of 188 |
|---|---|---|
| real (fully developed, working end-to-end) | 164 | 87.2% |
| partial (real code exists, a specific gap is documented) | 23 | 12.2% |
| not_built | 1 | 0.5% |
| **Total cataloged for sohamyoga-frontend** | **188** | 100% |

Companion `market-research-portal` rows in the same registry: 6 real, 2 partial (8 total) — out of
scope for this document, which covers sohamyoga-frontend only.

**Caveat:** this matrix reflects what's been cataloged in `module_registry`. It is not a claim that
188 is the total number of features in the app — it's the number that have been through a
verification pass and recorded. Treat gaps in cataloging as "not yet cataloged," not as "doesn't
exist."

## 2. The 1 not_built module

| module_key | name | why |
|---|---|---|
| `google-ads` | Google Ads (platform-specific) | Zero Google Ads API client code anywhere (grep-confirmed 0 hits for `googleads`/`google-ads-api`/`GoogleAdsApi`). Only a lead-source enum value exists. |

## 3. The 23 partial modules (real gap, per-module, from `missing_items`)

| module_key | name | documented gap |
|---|---|---|
| affiliate-tracking-links | B2B Affiliate Program (Tracking Links) | Schema/logic real, 0 rows in vendor/commission today; attribution flows through vendor-owned storefront, not affiliate links yet |
| audio-editing | Audio Editing | Single-track TTS loudness/fade only — no multi-track mixing, background music, or noise removal |
| booking | Class Booking | No QR check-in, teacher rating schema, or lateness-threshold tracking |
| branding | Branding (Brand Kits) | Real bug fixed during verification (queried nonexistent `social_platform_bio.bio` column) |
| campaign-management | Campaign Management | Launch/Pause only flips a status column — no real email/notification/social dispatch triggered |
| customer-segmentation | Customer/Lead Segmentation | 5 fields unsupported: membership_plan, total_spend_cad, pose_score_avg, location, challenge_completed |
| drip-campaigns | Drip Campaigns | Real sequencing logic; no SMTP/Novu deployed, so delivery is honestly recorded as queued, never fabricated as sent |
| ecommerce | E-commerce | No real storefront/checkout — `sales_order` never populated by real customer action |
| email-management | Email Management | Novu not deployed, `NOVU_API_KEY` unset — real code, no working delivery in this environment |
| facebook-management | Facebook Management (organic posting) | Same Postiz credential/deployment gap as YouTube |
| first-wave-social-dispatch | Direct-API Social Dispatch (Telegram/Discord/Mastodon/Bluesky) | Adapter code existed since earlier this session but had zero production call site until wired |
| form-management | Form Management | `marketing_form_link` + capture flow real; no generic multi-purpose form builder |
| geo-aeo-management | GEO/AEO Management (AI-search visibility) | AI-answer-engine citation tracking blocked on external API credentials, not attempted |
| heatmap-session-replay | Heatmaps / Session Recording (CRO) | Flag/design intent exists; no actual PostHog/OpenReplay SDK import or script |
| linkedin-management | LinkedIn Management | Only works if Postiz is deployed and holds a LinkedIn OAuth token — no fallback direct integration |
| mcp-gateway | MCP Gateway | Exactly 2 of 29 registered servers' tools have real working implementations |
| paid-ads | Paid Ads Management | Campaign creation is real; launching to a real ad platform (Meta/Google/TikTok) is not possible — zero ad-platform API clients |
| post-management | Post Management | Social scheduler exists; no unified generic "post" entity across content types |
| seo-management | SEO Management | `seo_report`/`SeoReportJob` real (Matomo-based); `marketing_search_visibility_snapshot` table exists but nothing writes to it; no backlink tracking |
| social-media-management | Social Media Management | Real publishing covers FB/LinkedIn/YouTube (Postiz) + Telegram/Discord/Mastodon/Bluesky as of 2026-09-01 |
| telegram-management | Telegram Management | Real, correct, tested bot integration — nothing in the app calls it yet |
| video-editing | Video Editing (multi-clip/timeline) | No multi-clip concatenation, trim, or transition — render is single-script-to-video |
| youtube-management | YouTube Management (organic posting) | Gated on `POSTIZ_PUBLIC_API_KEY` (unset) and a deployed Postiz instance not present in this repo |

## 4. Recorded user stories (real, from `user_story` column)

Honest disclosure: only **9 of 188** modules (4.8%) have a `user_story` recorded. This is not a
list of "the important 9" — it's simply what's been filled in so far. Do not infer that the other
179 lack a real use case; they're just undocumented in this field.

| module_key | user story |
|---|---|
| ecommerce | As a customer, I want to buy a product from a real store, so I receive a real order and shipment — not built yet; admin can manage inventory/vendors in the meantime. |
| experiments | As a marketer, I want to test two CTA button colors and know, with real statistical confidence, which one converts better, so I do not roll out a change based on a guess. |
| reputation-management | As a business owner, I want to see and respond to my real Google reviews from one place, so I do not have to log into Google separately. |
| wellness | As a student, I want my wellness metrics tracked over time, so I can see my progress — not built. |
| poll-management | As a student, I want to vote in a quick poll and see the live results, so I can see how my class feels about a topic. |
| booking | As a student, I want to book a real class session and see my booking confirmed, so I actually have a seat reserved — not built yet. |
| content-calendar | As a marketing admin, I want one place to see and plan all upcoming content across every channel (social, email, SMS, blog, banner, events, workshops, retreats) instead of only social posts. |
| web-push-notifications | As a customer, I want to get a class reminder on my phone/laptop even when SohamYoga is not open in a tab, so I don't miss class. |
| utm-tracking | As a marketing admin, I want to generate a UTM-tagged link for any landing page or portal path in a few clicks, and see real click/lead/conversion counts per link. |

## 5. Recorded demo use cases (real, from `demo_use_cases` JSONB — 5 of 188 modules)

- **experiments** — CTA button color test: "Two variants split 50/50, conversion = booking_completed, real z-test on real bookings"
- **poll-management** — Class feedback poll: "Teacher asks a quick single-choice question, students vote, results shown live"
- **content-calendar** — Plan a social post; Link an entry to a campaign
- **web-push-notifications** — Enable push from preferences; Manual test send via `sendPushToUser`
- **utm-tracking** — Tag a social post; See what actually converted (real `campaign_lead` JOIN, not a guess)

## 6. Follow-up work this document does NOT cover

- A full user-story/use-case backfill for the other 179 real modules (would require either mining
  each module's actual UI/route code, or a project-owner writing session — not something to
  fabricate here).
- Per-domain breakdown of the 164 "real" modules by functional group.
- market-research-portal's 8 registry rows (separate portal, separate doc).
