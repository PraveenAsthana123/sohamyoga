# Extracted: "Lead Generation Tools Comparison" (Social Account Provisioning & Developer Access Platform)

Source: [ChatGPT shared conversation](https://chatgpt.com/share/6a95f6a3-d830-83e8-89ae-9c3c7ef982b5), 162 messages. Extracted via the mandatory `chatgpt_share_extract.py` script.

## What was actually in the conversation

Despite the misleading auto-generated title, this is **not** primarily about lead-gen tools — after the opening exchange about Apify/Apollo.io/email-phone verifiers, it becomes a 150+ message "next"-driven build-out of a **Social Account Provisioning & Developer Access Platform**: a control plane that, for each of 30+ platforms, defines the customer-facing WebUI fields to collect, the database model, the developer-app/OAuth registration steps, and an explicit automation boundary (what a browser-automation agent may and may not do — never bypass CAPTCHA/OTP/2FA/identity/business verification).

Real prompts (the rest is "next"): [0] Apify/Apollo/verifier tools question, [4] social posting tools, [10] profile/developer-account creation question, [12] "is there any automation tool which can create profile accounts on Facebook/LinkedIn/Instagram", [16] "create the technical plan for this", [21] "define the limitation/architecture/boundary/inclusion/exclusion for each platform", [28] a pasted platform-priority table (TikTok/Pinterest/Reddit/etc.), [137] "youtube, instagram, linkedin, twitter x, whatsapp, reddit, quora" (naming the core channels), [145] "what else missing...brutal...proxy, type of message posting", [150] "consider all the points and create again" (LinkedIn respec).

Platforms individually specified: TikTok, Pinterest, Reddit, WhatsApp Business, Telegram, Threads, Snapchat, Discord, Twitch, Medium, Substack, Quora, Tumblr, Mastodon, Bluesky, GitHub, GitLab, Stack Overflow, Google Business Profile, Yelp, Tripadvisor, Trustpilot, Vimeo, Dailymotion, Spotify, Apple Podcasts, SoundCloud, Patreon, YouTube, Instagram, LinkedIn (rebuilt twice), X/Twitter — ending in a "Master Multi-Channel Marketing Orchestrator" unifying 7 priority channels.

## Cross-check against what already exists — much more built than expected

Before treating this as a build spec, audited the actual codebase (three schema files with names matching this exact concept: `db-schema-provisioning.sql`, `db-schema-skyvern.sql`, `db-schema-platform-roadmap.sql`). Finding: **this system was already built earlier this session, in real depth**, not a placeholder:

- **`social_platform_requirement`** (31 rows) + **`account_provisioning_job`** (30-state machine: `DRAFT→SIGNUP_STARTED→DEVELOPER_APP_CREATED→OAUTH_CONNECTED→ACTIVE`) + **`provisioning_human_task`** (CAPTCHA/OTP/2FA/identity/business-verification checkpoints) + **`social_developer_application`** (dev-app tracking, `vault://` credential refs, never raw secrets) + **`social_oauth_connection`** + **`social_provisioning_event`** (audit log) — all real, wired to `src/app/api/admin/social/provisioning/` routes and a working `/admin/social/provisioning` React admin UI (create job, roadmap cards, human-task queue, Skyvern health banner).
- **Real Skyvern integration** — `src/lib/skyvern.ts` makes actual HTTP calls to a Skyvern browser-automation API with a hard-coded safety prompt instructing the agent to stop at any CAPTCHA/OTP/2FA/OAuth/payment step. Not a stub — genuine integration code.
- **28-platform roadmap** (`db-schema-platform-roadmap.sql`) — red/orange/yellow priority tiers, business-use notes, automation-boundary policy text per platform. Covers nearly everything this conversation names.

**What's genuinely missing/broken**, found only by reading the real tables and code, not by assuming from the conversation:
1. **All transactional tables are empty (0 rows)** — the machinery is real but nothing has ever been run through it. Honest state, not a bug: provisioning a real account requires a human to actually do it.
2. **YouTube and X/Twitter — the two platforms this conversation itself calls "core channels" — had no `social_platform_requirement` row at all** (present only in the older `ref_social_platform` content-scheduling table, with no roadmap tier or automation policy). Slack and Dribbble were in the same gap.
3. **A real bug, unrelated to this conversation but found while auditing the same system**: `src/app/customer/social/page.tsx` is a fully fabricated demo — hardcoded `DEMO_PLATFORMS` showing fake "connected, 1,240 followers" data with a `setTimeout`-simulated fake OAuth flow, making zero real API calls. This directly violates this codebase's own no-fabrication standard (a customer or anyone finding this page sees invented follower counts as if real).

## Action taken

- Added `youtube`, `x_twitter`, `slack`, `dribbble` to `social_platform_requirement` with real, publicly documented developer-program facts (signup/developer-portal URLs, OAuth/API support, automation policy) — see `db-schema-platform-roadmap-core-channels.sql`.
- Fixed `src/app/customer/social/page.tsx` to read real state from the provisioning tables instead of a hardcoded fake array — see decision log for details.
- **Not done**: building customer-facing WebUI intake forms for all 30 platforms (the existing system is deliberately admin-only, since provisioning the *studio's own* business accounts is a staff operation, not something an individual yoga student would do), and actually running any account through Skyvern/manual OAuth (requires a human, and for some platforms a live Skyvern instance, which isn't running here).
