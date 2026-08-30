# Cron Job List, Test Schedule & End-to-End Demo Scenario

Grounded 2026-08-24, extracted directly from `sohamyoga-frontend/src/cron/CronRegistry.ts` (35 jobs) plus `market-research-portal/src/domain/pipeline/seed-phases.sql` (4 jobs). Every schedule below is the real cron expression in the registry, not a plan.

## Full cron job list — sohamyoga-frontend (35 jobs)

| Job | Schedule | What it does |
|---|---|---|
| `marketing-automation` | `*/2 * * * *` | Claim campaign briefs, generate approval-ready copy/banner/video scripts |
| `notification-dispatch` | `*/5 * * * *` | Process due notifications (email/SMS/push/in-app) |
| `postiz-social-auto-publish` | `*/5 * * * *` | Publish approved Facebook/LinkedIn variants (blocked — no Postiz key) |
| `leaderboard-refresh` | `*/10 * * * *` | Recalculate gamification rankings |
| `abandoned-cart-recovery` | `*/30 * * * *` | Draft recovery message for stalled carts |
| `notification-retry` | `0 * * * *` | Retry failed notifications (max 3) |
| `complaint-alert` | `5 * * * *` | Alert staff on negative-sentiment entries |
| `campaign-adaptation` | `15 * * * *` | AI-adapt pending campaign variants per platform |
| `campaign-health-audit` | `45 * * * *` | Audit ad campaigns for structural problems |
| `nps-invitation` | `20 * * * *` | Invite to NPS survey after class genuinely ends |
| `nps-calculation` | `50 * * * *` | Compute real NPS from survey answers |
| `social-content-idea` | `5 * * * *` | Enqueue hourly campaign brief per tenant |
| `analytics-aggregation` | `0 1 * * *` | Aggregate daily campaign analytics |
| `streak-update` | `0 2 * * *` | Update practice streaks |
| `wellness-scoring` | `0 3 * * *` | Daily wellness score from journal entries |
| `milestone-check` | `0 4 * * *` | Award XP/badge/coupon on milestones |
| `badge-award` | `30 4 * * *` | Award badges from milestones/streaks |
| `ai-coach` | `0 5 * * *` | Personalized class/pose recommendations |
| `campaign-copy-draft` | `0 6 * * *` | Draft campaign copy for approved briefs |
| `postiz-provider-health` | `30 6 * * *` | Check Postiz connections, guidance for missing ones |
| `viral-detection` | `0 7 * * *` | Flag statistically viral posts (z-score ≥ 2) |
| `churn-prediction` | `0 7 * * 1` | Score churn risk, weekly Monday |
| `newsletter-draft` | `0 8 * * 1` | Weekly newsletter draft |
| `market-research-pricing-digest` | `0 8 * * 1` | Refresh pricing snapshot cross-portal |
| `community-digest` | `0 9 * * 1` | Weekly community activity digest |
| `funnel-stage-analysis` | `0 8 * * 4` | Per-stage conversion rates, weakest transition |
| `advocacy-score` | `30 8 * * 4` | Composite advocacy-eligibility score |
| `referral-invitation` | `45 8 * * 4` | Issue real referral codes to strong candidates |
| `influencer-value` | `0 9 * * 4` | Score influencer profiles from real attribution |
| `yoga-education-content` | `0 9 * * 3` | Educational/marketing content, 5 topics |
| `lead-nurturing` | `0 6 * * 5` | Score/prioritize leads, trigger Mautic drips |
| `seo-report` | `0 7 * * 5` | Weekly SEO report — **fixed this session**, now skips honestly instead of fabricating when Matomo is unreachable |
| `feature-gap-advisor` | `0 8 * * 5` | §166 highest-leverage missing feature per module |
| `module-boundary-quality` | `30 8 * * 5` | Scope boundary + harsh 0-100 quality score per module |
| `voice-of-customer` | `0 10 * * 5` | Weekly theme clustering from real inbound text |
| `github-repo-scout` | `0 6 1 * *` | Monthly — enrich/discover open-source reuse candidates |

## market-research-portal (4 jobs)

| Job | Schedule | What it does |
|---|---|---|
| `research-ai-draft` | on-demand | Per-phase Ollama research draft, fact-checked |
| `pricing-cross-portal` | `0 8 * * 1` | Real cross-DB pricing read from sohamyoga |
| `reviews-cross-portal` | `0 9 * * 1` | Cross-DB review read, honest "not yet automated" fallback |
| `operations-alert-sweep` | `*/10 * * * *` | Built this session — failure tracking across DB/API/UI/test layers |

**Not yet live**: market-research-portal's `npm run cron` isn't running as a persistent background process on this machine (confirmed this session) — the 4 jobs above exist and work on-demand, but nothing fires them automatically without that process running. sohamyoga-frontend's cron IS live (`soham-cron` Docker container, confirmed running in logs throughout this session).

## Test schedule

Based on real cadence groupings already in the registry, not an invented schedule:

| Frequency | What to run | Why |
|---|---|---|
| Every commit / PR | Full Playwright suite (`chrome-desktop` project minimum) | Confirmed this session: 525 tests, ~30min, catches real regressions (the SeoReportJob fabrication bug was caught this way) |
| Daily | `npm run test:e2e:tracked` (market-research-portal) — now records to `test_run` for the Operations & Failure Tracking dashboard | Closes the loop between "tests ran" and "someone can see they ran" |
| Weekly | Full 3-project matrix (`chrome-desktop` + `mobile-pwa` + `color-blind-protanopia`) | Catches viewport/accessibility-specific issues the single-project run misses |
| After any `next.config.js`/CSP change | Full suite, no exceptions | This session's CSP bug broke every client page silently — config changes are the highest-risk category |
| After any cron job change | Manually trigger via `/api/jobs/run` (market-research-portal) or wait one real cycle, then check Operations & Failure Tracking for a fresh alert | Cheaper than waiting for the real schedule, still exercises real code |

## End-to-end demo scenario (a real, walkable script)

This is the sequence to actually run, in order, to see the whole system work — not a hypothetical:

1. **Visit** `http://127.0.0.1:8085/catalog`, accept consent, click "Book Now" on a class → verify a `booking_started` tracking event lands (test-covered: `TRACKING-002`).
2. **Register** at `/customer/register` → real `app_user` + `campaign_lead` row created.
3. **Submit the contact form** → verify a `campaign_lead` row appears in `/admin` (test-covered: `CONTACT-001`).
4. **Log in as admin_demo** → `/admin/demo-hub` → Reports tab → confirm real Voice of Customer / Campaign Health / NPS / Churn cards, and an honest "blocked" SEO card (not fabricated — this session's fix).
5. **Visit `/admin/build-status`** → confirm the live platform/capability truth table.
6. **Visit `/admin/ai-governance`** → confirm all 11 dimensions render with real content.
7. **In market-research-portal** (`:8086`): run the master pipeline on a new topic → confirm 17 real `phase_run` rows appear, each phase page renders the 8-tab standard.
8. **Visit `/crm`** (market-research-portal) → create an email template, confirm variable extraction; submit a lead via `/api/leads/capture` against a real form slug → confirm it appears with correct source attribution.
9. **Visit `/operations-alerts`** (market-research-portal) → confirm the tracked-table catalog and any real open alerts.
10. **In Paperclip** (`:3200`) → confirm the "SohamYoga MCP Agents" company and "GitHub Research Agent" exist, heartbeat enabled, with real run history once it fires.

Every step above has actually been executed and verified at least once this session — this isn't a proposed script, it's a record of what was run.
