# Extracted: "Create AI Calling Blueprint" (AI Voice Agency SaaS Platform)

Source: [ChatGPT shared conversation](https://chatgpt.com/share/6a95e84b-848c-83e8-90d2-31f3e7b2a8f2), 41 messages. Extracted via the mandatory `chatgpt_share_extract.py` script.

## What was actually in the conversation

**4 real prompts among 12 pasted Udemy course syllabi** (Callin.io AI Calling course, Master AI Voice Agents no-code, two n8n workflow-automation courses, Vapi/ElevenLabs/LiveKit/MCP course, AI Call Assistant agency course, Retell AI + n8n agency course, No-code voice agents/chatbots course, ElevenLabs voice-agent course, one more 12h29m technical course):

| Msg | Real prompt |
|---|---|
| [8] | "what config need to be done in each portal ..create the plan as well. 3rd party portal" |
| [10] | "create UI visual screen with field, navigation, reporting, dashboard, billing, notification, list of track, integration" |
| [11] | "each node from main menu ..put that screenshot one by one" |
| [12] | "what config need to be done in twilio, vapi ai, cal.retell ai, make.ai, n8n" |

## What this conversation actually is

Unlike the earlier `voice-agent-outbound-inbound-calling-platform.md` extraction (a different conversation, scoped around sohamyoga acquiring its own customers via calling), **this one designs a multi-tenant AI-voice-agent *reseller agency* SaaS product** — i.e. a platform for selling AI calling agents to *other* businesses (dental clinics, real estate agents, solar companies, recruiters), complete with a Sales Portal (service catalog, package tiers, pricing rules, territory/commission management, discovery questionnaires, proposal templates) alongside the Customer and Admin portals. This is a different business model than "a yoga studio using AI voice agents for its own front desk" — it's "build and run an AI-calling agency that sells this to clients."

## Cross-check against what already exists

- `market-research-portal` already has the **Customer/tenant-facing half** of this for real: `voice_agent`, `voice_script`, `voice_call`, `voice_sip_trunk`, `voice_workflow`, `voice_routing_rule`, real dispatch job, and an 8-tab admin UI (built earlier this session) — the "AI Agent Configuration," "Inbound/Outbound Configuration," and "Campaign Configuration" sections this conversation describes are already real schema/UI here, just simpler than the 40-field enterprise version proposed.
- The **Sales Portal / agency-commercialization half** (package tiers, discovery templates, proposal generation, territory/commission, per-tenant billing) does not exist and isn't a fit — sohamyoga is a yoga studio, not an AI-calling reseller agency. Building it would be solving a different company's problem.
- The **Third-Party Portal Matrix** (Twilio, Retell AI, Vapi, n8n, Make, GoHighLevel config) restates the same standing blocker already documented: no telephony carrier/voice-platform account exists in this environment, so none of these configurations can be performed for real.

## Verdict: one real, reusable artifact — a provider-onboarding runbook; no new code

Everything about the agency/reseller business model is out of scope (wrong business) and not built. But message [15]/[19]'s **provider-by-provider configuration steps** (Retell AI workspace→agent→voice→LLM→functions→webhook→testing; Twilio account→number→SIP→webhook; n8n credential/workflow groups keyed to `CALL_STARTED`/`CALL_ENDED`/`APPOINTMENT_BOOKED` events) is genuine, reusable reference material for the day a real telephony/voice-platform account gets connected — worth keeping so it isn't re-derived from scratch later, but it is documentation only. No schema, API, or UI was added from this conversation: doing so now would mean building admin screens (e.g. an "Integration Control Center" showing provider health) with nothing real behind them, which this codebase's fail-closed discipline treats as fabrication.

**Recommendation:** when a telephony/voice-platform account is actually provisioned, this doc's provider-config section is the checklist to work from for wiring `VoiceCallDispatchJob.ts` to a real dispatch client.
