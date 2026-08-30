# Voice Agent Platform — Architecture Research Summary

**Source:** ChatGPT conversation "Voice Agent Profile Summary" (162 messages)
`https://chatgpt.com/share/6a8e1e6f-9c14-83e8-b329-55136c46a757`
**Extracted:** 2026-08-26
**Scope note:** This is unrelated to sohamyoga-frontend or the epilepsy-portal research. It appears
to be the user's own research into a healthcare AI voice-agent role/business (dental, chiropractic,
physiotherapy, ENT, massage-therapy clinics), likely tied to the "30DX" brand family (CX-Assist,
Pay-Assist, Care-Assist) and platforms Retell AI / Vapi / Bolna.ai referenced in the seed profile.
Saved here as reference only — no build work has been done against this spec.

---

## 1. Starting point

The conversation opened from a professional profile describing work building 200+ production voice
agents across 30DX healthcare-clinic brands (dental, chiropractic, physiotherapy, ENT, massage
therapy) — inbound/outbound calls, appointment booking, patient inquiries, demo building, API/backend
integration, and post-deployment support tracked in ClickUp.

## 2. Voice-platform comparison

The chat evaluated four platforms in depth — **Sarvam AI, Bolna, LiveKit, Ultravox** — then widened
to the full competitive set: **Retell AI, Vapi, Bland AI** (agent platforms), **LiveKit, Pipecat,
Agora** (realtime infra), **Ultravox, OpenAI Realtime** (speech-native models).

**Ranking for healthcare production use (quality + trust + low operational headache):**

| Rank | Platform | Quality | Trust/Enterprise | Headache | Best fit |
|---|---|---|---|---|---|
| 1 | **LiveKit Cloud** | ★★★★★ | ★★★★★ (SOC 2 Type II, GDPR) | Medium | Best serious production choice, scales to hundreds of agents |
| 2 | **Ultravox** | ★★★★★ | ★★★★ | Low–Med | Best voice-first/low-latency experience |
| 3 | **Bolna** | ★★★★ | ★★★½ | Low | Fastest/easiest deployment |
| 4 | **Sarvam AI** | ★★★★½ (India) | ★★★★ | Low | Best for Indian-language/multilingual work |

**Known challenges by platform:**
- **Sarvam** — multilingual variability, medical-terminology mistranscription, Hindi/regional
  transliteration, proper-noun (patient/provider name) accuracy, numeric field accuracy (phone/DOB/
  insurance), noisy-audio robustness, mid-call language switching, single-vendor dependency risk.
- **Bolna** — multi-component orchestration (STT+LLM+TTS+telephony+tools can each fail
  independently), cumulative per-component latency.
- **LiveKit / Ultravox** — no specific weaknesses were logged before the conversation moved on
  (chat was cut off mid-comparison at message 7).

**Cost estimate for 10 hrs / 600 connected minutes (full stack: telephony + STT + LLM + TTS +
observability, planning estimates not quotes):**

| Stack | Estimated 10-hr / 600-min total | Headache |
|---|---|---|
| Bolna | ~$36–62 | Low |
| Vapi | ~$36–77 | Low |
| LiveKit (optimized) | ~$31–56 | Medium |
| LiveKit (premium) | ~$51–111 | Medium |
| Ultravox stack | ~$36–82 | Low/Medium |
| Sarvam | ~$25–60+ | Low |
| Retell (optimized) | ~$59–94 | Very low |

LiveKit's own calculator example: Agent $0.0100 + Telephony $0.0100 + LLM $0.0014 + STT $0.0058 +
TTS $0.0300 + Observability $0.0100 = **$0.0672/min** (~$40 for 600 min).

## 3. Master feature map (early scoping pass)

Before the phase-by-phase build-out, the chat listed a broad feature map spanning: inbound/outbound
calling, natural multi-turn conversation, STT/TTS, realtime full-duplex streaming, barge-in, silence
handling, VAD, multilingual/accent support, and more — used as the seed for the 60-phase architecture
below.

## 4. Outbound platform architecture — Phase 0 through Phase 41

Framed as one **enterprise Customer Acquisition + Outbound Voice AI platform** that wraps Retell/
Vapi/Bolna/LiveKit/Ultravox/Sarvam behind adapters, while the platform itself owns customer data,
consent, campaigns, scoring, QA, governance, security, and reporting.

| Phase | Title | One-line gist |
|---|---|---|
| 0 | Architecture, Requirements, Governance Baseline | Foundation to establish before picking any voice provider |
| 1 | Customer Acquisition + Smart Form + Attribution + Lead Capture | Front door: source, intent, language, consent, preferred contact method |
| 2 | Customer 360 + CRM + MDM + Identity Resolution | Resolves "is this the same person" across channels |
| 3 | ConsentAI + Communication Preferences + DNC + Suppression | Gate: is this contact legally/ethically callable |
| 4 | Lead Validation + Enrichment + FraudAI + Data Quality | Raw lead → trusted, scored, deduped record |
| 5 | SegmentAI + Persona + Cohort Management | Groups leads into actionable segments |
| 6 | ScoreAI: Lead/Intent/Fit/Conversion/Risk/Confidence Scoring | Multiple independent scores, not one vague number |
| 7 | CampaignAI / Outbound Campaign Orchestration | Who/when/how-often/which-agent/budget/stop-rules |
| 8 | PolicyAI: Pre-Call Decision Engine + Runtime Guardrails | Final authorization gate before any dial |
| 9 | RouteAI + Voice/Telephony Abstraction Layer | Provider-agnostic telephony routing |
| 10 | ConversationAI + Call Script Engine + Customer Discovery | Core behavior layer during the call |
| 11 | NeedAI + Voice-of-Customer Intelligence | Turns every interaction into structured need data |
| 12 | RecommendAI + Service/Offer Matching Engine | Need profile → safe, explainable recommendations |
| 13 | NextAI / Next-Best-Action Engine | Best next action after every meaningful event |
| 14 | ToolAI / Integration Gateway (CRM, Appointment, Messaging, Payments) | Agent never touches systems directly — goes through a governed gateway |
| 15 | FollowUpAI + Omnichannel Journey Orchestration | Post-call SMS/email/WhatsApp/callback/nurture |
| 16 | QualityAI + TestAI: Full Voice-Agent QA Factory | End-to-end QA from lead capture through follow-up |
| 17 | ObserveAI + AIOps + Production Monitoring | Full-platform visibility, anomaly detection, alerting |
| 18 | SecureAI + PrivacyAI | Zero-trust, PII/PHI protection, tenant isolation, recording controls |
| 19 | RiskAI | Formal risk-management system for all identified failure modes |
| 20 | ResponsibleAI / ResAI | Fairness, transparency, accountability, human oversight |
| 21 | ExplainAI | Decision provenance, reason codes, faithful explanations |
| 22 | GovernAI: AI Governance Control Plane | Central approvals/versions/exceptions/retirement for every AI asset |
| 23 | ReportAI | Governed reporting layer — every KPI has a defined source/owner/calc |
| 24 | MarketAI | Voice-of-Customer data → market/competitor/pricing intelligence |
| 25 | FinAI / FinOps | Unit economics per call/campaign/provider route |
| 26 | MLOps + LLMOps + VoiceOps Release Engineering | Versioned production artifacts for models/prompts/agents/policies |
| 27 | ResilienceAI + SRE + BCP/DR | Continued safe operation when any component fails |
| 28 | HumanOps + Agent Assist + Supervisor Console | Human side: receptionists, sales, supervisors, QA reviewers |
| 29 | FraudAI + Abuse Prevention + Lead Authenticity | Fake leads, bots, call-farming, credential/SMS/promo abuse |
| 30 | DataAI + MDM + Customer 360 + Data Quality | Trusted data foundation underneath every AI layer |
| 31 | CampaignAI + Acquisition Orchestration | Controlled, prioritized, policy-aware outbound journeys |
| 32 | SegmentAI: Dynamic Segmentation + Lifecycle + Propensity | Explainable dynamic segments other modules act on |
| 33 | ScoreAI: Intent/Contactability/Conversion/Engagement/Fit | Governed multi-score layer |
| 34 | KnowledgeAI + Enterprise RAG | Governed, current, source-backed clinic knowledge |
| 35 | ConversationAI + Dialogue State + Script Engine | Core runtime brain: what it says/asks/remembers/when it stops selling |
| 36 | NextAI: Next-Best-Action + Decision Engine | What to do next after every event |
| 37 | RecommendAI + OfferAI | Best-fit service/slot/package for stated need + constraints |
| 38 | NeedAI: Intent/Need/Pain-Point/Objection Extraction | Structured understanding of what/why/blocker/urgency |
| 39 | FollowUpAI + Journey Orchestration | Callbacks, no-answer recovery, nurture, obsolete-action cancellation |
| 40 | ObserveAI: Voice/Agent/Workflow Observability | Operational nervous system tying calls→turns→STT/TTS→LLM→tools→cost→outcome |
| 41 | QualityAI: Automated QA + Evaluation Control Plane | Quality management across every version/language/route/campaign |

## 5. Inbound platform architecture — Phase 42, 42A through 42S

A second, parallel architecture specifically for **inbound** calls (the customer initiates), since
inbound requires different logic: identify who's calling and why, decide self-service vs. handoff,
before doing anything else.

| Phase | Title | One-line gist |
|---|---|---|
| 42 | PolicyAI: Consent, DNC & Contact Governance | Authorization layer in front of every inbound/outbound action |
| 42A | Inbound Call Master Plan | AI receptionist + booking + support + human handoff, top-level plan |
| 42B | Inbound UI/UX Master Design | Screens for clinic admins, receptionists, supervisors, QA, support |
| 42C | Inbound Use-Case + User-Story Library | Full production scenario catalogue for cross-team alignment |
| 42D | Inbound Routing + Queue + HumanOps | Phone number → AI → correct department → human queue → callback, no context loss |
| 42E | Inbound Call State Machine + Flow Engine | Every valid call state + permitted transition, for predictability/testability |
| 42F | Missed/Abandoned/Dropped Call + Callback Recovery | Every failed contact becomes a governed recovery opportunity |
| 42G | After-Hours + 24×7 Inbound Operations | Behavior when clinic closed, department unavailable, capacity zero |
| 42H | Inbound Caller → Prospect → Lead → Customer Pipeline | Capture real prospects without junking CRM with simple-FAQ callers |
| 42I | Inbound Security + Fraud + Identity + Abuse Protection | Caller-ID spoofing, account access, enumeration, prompt injection, robocalls |
| 42J | Inbound Tracking + Reporting + Dashboard Data Model | One consistent measurement foundation across ops/QA/finance/marketing/exec |
| 42K | Inbound Operations + SOP + Support Model | "It works" → "it's operable reliably every day across many clinics" |
| 42L | Inbound AI Quality Engineering + Evaluation Framework | Repeatable, evidence-based production-readiness testing |
| 42M | Inbound Customer Experience + Conversation Design | How it should *feel* to the caller: fast, clear, respectful, escalatable |
| 42N | Inbound Appointment & Scheduler Integration | Reliable booking across clinic types, vendor-independent voice layer |
| 42O | Inbound CRM + Customer 360 Integration | One coherent customer journey, no duplicate leads/customers |
| 42P | Inbound Knowledge/RAG + FAQ Architecture | Structured facts from APIs, RAG for approved descriptive knowledge only |
| 42Q | Inbound Responsible AI + ExplainAI + AI Governance + RiskAI | Should this AI be allowed to do this, not just can it |
| 42R | Inbound Privacy + Consent + Data Governance | Collect/use/retain/share/delete across telephony, CRM, transcripts, recordings |
| 42S | Inbound FinOps + Cost Engineering + Provider Routing | Minimize cost per successful outcome, not just cost per minute |

## 6. Recurring cross-cutting themes

Across both the outbound and inbound tracks, these control planes repeat by design (a deliberate
"named-AI-layer" pattern used throughout): **ConsentAI/PolicyAI** (contact governance), **ScoreAI**
(multiple explainable scores, never one black-box number), **NeedAI/RecommendAI/NextAI** (discovery
→ matching → decisioning), **QualityAI/ObserveAI** (testing + telemetry), **SecureAI/RiskAI/
ResponsibleAI/ExplainAI/GovernAI** (the governance stack), **FinAI/FinOps** (unit economics per
outcome, not per minute), and **ToolAI** (agent never touches CRM/scheduler/payments directly — always
through a governed integration gateway).

The full 162-message transcript (raw JSON) is archived at:
`/home/praveen/.claude/projects/-mnt-deepa-sohamyoga/8daaad36-52ff-4ca5-92b3-3a8adff6d0ff/tool-results/buu83m0py.txt`
