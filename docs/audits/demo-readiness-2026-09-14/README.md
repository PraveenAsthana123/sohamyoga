# End-to-end demo readiness audit and implementation plan

Audit date: 2026-09-14. Snapshot generated: 2026-09-14T14:45:12.387052+00:00. Scope: local code, live registry, retained test evidence, selected read-only runtime checks. No external messages, ads, calls or money transfers were made.

## Executive finding

**The complete platform is not ready for an unrestricted end-to-end customer demonstration.** A substantial implementation exists, but registry labels overstate the evidence available for complete business journeys. This report does not turn a source file, a successful page load, a unit test or a queued job into a claim of customer completion.

| Measure | Observed | Meaning |
|---|---:|---|
| Registered modules | 206 | 188 main portal, 8 market research, 10 voice |
| Registry module claims | 191 real / 13 partial / 2 not built | Claims, not demo certifications |
| Registered use cases | 940 | 689 real / 43 partial / 179 not built / 1 blocked / 28 N/A |
| Explicitly incomplete use cases | 223 | Full detailed list supplied |
| Latest historical browser run | 672 | 486 passed, 74 failed, 13 timed out, 99 skipped |
| Open recorded browser defects | 87 | Needs triage and rerun |
| Defined orchestration suites/cases | 4 / 18 | Zero execution jobs and zero case results |
| Page/API source inventory | 265 / 489 | Includes public/admin/customer/teacher across three apps |
| Browser artifact references | 355 | 338 present; 17 missing references at audit time |

Latest stored browser run began 2026-09-14 09:00 UTC at recorded commit `6951da6`. It predates this session's affiliate deployment and must not be represented as a test of the newly deployed image. Repeated browser projects inflate case counts; these are test instances, not unique business journeys.

## Immediate blockers and concrete evidence

1. **Demo customer identity is not a usable business fixture.** Live login succeeds on ports3110 and8085. Orders/cart/referral then return404 with “No customer record found for this account.” This is a missing linked record for the demo identity, not a claim that every customer is broken. Do not diagnose its cause from the status alone. Evidence: `live-probes.json`; customer route sources.
2. **Registration verification is cosmetic.** `sohamyoga-frontend/src/app/customer/register/page.tsx:107` waits500ms and sets `otpSent`; proceeding only checks that OTP text is present. Registration submission sends name/email/password, not a verified OTP proof. The same submit path awaits `complete-registration` without checking its HTTP success before redirecting. Fix real verification and transactional/recoverable identity-to-customer provisioning.
3. **Customer self-service coverage cannot be called passed.** `customer-self-service.spec.ts` has3 failed and99 skipped instances in the latest historical run. The shared demo identity/fixture and beforeAll chain need diagnosis before scenario-level claims.
4. **Named test plans do not execute themselves.** Four suites declare customer, marketing, voice and1000-customer capacity coverage. Their18 cases have no execution/result rows. Wire real runners and demonstrate execution, or explicitly label them planned.
5. **External completion remains separate.** Postiz is running; LinkedIn client ID/secret are absent from that container. Instagram has one connected DB row but token validity and publishing were not tested. Backend SMTP host is configured, contradicting old “no SMTP configured” notes, but no delivery was exercised.
6. **Evidence retention is incomplete.**17 referenced browser attachments are missing. Preserve immutable per-run manifests, hashes and paths; do not overwrite the only JSON report with the next run.
7. **Catalog coverage is incomplete.** AI Orchestrator has no module_registry rows, despite Media Studio, Operations Center and local coding work. New affiliate earnings/payout functionality needs registry and end-to-end demo coverage beyond older tracking-link rows.

## What can be called completed today

Use the narrower labels below. No module receives blanket fresh end-to-end certification in this audit.

- **Implemented and tested locally:** affiliate attribution/earnings/refund/manual receipt flow;232 referral/API tests and PostgreSQL temporary-table business scenarios. Production image built and deployed; home/affiliate page200 and unauthenticated affiliate API401. An authenticated live monetary demo was not run; no policy or payout was created.
- **Previously verified local artifacts:** Aider/Ollama isolated file edit, synthetic local transcription and portrait text-card rendering. These are local capabilities, not proof of external publishing or full educational-video editing.
- **Fresh tool verification:** Playwright1.62.1 and Chromium151 launch and interaction on `/mnt/deepa` passed.
- **Registry-declared implementation:**689 use cases are listed in `DECLARED_IMPLEMENTED_USE_CASES.csv`. This file deliberately does not call them demo complete.

## Module-by-module demo classification

Every module is in `MODULE_DEMO_MATRIX.csv`, including business purpose, customer/admin flow, inputs/process/outputs, manual/pipeline/agentic evidence requirements, latest mapped tests, missing documentation and acceptance requirements.

| Evidence tier | Modules |
|---|---:|
| NO_MAPPED_BROWSER_EVIDENCE | 165 |
| PARTIAL_OR_GATED | 13 |
| MAPPED_TEST_FAILURES | 17 |
| HISTORICAL_TEST_PASS_DEMO_UNVERIFIED | 9 |
| NOT_BUILT | 2 |

**Nine modules with all mapped historical tests passing** (still require a fresh business demo and downstream receipt where applicable):

- sohamyoga-frontend: Campaign Management (`campaign-management`), 21 mapped pass instances.
- sohamyoga-frontend: Marketing / Content Calendar (`content-calendar`), 9 mapped pass instances.
- sohamyoga-frontend: Negative Virality / Crisis Screen (`crisis-detection`), 15 mapped pass instances.
- sohamyoga-frontend: Customer / Business Onboarding Wizard (`customer-business-onboarding`), 9 mapped pass instances.
- sohamyoga-frontend: Marketing Unsubscribe / Suppression / Consent Audit (`marketing-consent-suppression`), 39 mapped pass instances.
- sohamyoga-frontend: Post Management (`post-management`), 21 mapped pass instances.
- sohamyoga-frontend: Referral & Loyalty Management (`referral-loyalty`), 51 mapped pass instances.
- sohamyoga-frontend: Viral Lead Detection (`viral-lead-detection`), 15 mapped pass instances.
- sohamyoga-frontend: Voice of Customer — Weekly Digest & Export (`voice-of-customer`), 54 mapped pass instances.

**Modules with mapped failures:**

- Class Booking (`booking`): 3 failures/timeouts, 99 skipped.
- Customer Self-Service — Invoices & Billing (`customer-billing-invoices`): 3 failures/timeouts, 99 skipped.
- Customer Self-Service — Structured Goals (`customer-goals`): 3 failures/timeouts, 99 skipped.
- Customer Self-Service — My Journey (Streak/Points/Badges/Challenges) (`customer-journey-gamification`): 3 failures/timeouts, 99 skipped.
- Customer/Lead Segmentation (`customer-segmentation`): 6 failures/timeouts, 0 skipped.
- Customer Self-Service — Manage Subscription (`customer-subscription-self-service`): 3 failures/timeouts, 99 skipped.
- Customer Self-Service — Support Tickets (`customer-support-tickets`): 3 failures/timeouts, 99 skipped.
- Customer Self-Service — Practice Journal & Wellness Score (`customer-wellness-journal`): 3 failures/timeouts, 99 skipped.
- Feedback Health Score (`feedback-health-score`): 3 failures/timeouts, 0 skipped.
- Feedback Lifecycle (`feedback-lifecycle`): 3 failures/timeouts, 0 skipped.
- Heatmaps / Session Recording (CRO) (`heatmap-session-replay`): 1 failures/timeouts, 0 skipped.
- Influencer/Creator Management (`influencer-management`): 4 failures/timeouts, 0 skipped.
- Lead Detection Flow (`lead-detection-flow`): 6 failures/timeouts, 0 skipped.
- Core cards (`market-research-core-cards`): 4 failures/timeouts, 0 skipped.
- Screen 01 — Executive Research Command Center (`market-research-screen-01`): 4 failures/timeouts, 0 skipped.
- Screen 04 — Methodology Designer (`methodology-designer`): 4 failures/timeouts, 0 skipped.
- UTM / Campaign Parameter Tracking (`utm-tracking`): 1 failures/timeouts, 0 skipped.

**Explicit partial/not-built module inventory:**

| Module | Claim | Gap from registry; revalidate before action |
|---|---|---|
| Voice AI (inbound/outbound calling) | partial | No real PSTN telephony provider connected (schema/API/UI all real, calls stay honestly blocked); multi-language script support not built; LLM-drafted scripts (script_generate job type) unimplemented. |
| Drip Campaigns | partial | Real sequencing logic; actual email delivery is honestly not possible (no SMTP/Novu deployed) -- every step is recorded queued, never fabricated as sent. |
| Email Management | partial | Corrected 2026-09-08: the "Test SMTP button calls a route that does not exist" claim was stale. Discovered live: NEXT_PUBLIC_API_URL (http://127.0.0.1:15070) points at the separate SohamYoga.Web .NET backend, which was not running for this entire session (the same root cause behind every "Authentication service is unavailable" 503 on every sohamyoga-frontend admin route all session). Started it for real (dotnet build succeeded 0 errors/0 warnings… (full text in module CSV) |
| Facebook Management (organic posting) | partial | Same Postiz credential/deployment gap as YouTube. |
| Direct-API Social Dispatch (Telegram/Discord/Mastodon/Bluesky) | partial | The adapter code (first-wave-adapters.ts) existed correctly since earlier this session but had ZERO production call site (only referenced in its own test) until this fix -- found live during the 2026-09-01 business-side audit. Verified end-to-end with a real local mock webhook server (genuine HTTP POST received, DB correctly transitioned to published) and a real honest-block case (missing telegram bot_token/chat_id correctly rejected, no fabricat… (full text in module CSV) |
| GEO/AEO Management (AI-search visibility) | partial | AI-answer-engine (ChatGPT/Gemini/Perplexity) citation tracking -- blocked on external API credentials, not attempted. |
| Google Ads (platform-specific) | not_built | Zero Google Ads API client code anywhere (grep-confirmed: googleads/google-ads-api/GoogleAdsApi = 0 hits). Only artifacts: a lead-source enum value and a disabled feature flag whose own description says "Requires Google Ads developer token." No admin page or route specific to Google Ads. |
| LinkedIn Management (posting/automation) | partial | Only works if/when Postiz itself is deployed and holds a LinkedIn OAuth token — this app has no fallback direct integration. |
| MCP Gateway (Dashboard/Integrations/Bot Console/Reports) | partial | Updated 2026-09-08: now 3 of 29 registered servers' tools have real working implementations (github.search_repositories, stackoverflow.search_questions, and newly gitlab.search_projects). Found and fixed one real inaccuracy while auditing all 29 for any other wrongly-marked-as-credential-gated public reads: GitLab's search_projects tool was documented as "Needs GITLAB_TOKEN" but GitLab's public project-search API (GET /api/v4/projects?search=) ge… (full text in module CSV) |
| Paid Ads Management | partial | Campaign creation now real; launching a campaign to a real ad platform (Meta/Google/TikTok) is still not possible -- zero ad-platform API clients exist anywhere, confirmed by grep.  UPDATE 2026-09-01: Prompt-based dynamic ad creative built -- src/domain/ads/AdCreativeGenerator.ts, real Ollama generation targeting business type + age group, wired into the previously-aspirational "Ad Copy Generation" AI Engine tile (was 0 ads generated for its whol… (full text in module CSV) |
| QR Kiosk Login | partial | The displayed QR is a placeholder canvas grid, not a real scannable QR-encoded image (code comment: TODO replace with qrcode.js or qr-code-styling for production). Approval does not actually hand off a session to the kiosk browser -- no server-to-server session-issuance capability exists on the external identity backend, so the user must still sign in manually after approving. Downgraded from real to partial to reflect this. |
| Social Media Management | partial | Real publishing now covers Facebook/LinkedIn/YouTube (Postiz) AND, as of 2026-09-01, Telegram/Discord/Mastodon/Bluesky via a newly-wired FirstWaveDispatchJob (the adapter code was real and tested but had zero production call site before this fix -- confirmed live end-to-end with a real local webhook receiver: job POSTed a real HTTP request, DB correctly transitioned to published). Both paths are honestly gated: zero real accounts are connected to… (full text in module CSV) |
| Telegram Management | partial | Corrected 2026-09-08 -- this note was stale. "Nothing in the app actually calls it" was true when first written but was fixed by the SAME 2026-09-01 change already documented on the separate first-wave-social-dispatch registry row: FirstWaveDispatchJob.ts (FIRST_WAVE_PLATFORMS includes 'telegram') now calls the real Telegram bot adapter, verified end-to-end with a real local mock webhook server (genuine HTTP POST received, DB correctly transition… (full text in module CSV) |
| YouTube Management (organic posting) | partial | Real code, gated on POSTIZ_PUBLIC_API_KEY (unset) and a deployed Postiz instance (not present in this repo) — currently non-functional for lack of infrastructure, not mocked. |
| Calendar Integration (Cal.com) | not_built | Needs a real CALCOM_API_KEY and CALCOM_EVENT_TYPE_ID before any of availability/booking/reschedule/cancel can go live. |

## Business use cases still incomplete by domain

Full rows, evidence and next steps are in `MISSING_OR_PARTIAL_USE_CASES.csv`. Counts below are registry counts, including overlapping planning concepts; do not sum them into independent delivered features.

| Domain | Partial/not-built/blocked |
|---|---:|
| PAYMENT MANAGEMENT | 16 |
| Voice AI — Inbound & Outbound Control Tower | 14 |
| AI Governance Control Towers | 10 |
| Customer Self-Service Portal — Pricing | 10 |
| SOCIAL MEDIA & COMMUNITY MANAGEMENT | 10 |
| Customer Self-Service — Educational Video Studio | 9 |
| Customer Acquisition Management — Customer Self-Service + Admin Portal | 8 |
| BOOKING & APPOINTMENT MANAGEMENT | 7 |
| Customer Self-Service — Ads & Banner Management | 7 |
| Module 12 — Survey / Poll / Form Management | 7 |
| Module 16 — Referral / Affiliate Management | 7 |
| BILLING, INVOICE & SUBSCRIPTION MANAGEMENT | 6 |
| Module 17 — Pricing / Promotion Management | 6 |
| Module 21 — Analytics / Attribution / ROI / Value Realization Management | 6 |
| PRODUCT & SERVICE MANAGEMENT | 6 |
| Admin Portal | 5 |
| Module 10 — Video / Reel Management | 5 |
| Module 13 — Customer Behavior Tracking | 5 |
| WEBSITE & LANDING PAGE MANAGEMENT | 5 |
| CONTENT MANAGEMENT & AI CONTENT FACTORY | 4 |
| Module 15 — Loyalty Management | 4 |
| Branding Management — Customer Self-Service + Admin Portal | 3 |
| Customer Engagement & Data Collection Modules | 3 |
| Influencer Management Module — Customer Self-Service + Admin Portal | 3 |
| Module 11 — Review / Reputation Management | 3 |
| Module 14 — Customer Engagement Management | 3 |
| Review & Reputation Management Modules | 3 |
| SEO + LOCAL SEO + AI SEARCH / GEO MANAGEMENT | 3 |
| Viral Management Module — Customer Self-Service + Admin Portal | 3 |
| Booking & Appointment | 2 |
| Branding Control Tower | 2 |
| Customer Behavior Tracking — Modules | 2 |
| How I would separate the terms you listed | 2 |
| Module 2 — Lead Management | 2 |
| Payment | 2 |
| Review Management + Google Business Profile Review Control Tower | 2 |
| Video Course Control Tower | 2 |
| Billing & Subscription | 1 |
| Brand Management — Customer Self-Service + Admin Portal | 1 |
| Branding Management Module | 1 |
| CUSTOMER ONBOARDING & BUSINESS ONBOARDING MANAGEMENT | 1 |
| Campaigns | 1 |
| Customer Self-Service Portal | 1 |
| Customer Self-Service Portal modules | 1 |
| Customer Self-Service Portal — Market Intelligence | 1 |
| Customer Self-Service — Campaign features | 1 |
| Customer Self-Service — Price Management | 1 |
| Education | 1 |
| Engagement | 1 |
| Integration | 1 |
| LEAD MANAGEMENT | 1 |
| Lead Management | 1 |
| Market Intelligence | 1 |
| Module 19 — Communication / Notification / Alert / Messaging Management | 1 |
| Module 6 — Influencer Management | 1 |
| Order Management | 1 |
| Post Management — End-to-End Module | 1 |
| Pricing | 1 |
| Product & Service | 1 |
| Reviews | 1 |
| Social Media & Community | 1 |
| Video / Reel / Multi-Platform Publishing Modules | 1 |
| Video/Reel | 1 |

## Customer versus administrator operating plan

Customer priorities: reliable identity/customer linkage; verification and recovery; usable profile; book/waitlist/reschedule/cancel; membership changes; checkout/payment/invoice/refund; referrals/rewards; support; privacy/export/deletion; accessible learning and progress. A customer page existing does not demonstrate the corresponding permitted API operation.

Administrator priorities: isolate tenants/roles; seed usable demonstrations; configure catalog/capacity/pricing; reconcile confirmed payments and commissions; triage support and CRM; approve versioned content; schedule and observe delivery; recover failed jobs; inspect audit logs; export accurate reports. Distinguish recording a receipt from making a transfer.

`UI_OPERATION_INVENTORY.csv` lists every discovered page file, scope, literal API references and statically extracted button labels. `API_OPERATION_INVENTORY.csv` lists declared HTTP methods. This is a source inventory: imported/dynamic controls require browser inspection, and operation-level success must be asserted against resulting state.

## Manual, pipeline and agentic operation requirements

| Mode | Demonstration must show | Failure/recovery must show | Evidence |
|---|---|---|
| Manual | Named role performs action, reviews result, handles exception | Invalid input, denied role, interrupted form, duplicate submit | UI trace, request ID, before/after business record, receipt |
| Pipeline | Trigger produces durable job and dependent steps | Restart, timeout, retries, dead letter, duplicate event | Job ID, stage history, state assertions, alert and replay outcome |
| Agentic | Goal → grounded plan → permitted tool → approval where needed → verified result | Tool denial, malformed output, prompt injection, quota/outage, budget stop | Model/provider, tool args redacted, approval/version, tool outcome, final business assertion |

Agents must not claim a send/payout/call from a drafted request or mock success. If no planner/tool/trace implementation is found, mark the agentic variant not implemented or unverified. Forty-two scenario stories spell out both human operations and the requirements for automation.

## Detailed test and demo pack

- `BUSINESS_DEMO_STORIES.md` and CSV:42 day-life stories, each with input, process, output, fixture, known gap and demo steps.
- `PROPOSED_TEST_CASES.csv`:210 planned cases. **Every result is NOT_RUN/PLANNED**, not fabricated evidence.
- `TEST_DATA_PLAN.json`: isolated fixtures and reset requirements. No production seed is performed by this audit.
- `BROWSER_TEST_RESULTS.csv`:672 actual historical test instances.
- `browser_runs.json`, `browser_defects.json`, `browser_mapping.json`: recorded run and module correlation.
- `artifact-inventory.json`: existing/missing raw log/trace/image/video references; raw artifacts may contain private data and should not be published unredacted.
- `affiliate-unit-results.json` and `affiliate-unit.log`: fresh focused test results and log captured for the new affiliate flow.

Each execution must record: run_id, deployed image/build SHA, environment/base URL, browser/project, scenario/case ID, fixture version/IDs, role, expected/actual result, API/job correlation, database assertions, provider receipt when applicable, trace/screenshot checksum, cleanup outcome, timestamps and defect link. Do not store credentials or session cookies.

## Implementation sequence and exit gates

| Priority | Work package | Owner role | Exit evidence |
|---|---|---|
| P0 | Isolated demo tenant and identity/customer/student links; real registration verification; handle provisioning failure | Identity + application engineer | New and existing-user signup/login/profile/order journeys; invalid/replayed OTP rejected; cleanup preserves demo baseline |
| P0 | Triage87 historical browser failures and99 skips; recover17 missing artifact references or document loss | QA + platform engineer | Fresh full run on deployed build with no unexplained failures/skips; immutable report manifest |
| P0 | Execute the4 declared suites/18 cases with real runners or mark planned; isolate test side effects | QA automation | Actual job/result rows, fixture IDs, logs, cleanup, scheduled run evidence |
| P1 | Customer booking/membership/order/invoice/refund/support/loyalty journeys | Product + commerce engineer | Customer and admin observe same durable state; race/retry/authorization tests pass |
| P1 | Affiliate policy configuration and authenticated end-to-end demo; payment-provider sandbox integration | Finance operations + commerce engineer | Confirmed payment, commission/reversal and payout receipt reconcile; provider transfers separately authorized |
| P1 | SMTP, social OAuth, webhook and external receipt verification per provider | Integration engineer + account owner | Sandbox send/publish and receipt, revoked token/retry tested, no false delivered status |
| P2 | Editorial review, advanced reel/timeline/editor workflows and educational self-service | Media + frontend engineer | Source-to-reviewed playable artifact with provenance; export/handoff limitations explicit |
| P2 | Cross-module agentic workflows and quota/outage fallbacks | AI/platform engineer | Bounded tool execution, approval and fault recovery with full trace |
| P2 | Refresh206 module claims, catalog AI Orchestrator and map940 use cases to scenario evidence | Product owner + QA | Every claimed-ready operation links to current scenario/test/log/fixture/output |
| P3 | Accessibility, mobile, concurrency/load, backup/restore and disaster recovery | QA + operations | Measured targets agreed first; repeatable load and restore report, not an unexecuted suite name |

No duration estimate is presented as a commitment: API access, business commission policy and team capacity are not established. Sequence is dependency-based.

## Demo release rule

A use case is demo-ready only when its named role can complete the exact business scenario on the deployed build, observe its durable output in the corresponding admin/customer view, demonstrate relevant negative and recovery paths, and retrieve reproducible evidence plus a resettable fixture. For integrations, the intended external receiver must confirm the result. A manual handoff may be demo-ready only when clearly presented as manual.

## Audit limits

This is an exhaustive registry/source inventory plus targeted deep tracing and live read checks, not execution of all940 use cases or all489 routes. No broad production-mutating browser suite was rerun, because current suites share demo identities and clean associated records. Registry notes and old demo guides are historical assertions; live contradictory evidence is highlighted rather than silently overwritten. UI flags are incomplete metadata, not reliable absence/presence proof.

Raw exported registry data is local project material. Review/redact evidence attachments before any customer distribution.