# Extracted: Digital Marketing Research Papers + Real-Data Acquisition Tooling

Source: [ChatGPT shared conversation](https://chatgpt.com/share/6a950693-f674-83e8-9fbb-a400e2a1f59e), 173 messages. Extracted via the mandatory `chatgpt_share_extract.py` script.

## What was actually in the conversation

**~24 real prompts** among "next" auto-continuations — more distinct real prompts than the other conversations, spanning three sub-threads:

1. **Research papers** ([0],[4],[8],[18]): list state-of-the-art digital-marketing/AI-automation/market-research papers, 5-10 per topic, with real download links in a table. This is the direct source of this session's earlier "check the research paper on digital marketing ... download them" request.
2. **Real data sourcing** ([121],[127],[133],[137],[141],[145]): where to find Kaggle datasets, GitHub datasets, real-time customer feedback data, MCP-accessible/open data, old feedback data by service/topic — explicitly asked from a "service industry" angle with "yoga service, teacher" given as the worked example.
3. **Account/data-collection automation** ([149],[151],[155],[157],[163],[165],[167],[169],[171]): use screen-recording + browser automation (names Skyvern, Playwright, Selenium, n8n, Stagehand, computer-use-agent) to create real accounts and extract data; a common B2C/B2B intake form (with a B2C→B2B transition path) for "profile, developer account, database, minimum/mandatory input"; and social posting across LinkedIn/Instagram/Facebook/Twitter/YouTube.

## Cross-check against what already exists

- `data/kaggle/README.md` (written earlier this session) already covers real Kaggle dataset acquisition for digital-marketing scenarios — directly responsive to sub-thread 2.
- Playwright is already the test framework in both apps (per `feature_testing_standard` memory) — one of the automation tools named in sub-thread 3 is already in active use, just not yet pointed at real account-creation/data-extraction workflows.
- Social posting automation is confirmed **not built**: `sohamyoga-frontend`'s Build Status dashboard reports 0 of 20 configured platforms with a live connected account (no Postiz client exists) — same blocker as every other social-posting theme found across these conversations.
- No MCP-accessible open dataset connector, no Skyvern/Stagehand/computer-use integration, and no B2C/B2B intake form exist yet anywhere in the repo.

## Verdict: two genuinely new, buildable items; one already-blocked repeat

- **Research paper list with real links** — buildable now (a curated, honestly-sourced reading list, not fabricated papers) but not yet done as a deliverable.
- **B2C/B2B common intake form with a transition path** — genuinely new, buildable now with existing Postgres/Next.js stack, no missing credential.
- Social posting automation and live account-creation-via-browser-automation both restate the same platform-credential blocker already documented elsewhere (Build Status dashboard, hooks/digital-marketing extraction docs) — not a new gap, just a repeat.
