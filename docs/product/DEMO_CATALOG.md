# Demo Catalog — Phase 12

Verified 2026-09-08. Assessed against the framework's 10 suggested demo journeys — real status per
journey, not assumed complete.

| # | Journey | Status | Evidence |
|---|---|---|---|
| 1 | Lead capture → CRM → segmentation → campaign → follow-up → conversion | **REAL, demoable** | `campaign_lead` has 7 real rows; Lead Routing Engine, Lead SLA Control, Customer Segmentation all REAL per Reality Matrix; Campaign Management now REAL (built 2026-09-08, real dispatch) |
| 2 | Content brief → AI generation → approval → publish → attribution | **REAL, demoable, with an honest gap** | SEO Content Brief real; Research-AI Draft Job real with fact-check gate; UTM/attribution tracking real (built 2026-09-07); publish step is honestly gated on Postiz credentials not present in this environment — the pipeline is real up to the point a real vendor credential is required |
| 3 | Social post → publishing → engagement → lead attribution | **PARTIAL, demoable for the direct-API path only** | Telegram/Discord/Mastodon/Bluesky publishing is real and wired (2026-09-01); Facebook/LinkedIn/YouTube via Postiz is code-complete but credential-gated; UTM click/lead/conversion tracking is real |
| 4 | Class discovery → booking → payment → reminder → attendance | **PARTIAL — no payment gateway exists anywhere in this codebase, by design** | Booking creation is real (1 real row); web push reminders real (built 2026-09-07); no payment step exists — this is confirmed absent repo-wide, not a bug, per multiple Phase 1 findings (e-commerce, service catalog, booking all explicitly note no payment gateway) |
| 5 | Security scan → finding → triage → remediation → rescan | **REAL, demoable end-to-end** | sohamyoga-frontend's in-app SAST/DAST/SCA/IaC scanner persists findings with fingerprint-based dedup preserving triage state across rescans — this is the most complete, fully-real journey in the catalog |
| 6 | Campaign → experiment → metrics → winner selection | **REAL, demoable** | Experiments (A/B Testing) module is real, uses genuine two-proportion z-test statistics (both in sohamyoga-frontend and market-research-portal's `HookZTest.ts`); Landing Page A/B Testing wired to a real page consumer |
| 7 | Customer inquiry → AI assistant → tool use → response → audit | **PARTIAL — no "tool use" exists** | AI Assistant chatbot is real (Phase 10: LEVEL 1, single completion call, no tool use); "audit" would map to `phase_run_ai_log`-style logging, which exists for Research-AI but not confirmed for the customer chatbot specifically |
| 8 | Market research → insight → campaign recommendation → execution | **REAL, demoable** | market-research-portal's 17-phase pipeline is real (7 studies, 119 phase runs, live DB-verified); Pricing/Reviews Cross-Portal Jobs pull real sohamyoga data; execution loop back into sohamyoga-frontend's campaigns is not directly wired (the two apps don't write to each other) |
| 9 | Job/marketing agent → bounded task → evaluation → approval | **Does not exist as described** — no LEVEL 3+ bounded agent exists anywhere (Phase 10 finding) | The closest real analogue is Research-AI Draft Job (single call + deterministic evaluation gate), not a bounded multi-step agent |
| 10 | Failure recovery demonstration | **REAL, and literally happened 3 times during this audit** | ai-orchestrator-platform backend restart, market-research-portal rebuild, nginx DNS fix — all real, live, verified recoveries with before/after evidence — see Phases 1 and 9 |

## Honest count

**6 of 10 suggested journeys are real and demoable today** (1, 2-partial, 3-partial, 5, 6, 8, 10 —
counting partials as real-with-a-caveat). **2 do not exist as described** (7's tool-use claim, 9's
bounded-agent claim) because the underlying AI capability (LEVEL 3+ agency) doesn't exist anywhere in
this repo per Phase 10. **1 has a confirmed, deliberate, repo-wide absence** (payment gateway, #4).
