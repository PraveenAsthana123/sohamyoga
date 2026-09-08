# Digital Marketing — Customer End-to-End Demo Guide

**Version:** 1.0 | **Date:** 2026-09-07 | **Time:** 19:05 IST | **LCD (Last Content Date):** 2026-09-07
**Last edited by:** Claude (sohamyoga session) | **Archive copy:** `docs/digital-marketing-customer-demo-guide-2026-09-07.md` (this file, versioned in git)
**Source of truth:** live `module_registry` table (`sohamyoga` DB, port 5437) + live spot-check against the running dev app on `http://127.0.0.1:8095`, 2026-09-07.

## How to read this guide

Every channel below is graded the same honest way used everywhere else in this codebase — **never present a gated/blocked capability as if it were live**:

- 🟢 **REAL — demo this live, click by click.** Backed by a real DB row, a real API call, a real screen. Safe to show a customer as working today.
- 🟡 **REAL BUT GATED — demo the admin workflow, then explain the gate honestly.** The screen, the data model, and the internal logic are real; the very last hop (an external send/publish) is blocked because a real third-party credential/account isn't connected in this environment. Show the workflow up to that point, then say plainly what connecting a real account would unlock.
- 🔴 **NOT BUILT — do not demo.** Say "not yet built" if asked; do not click-through a fake mockup as if it worked.

This is not a percentage report (per instruction) — it is a channel-by-channel operating script for a live walkthrough.

---

## 1. Paid Ads / PPC — 🟡 REAL BUT GATED
**Screen:** `/admin/ads` (Paid Ads Management)
**Demo script:** Click **+ New Campaign** → fill name, type, daily budget → Create. This is a real `POST` that inserts a real campaign row (verified live: `201 Created`, row appears immediately in the Campaigns tab). Show Budget Guardrails, Bidding Screen, Placement Screen, Platform Selection — all real, backed by real schema (`ai-campaign-optimization-loop`, `budget-guardrails`, `ads-bidding-screen`, `ads-placement-screen` — all `real`).
**The honest gate:** Clicking "AI Generate Ad" is disabled — there is no connected image-generation service (ComfyUI) in this environment. Launching a campaign to an actual ad network (Meta/Google/TikTok) is not possible — **zero ad-platform API clients exist in this codebase** (grep-confirmed). What you're demoing is the campaign-authoring and budget-governance layer, not a live media buy.
**What unlocks it:** A real Meta/Google/TikTok Ads API developer account + OAuth credentials — a customer-side decision, not a code gap.
**Also real in this family:** Dynamic Ad Builder, AI Campaign Optimization Loop, Attribution Modeling (last-touch only), Retargeting Screen (UI), Frequency Management, Channel Selection Engine.

## 2. Google Ads specifically — 🔴 NOT BUILT
**Do not demo.** Grep-confirmed zero Google Ads API client code anywhere in the repo. The only artifact is a disabled feature flag whose own description says "Requires Google Ads developer token." If asked: "Google Ads is the one platform-specific integration not yet built — everything else in Paid Ads is provider-neutral and ready to point at Google once a developer token exists."

## 3. Retargeting / Remarketing Pixels — 🔴 NOT BUILT (in progress this session)
Zero pixel of any kind (`fbq(`, `gtag('config'`, `fbevents`) is embedded anywhere in `src`. Being built now as fail-closed scaffolding (loads only if a real pixel ID is configured; otherwise silently absent, never fabricated) — see backlog below.

## 4. Video (Long-form + Short-form + Editing) — 🟢 / 🟡 mixed
**Screen:** `/admin/videos` (Video Management, `real`) + `/video-sample` (public sample player, live 200 today).
**Demo script:** Walk `/admin/videos` → generate-script → approve → render (real espeak-ng + FFmpeg pipeline, produces a real MP4, checksummed) → publish/archive. Show the real 15-second HyperFrames-built SohamYoga sample at `/video-sample` as a finished output artifact — this is a genuinely rendered video, not a mock.
**The honest gate:** Video Editing is single-script-to-video only — no multi-clip concatenation, trim, or cross-clip transitions yet (that's on the active backlog below). External publishing (YouTube upload) is gated on Postiz/YouTube OAuth, covered under channel #6.

## 5. Social — Facebook, LinkedIn, YouTube (Postiz-brokered) — 🟡 REAL BUT GATED
**Screen:** `/admin/social` + platform-specific admin pages.
**Demo script:** Show the full approval pipeline: draft → platform-specific content variant → admin approval → the shared `PostizSocialAutoPublishJob` (a real, currently-running cron job) picks up due, approved variants.
**The honest gate:** All three platforms share one real Postiz job, but publishing needs `POSTIZ_PUBLIC_API_KEY` (currently unset) and a real connected OAuth account per platform (currently zero rows in `social_account` for any of these). The job correctly no-ops rather than fabricating a "published" status. Demo the draft → approve pipeline; do not claim a post went live.
**What unlocks it:** Deploy Postiz for real, connect each platform's OAuth, set the API key.

## 6. Social — Telegram, Discord, Mastodon, Bluesky (direct-API, no Postiz) — 🟡 REAL BUT GATED
**Screen:** `/admin/social` (platform credentials + the shared approval flow — verified live, `200`; there is no standalone `/admin/telegram` page, credentials for all 4 platforms live in one place).
**Demo script:** Show `FirstWaveDispatchJob` — real adapter code, verified end-to-end this session against a local mock webhook (genuine HTTP POST received, DB correctly transitioned to `published`). This is the most "real" of the gated social channels — the wiring gap that used to block it was found and fixed.
**The honest gate:** Zero `social_account` rows exist for any of these 4 platforms today, so nothing publishes until a real bot token (Telegram), webhook URL (Discord), app password (Bluesky), or instance token (Mastodon) is captured via the credentials UI.

## 7. SEO — 🟢 REAL (on-page) / 🟡 GATED (off-page)
**Screen:** `/admin/seo-checker`.
**Demo script:** Enter a real live path (e.g. `/booking`) → get a real score + checklist (title, meta description, H1, word count, image alt, canonical) computed from that page's actual live HTML — verified, not templated. This is genuinely real and safe to demo end-to-end.
**The honest gate:** No backlink or keyword-ranking data (would need a paid third-party API) — on-page only, by design. GEO/AEO (AI-answer-engine citation tracking for ChatGPT/Gemini/Perplexity) is blocked on external API credentials, not attempted yet.

## 8. Email Management — 🟡 REAL BUT GATED
Real schema/domain logic (Drip Campaigns sequencing, suppression/consent enforcement) but **no SMTP/Novu deployed** — every send is honestly recorded as `queued`, never fabricated as `sent`. Demo the sequence-builder and suppression-list enforcement; do not claim an email was delivered.

## 9. Content / Campaign Calendar — 🟡 REAL, actively being upgraded
**Screen:** `/admin/marketing-calendar`.
**Demo script:** Show real CRUD today (list, filter by status, create with title/content-type/channel/scheduled-time/campaign-link/assignee/tags). Being upgraded right now (see backlog) with a month/week grid view and drag-drop reschedule to match `/admin/social/calendar`'s pattern.

## 10. UTM / Campaign Tracking — 🟢 REAL
**Screen:** `/admin/utm-tracking`.
**Demo script:** Create a UTM link → get both the raw tagged URL and a `/utm/[id]` tracked short-link → visit the tracked link (public, unauthenticated) → watch `click_count` increment live and the browser redirect to the real destination. This is fully real, end-to-end, safe to click through live.
**Minor honest gap:** no click-fraud/bot filtering yet (on backlog); no edit-after-create (create/delete only, by design).

---

## Bottom line for the customer pitch
Lead the demo with what's unconditionally real and clickable: **UTM tracking, on-page SEO checker, video rendering pipeline, campaign/ad authoring, and the Telegram/Discord/Mastodon/Bluesky dispatch pipeline (once one real bot token is entered live in front of them — that's the single most convincing "we flipped a switch and it posted" moment available today).** Frame Facebook/LinkedIn/YouTube/Google Ads/paid media buys honestly as "the workflow and governance layer is built; the last-mile connection to your ad accounts happens when you give us the credentials" — never imply a post/spend already went live on a platform with zero connected accounts.
