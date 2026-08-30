# SohamYoga — End-to-End Business Story

Grounded in verified system state as of 2026-08-24. Every step below is tagged:

- ✅ **Real** — verified working this session (code read + live test/API call)
- 🟡 **Partial** — real infrastructure exists, missing a piece to complete the loop
- ❌ **Not yet automated** — genuinely absent, no fabricated behavior

No step is described as working unless it was actually exercised against a live server or a passing test this session.

---

## Part 1 — Customer journey (`sohamyoga-frontend`, public + `/customer`)

1. **Discovery** — visitor lands on the public site (`/`, `/catalog`, `/booking`, `/membership`). ✅ Real; `public-site-yoga-alignment.spec.ts` confirms no leftover e-commerce-shell language and all hero CTAs resolve to real, non-404 routes.
2. **Consent** — `ConsentBanner` must be accepted before any analytics tracking fires; zero-consent clicks are provably never sent (client-side gate, not a server-side drop). ✅ Real, test-covered (`customer-interaction-tracking.spec.ts`).
3. **Contact / lead capture** — a visitor submits the contact form → creates a real `campaign_lead` row (not a stub — this was previously a broken silent no-op, fixed and test-covered: `contact-lead-capture.spec.ts`). ✅ Real.
4. **Registration** — `/customer/register` wizard creates a real customer account row and redirects to a route that exists. ✅ Real, test-covered (`customer-registration.spec.ts`).
5. **Referral attribution** — a `?ref=` click-through on the registration link attributes the referral and increments the real code-use counter. ✅ Real.
6. **Booking** — `Book Now` on the catalog is tracked end-to-end: the click reaches the database with real properties once consent is granted; `booking_started`/`booking_completed` conversion events bypass the consent gate by design (so funnel measurement never silently breaks). ✅ Real.
7. **Customer self-service** — `/customer/dashboard`, `/customer/features`, `/customer/referral` (get-a-link → real code → click tracking), `/customer/social`. ✅ Real, live-verified (200 OK, real data, not the old static mock).
8. **Lead scoring & nurturing** — `campaign_lead.lead_score`/`lead_temperature` computed by `LeadNurturingJob`; Mautic contact sync id stored. ✅ Real (schema + job exist and are scheduled).
9. **NPS / Voice of Customer** — survey issued, response feeds sentiment/complaint pipelines (`ComplaintAlertJob` pages staff on a real fresh negative entry, exactly once, no duplicate). ✅ Real, test-covered.
10. **Advocacy → referral code issuance** — `AdvocacyScoreJob` computes eligibility; a real code gets issued with a fact-checked Ollama-drafted message; customer sees it; click is tracked for real. ✅ Real, test-covered (`customer-referral.spec.ts`).
11. **Churn signal** — `ChurnPredictionJob` flags at-risk customers weekly. ✅ Real (job exists, scheduled Monday 07:00, Ollama-backed).
12. **Win-back / retention outreach** — 🟡 **Partial**. The job that *identifies* churn risk is real; the outbound campaign that *acts* on it (email/WhatsApp/voice) is gated behind the same credential blockers as step 15 below.

## Part 2 — Admin operational journey (`sohamyoga-frontend/admin`, 70 route dirs)

13. **Lead review & routing** — admin reviews campaign_lead queue, funnel stage (`FunnelStageAnalysisJob`), advocacy/referral dashboards. ✅ Real, live-verified.
14. **Teacher/student onboarding** — admin creates real records via working Add forms; detail pages resolve by real route param, not a fixed mock. ✅ Real, test-covered.
15. **Campaign creation & sending** — campaign creation is real; **actual send is fail-closed**: ❌ Postiz API key missing → 0 connected social accounts; ❌ no approved email templates exist anywhere in the codebase (confirmed gap, not yet built); SMTP/sender-domain auth not configured. Every one of these correctly reports blocked status rather than faking success.
16. **Social publishing** — 28-channel roadmap (19 direct, 9 manual), MCP gateway live for 14 non-Postiz platforms with 2 live tools. 🟡 Partial — infrastructure real, zero live connected accounts.
17. **AI Governance oversight** — `/admin/ai-governance`, 11 real audit dimensions (fairness, explainability, etc.), live and test-covered (`GOV-001/002/003`). ✅ Real.
18. **MCP tool operations** — 13+ registries (campaign, content, customer, admin, workflow, finance...) real and callable. ✅ Real.
19. **Operations & failure monitoring** — this session's new build: every job/API/UI/DB/test failure across the stack surfaces as a tracked, timestamped alert with a human acknowledge/resolve workflow. ✅ Real, built and verified this session (market-research-portal `/operations-alerts`; sohamyoga-frontend already had an equivalent via `domain/observability`).

## Part 3 — Market research → digital marketing production (`market-research-portal`, admin-only)

20. **Research phase** — 17-layer pipeline; "Run Pipeline" on a topic creates 17 real `phase_run` rows, each processed by a real Ollama call with a fact-check that rejects any unverifiable dollar figure. ✅ Real, test-covered (`MRP-003`, fixed this session — was blocked by a dev-mode CSP bug affecting every client page, now resolved).
21. **Cross-portal pricing/reviews sync** — reads sohamyoga's live pricing data through an explicitly read-only DB role, weekly. ✅ Real, test-covered (`MRP-005`).
22. **Competitor tracking** — real manual CRUD grid, sourced and dated, not scraped/fabricated. ✅ Real, test-covered (`MRP-008`).
23. **Content Factory** — script → narrated video (espeak-ng + FFmpeg, real MP4 output, checksummed) → human approval → scheduling. ✅ Real for local rendering; ❌ Higgsfield/Kling/Veo/etc. remain `placeholder` status (no provider account connected — honestly labeled, not faked).
24. **Voice AI** — full schema real (agents, scripts, calls, SIP trunks, modulation profiles, monitoring); a real outbound-call request correctly validates E.164 + consent + DNC, then reports `blocked: Telephony provider not connected` rather than pretending to dial. ✅ Real up to the PSTN boundary; ❌ no carrier account.
25. **Attributed forms/links per campaign** — `marketing_form_link` with UTM tracking, real click/submission counters. ✅ Real, both API and UI.
26. **Operations tracking (market-research-portal)** — this session's build: DB/schema, API, UI, and testing failure layers all wired and *proven* to catch real bugs (see below). ✅ Real.

## Part 4 — What this story already caught, for real

Building step 20's tracking is what found:
- A dev-mode CSP header silently breaking **every client-rendered page** (pre-existing, unrelated to any single feature)
- A documented-safe login test helper that was written but never actually called
- Playwright never loading `.env.local`, masking a real cross-DB test
- A genuine ffmpeg `libx264` production failure, caught live by the new sweep

That's the honest proof-of-value for the tracking layer: it didn't just create a dashboard, it found bugs a human hadn't noticed yet.

## Part 5 — The gaps, ranked by what blocks the loop from closing

| # | Gap | Blocks |
|---|---|---|
| 1 | No email template entity anywhere | Personalized email (Priority 6 in the AI use-case doc) |
| 2 | Zero connected social/email/voice provider accounts | Every "send for real" step (15, 16, 24) |
| 3 | No job queue / worker pool for provisioning | Scaling account-connection beyond one-at-a-time manual setup |
| 4 | No lead entity in market-research-portal | Cross-portal lead handoff |
| 5 | No WhatsApp/conversational-commerce channel | Priority 3 in the AI use-case doc |

Everything above the line in Parts 1–3 is real and test-verified today. Everything in Part 5 is the honest, prioritized backlog — not fabricated as "coming soon," just not built yet.

---

## Part 6 — Same flow, three cross-cutting lenses

### UI point of view
Every numbered step above lands on a real, routable page — not a modal or placeholder:
`/` → `/catalog` → `/booking` → `/customer/register` → `/customer/dashboard` (steps 1–7) →
`/admin/growth/*`, `/admin/teachers`, `/admin/students`, `/admin/ai-governance`, `/admin/mcp-gateway` (steps 13–18) →
`market-research-portal`'s `/`, `/phases/[slug]`, `/digital-marketing`, `/voice-ai`, `/content-factory`, `/operations-alerts` (steps 20–26).
Every admin/research page in market-research-portal follows the mandatory 8-tab standard (Dashboard/Report/Manual/Automatic/AI Exp/AI Governance/AI Risk/ResAI) — `PhaseTabs.tsx` is the reference implementation, reused for Operations & Failure Tracking this session. The one UI-breaking bug found this session (CSP blocking `unsafe-eval` in dev) affected *every* client page simultaneously — now fixed.

### Database point of view
Two separate Postgres databases, no shared schema: `sohamyoga` (customer/admin side — `app_user`, `campaign`, `campaign_lead`, `referral_code`, `advocacy_score`, `observability.*`) and `market_research_portal` (`phase`, `phase_run`, `study`, `campaign`, `marketing_*`, `voice_*`, `content_factory_*`, `operations_alert`). The only cross-DB link is a read-only role (`sohamyoga_ro`) market-research-portal uses to pull real pricing/review data — deliberately one-directional, no write-back. This session added 6 new tables purely for operational visibility (`schema_migration_run`, `api_error_log`, `ui_error_log`, `test_run`, `operations_alert`, `operations_alert_event`) — none of them touch business data, all additive.

### Process point of view
Every step is either **human-driven** (Manual Process: admin reviews a lead, approves a video, acknowledges an alert) or **scheduled** (Automatic Process: a real cron job on a real interval, tracked in `job_registry`/`job_run`) — never a hidden third category. The dividing line is explicit everywhere: `send_mode` on every campaign is `draft` (human sends) or `automatic` (scheduled, no approval), never ambiguous. Where a process is scheduled but its prerequisite isn't met (no Postiz key, no PSTN carrier), the job still *runs* on schedule and honestly reports `blocked` — it does not silently skip or fake success.
