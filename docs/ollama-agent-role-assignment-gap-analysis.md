# Ollama Task List + Agent Role Assignment + Gap Analysis

Grounded 2026-08-24. Maps the 20 "Agentic AI Digital Marketing" roles (from
the reference catalog) against the real 35-job Ollama cron registry
(`sohamyoga-frontend/src/cron/CronRegistry.ts`) — no invented roles, no
claimed jobs that don't exist. Each row: real backing job (or "none"),
current status, whether it's registerable as a live Paperclip agent today
(per the `agent-webhook` pattern proven this session).

## Role → real job mapping

| Agent role | Real backing job(s) | Status | Paperclip-registerable today? |
|---|---|---|---|
| Campaign-planning agent | `campaign-adaptation`, `marketing-automation` | ✅ Real, scheduled | Yes — same http-adapter pattern, needs its own webhook action (not yet wired) |
| Market-research agent | `market-research-pricing-digest` (sohamyoga-frontend) + `ResearchAiDraftJob` (market-research-portal, 17-phase) | ✅ Real, both apps | Not yet — no webhook exists for either |
| Content agent | `campaign-copy-draft`, `newsletter-draft`, `social-content-idea`, `yoga-education-content` | ✅ Real, 4 jobs | No |
| SEO agent | `seo-report` | ✅ Real (fixed this session — no longer fabricates when Matomo is down) | No |
| Social-media agent | `postiz-social-auto-publish`, `postiz-provider-health`, `viral-detection` | 🟡 Real code, blocked on 0 connected accounts | No |
| Email agent | none — `newsletter-draft` drafts copy but there's no send/personalization job, and email templates only exist in market-research-portal as of this session | ❌ Gap | — |
| WhatsApp agent | none anywhere | ❌ Gap (confirmed on Build Status page) | — |
| Voice-sales agent | Voice AI schema real (market-research-portal), no job drives outbound calling autonomously | 🟡 Blocked on PSTN carrier | No |
| Lead-scoring agent | `lead-nurturing` (sohamyoga-frontend, mature); market-research-portal's new `lead` table has no scoring job yet | 🟡 Real in one app, gap in the other | No |
| Personalization agent | none — no job selects channel/offer/tone per customer | ❌ Gap | — |
| Booking agent | none — appointment booking is manual only | ❌ Gap | — |
| Analytics agent | `analytics-aggregation`, `funnel-stage-analysis` | ✅ Real | No |
| Budget-optimization agent | none — no job reallocates ad spend (no ad spend data exists yet either) | ❌ Gap | — |
| Compliance agent | `module-boundary-quality`, `feature-gap-advisor` (code-quality, not marketing-content compliance) | 🟡 Adjacent, not the same thing | No |
| QA agent | `campaign-health-audit` | ✅ Real, and this is the exact job the guided-simulation demo walkthrough already exercises live | **Yes — proven this session** via `github-mcp`/`search_repositories`; same pattern applies |
| Supervisor agent | none as a dedicated job — Paperclip itself is the real candidate for this role now that it's wired | 🟡 Infrastructure exists (Paperclip), no supervisor logic written yet | Paperclip *is* this role's home |
| Human-approval agent | `notification-dispatch` + every job's `requiresApproval`/`send_mode='draft'` convention | ✅ Real, structural | No |
| CRM agent | `lead-nurturing` (sohamyoga-frontend); market-research-portal's new lead table has no automation yet | 🟡 Partial | No |
| Competitor-intelligence agent | `github-repo-scout` (dev-tool competitor scouting only); market-research-portal's `competitor`/`competitor_feature` grid is manual CRUD, no scraping job | 🟡 Partial | No |
| Customer-feedback agent | `voice-of-customer`, `nps-calculation`, `complaint-alert` | ✅ Real, 3 jobs, well-covered | No |

## Honest tally

- **9 of 20 roles**: real, scheduled, working jobs exist
- **6 of 20 roles**: partial — real job exists in one app/dimension but not the full role
- **5 of 20 roles**: confirmed gap — Email personalization, WhatsApp, Personalization, Booking, Budget-optimization agents have zero backing code anywhere

## What "Paperclip-registerable today" actually means

Only `campaign-health-audit` (via `github-mcp`-style tier='auto' MCP tools) is proven end-to-end through Paperclip right now — that's 1 real precedent, not a general capability. Registering the other real jobs as Paperclip agents requires the same three things done for `github-mcp`, repeated per job:
1. A tier='auto' MCP tool wrapping the job (most of these 35 jobs aren't MCP tools yet — they're cron-only)
2. A webhook route with its own scoped auth
3. A Paperclip agent registration pointing at it

That's mechanical repetition of a proven pattern, not new architecture — but it's still one real integration per job, not a checkbox.

## Recommended build order (highest real-value gaps first)

1. **Email agent** — email templates now exist (this session); next is a real send job + personalization rules
2. **Lead-scoring agent for market-research-portal** — the `lead` table exists now; needs a scoring job mirroring `lead-nurturing`'s real logic
3. **Personalization agent** — smallest real scope: channel/tone selection per lead using data already captured
4. **Booking agent** — appointment scheduling, currently 100% manual
5. **WhatsApp agent** — needs Meta Business API access before any code is useful (external dependency first)
6. **Budget-optimization agent** — blocked until real ad spend data exists (no ad platform connected yet, per Build Status page)
