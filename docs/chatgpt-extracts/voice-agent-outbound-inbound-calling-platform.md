# Extracted: Outbound/Inbound Voice-AI Calling Platform (LiveKit/telephony)

Source: [ChatGPT shared conversation](https://chatgpt.com/share/6a8e1e6f-9c14-83e8-b329-55136c46a757), 162 messages. Extracted via the mandatory `chatgpt_share_extract.py` script.

## What was actually in the conversation

**~12 real prompts** among many "next" auto-continuations (and one stray unrelated Amazon link mid-thread — browser-history bleed-through, ignored):

| Msg | Real prompt |
|---|---|
| [0] | Long paste of AI-voice-agent job-description bullet points (healthcare-clinic inbound/outbound calling, appointment booking, "200+ voice agents deployed across 30 brands") — market/role research, used as the domain framing |
| [2] | "quality point of view" |
| [4] | "survem, bolan, livekit, altrabox," — naming specific voice-platform vendors to compare |
| [6] | "what are the issue with these ..challenges ," |
| [8] | "which has high quality and trust, less headache ..compare each" |
| [14] | "10 hours cost" |
| [18] | "consider all platform, telephony" |
| [22] | "voice agent ...feature ..." |
| [24] | "I need customer acquisition module for each platform with FORM link, collection of email id and creating lead and calling the customer ...outbound call" |
| [26] | "call script design to speak to customer, understand the need and explain about the service, talk to him [in] his mother tongue, understand customer other..." |
| [28] | "what other feature m[issing] for outbound call, tracking, monitoring, security, governance, AI, reporting, scoring, etc, resai, expai, govai, riskai, etc" |
| [30] | "consider each and build the plan, technical plan, task, step, sequence, tool, testing, validation, test data, edge case, edge case solution etc" |
| [118]/[120]/[124] | "list of pending topic" / "what about inbound call planning, UI, tracking, reporting, dashboard, operation, user story, flow" / "next-inbound call" |

Several vendor-comparison responses ([9] and others) came back `"The output of this plugin was redacted"` — unrecoverable, same pattern as prior conversations.

## What this conversation actually is

**This is the direct, literal source of this session's earlier "inbound call and outbound call management, script management, tts, stt, tracking" requests.** It's a full outbound+inbound voice-AI calling platform spec: vendor comparison (LiveKit and others), call-script design with language/mother-tongue handling, lead capture → outbound call flow, and a request for a full technical plan covering security/governance/ResponsibleAI/ExplainAI/RiskAI/testing/edge-cases for both outbound and inbound call flows.

## Cross-check against what already exists — this one is NOT a cold start

Unlike the other conversations, `market-research-portal` already has **real schema and API surface for exactly this domain**, confirmed via direct audit (2026-08-31):

- Schema: `voice_agent`, `voice_script`, `voice_call`, `voice_call_event`, `voice_sip_trunk`, `voice_sip_endpoint`, `voice_modulation_profile`, `voice_workflow`, `voice_routing_rule`, `voice_monitor_snapshot`
- API: `/api/voice-ai`, `/api/voice-ai/preview`, `/api/voice-ai/transcribe`
- Real local pipeline: `Transcriber.ts` (ffmpeg + faster-whisper STT, no cloud API), `VideoRenderer.ts` (espeak-ng TTS)
- `sohamyoga-frontend`'s Build Status dashboard already honestly reports this area as: schema/dashboard real, **"blocked: no telephony carrier account connected"**

## Verdict: real gap, but credential-blocked at the telephony layer

The lead-capture → script → outbound-call flow and the inbound-call UI/tracking/dashboard this conversation asks for are **not built yet** on top of the existing voice schema. But making actual phone calls (PSTN in/out) requires a real SIP trunk or telephony carrier account (Twilio, Telnyx, a LiveKit SIP integration, etc.) that does not exist in this environment. Per this session's fail-closed discipline, the honest path is: build the real script-design, lead-to-call-queue, and inbound-call dashboard/tracking schema and UI now (all of that is genuinely buildable with existing infra), and leave actual call placement/receipt behind an explicit "no carrier connected" state — exactly the pattern `SelfHealJob.ts` already uses for `youtube_publish`/`social_publish` ("no Postiz client exists").
