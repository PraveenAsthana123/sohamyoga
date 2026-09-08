# Extracted: Messaging Tool Integrations / MCP Control Plane / Vapi Desktop Integration

Source: [ChatGPT shared conversation](https://chatgpt.com/share/6a9856d5-8564-83e8-a3e8-f44ed9b1d526) ("Messaging Tool Integrations"), 83 messages, 29 user turns. Extracted via the mandatory `chatgpt_share_extract.py` script.

## Enumeration of every user turn (29 total — full count, not a sample)

| Idx | Classification | Text |
|---|---|---|
| 0 | Real prompt | "list of tool, mcp, integration to send message to phone (google,apple), library, plugin, framework" |
| 2 | Real prompt | "is there any 3rd party tool which make this task easy to send message to appledevice, google device" |
| 6 | Real prompt (narrowing constraint) | "opensoruce" (open-source) |
| 8 | Real prompt | "which can send message to all the tool ...slack, phone, googlechat, whatsapp, telegram, instagram, x, etc" |
| 10 | Real prompt | "40+ platform" |
| 12 | Trivial continuation | "next" |
| 14 | Trivial continuation | "next" |
| 16 | Real prompt | "what is not there in vapi, retell ai, sarvam ai ... which can be build custom from technical side" |
| 20 | Real prompt | "can I integrate my desktop ollama model with vapi to reduce the cost, automation, vs code" |
| 24 | Real prompt | "for inbound and outbound call to reduce the cost or BYOM (bring my own model)" |
| 28 | Real prompt | "customer selfservice for voice AI (inbound, outbound)" |
| 30 | Trivial continuation | "next" |
| 32 | Trivial continuation | "next" |
| 34 | Trivial continuation | "next" |
| 36 | Real prompt | "what are things which I should do on my desktop and what things should be done on vapi (inbound, outbound)" |
| 38 | Real prompt | "list of integration for calendar ..opensource, crm, server service portal, payment" |
| 40 | Real prompt | "how vapi can connect with my desktop" |
| 42 | Real prompt | "can I push the prompt, call script, routine from desktop to vapi directly via [API]" |
| 46 | Real prompt | "without login to vapi ..... can I configure from my desktop" |
| 50 | Real prompt | "which things will not work .. I need to do manually, which things I can automation with my vscode+codex" |
| 55 | Real prompt | "how, what to build, quality check, feature check" |
| 57 | Real prompt | "is there any vapi, retell ai, sarvam ai ... MCP which can facilitate or other library" |
| 62 | Real prompt | "what these mcp can do ... task, feature, debug, integrate, quality check, monitor, track, trace, etc" |
| 69 | Real prompt | "YOUR MCP CONTROL PLANE — this is another framework or internal mcp which integrate with external mcp .. internal gateway to integrate with other mcp" |
| 71 | Real prompt | "what other things missing .. brutal" |
| 73 | Real prompt | "create technical plan for this" |
| 75 | Real prompt | "for calendar integration" |
| 77 | Real prompt | "for phone _apple, google integration" |
| 81 | Real prompt | "for billing, payment from customer side" |

**Count: 24 real prompts + 5 trivial continuations = 29 user turns, matching the extractor's own `message_count`/user-role count exactly.**

## Redacted/unrecoverable content

20 `tool`-role messages (indices 3,4,17,18,21,22,25,26,43,44,47,48,52,53,58,59,60,63,64,66,67 — a plugin/browsing tool call before many of the assistant responses) all returned literally `"The output of this plugin was redacted."` — unrecoverable, consistent with every prior extraction in this doc set. The assistant's own prose responses were NOT redacted and are the basis for the summary below.

## What this conversation actually is

A single continuous architecture conversation that moves through four connected topics:

1. **Omnichannel messaging** (idx 0–10): notification/messaging tooling to reach a phone across Apple/Google, landing on **Apprise** (open-source, 40+ platform aggregator) and **Novu** as the recommended options.
2. **Voice AI platform comparison + build-vs-buy** (idx 16–55): what's missing from Vapi/Retell AI/Sarvam AI that could be custom-built; desktop Ollama + VS Code as a BYOM (bring-your-own-model) cost-reduction layer for inbound/outbound calls; a customer self-service portal concept for voice AI; an explicit split of "what runs on my desktop" vs "what runs on Vapi."
3. **Vapi ↔ desktop integration mechanics** (idx 38–50): calendar/CRM/payment integration list; how Vapi reaches a local desktop (Cloudflare Tunnel pattern); **pushing prompt/call-script/routine changes from desktop to Vapi via its API** (the literal ask that drove this session's build); configuring Vapi without using its dashboard; what's automatable via VS Code + Codex vs. manual (billing, telephony-provider, compliance steps flagged as manual-only).
4. **MCP Control Plane architecture** (idx 57–81): Vapi/Retell/Sarvam's own MCP surfaces; a proposed **internal MCP gateway/control plane** (Registry + Router + Policy Engine + Observability, translating vendor-specific tools like `vapi.create_assistant` into a vendor-neutral internal API like `voice.create_agent`) explicitly named "YOUR MCP CONTROL PLANE" by the user; a "brutal" gap assessment (identity, lifecycle, trust, schema governance, resilience — enterprise-grade concerns); a full technical plan separating control/execution/observability/governance/provider-adapter planes; and finally three specific integration domains requested as *separate* MCP services behind the gateway rather than hard-coded into Vapi directly: **Calendar MCP**, **Mobile/Phone (Apple+Google) Communication Gateway**, and **Billing & Payment MCP**.

## Cross-check against what already exists in this workspace

This is NOT a cold start — direct audit found real, relevant prior work in **two separate places**, neither of which is `sohamyoga-frontend`:

- **`voice-agent-platform/`** (a separate, real, standalone Next.js+Postgres app for voice-agent *operations* at healthcare clinics — dental/chiropractic/physiotherapy/ENT/massage therapy). Its own README explicitly documents rejecting an earlier "60-phase enterprise AI voice platform" (ScoreAI/GovernAI/FinAI/ResilienceAI-style over-engineering) as disproportionate — the same over-scoped pattern this conversation's idx 71/73 (brutal gap assessment + full technical plan) risks producing if taken literally. Real, DB-backed: `call_script`/`call_script_version` (exactly the "push call script" concept from idx 42), `contact`, `call_log`, admin auth. Explicitly deferred: real Vapi/Retell/Bolna calling — `VoiceProviderAdapter.ts` defines the interface, `NotConfiguredVoiceProvider.ts` fails closed with no fabricated calls, because **no real API credentials exist for any voice provider**.
- **`market-research-portal/`** has real `voice_agent`/`voice_script`/`voice_call`/`voice_call_event`/`voice_sip_trunk` schema plus a real local STT/TTS pipeline (`Transcriber.ts` — ffmpeg + faster-whisper; `VideoRenderer.ts` — espeak-ng), but is blocked at the telephony-carrier layer (no SIP trunk/carrier account) — a different, earlier-documented instance of the same credential gap (see `voice-agent-outbound-inbound-calling-platform.md` in this same directory).
- **`sohamyoga-frontend`**'s own `use_case_registry` Voice AI domain (14 items) was independently re-confirmed genuinely `not_built`/`needs_new_infra` this same session via direct grep (no twilio/vapi/livekit/telephony code anywhere in that codebase) — correctly distinct from the two projects above, since sohamyoga is a yoga studio, not a voice-agent business.
- **`packages/shared-backend`** already establishes the exact "reusable internal package" pattern the user asked for when clarifying scope for the MCP control plane (`@sohamyoga/shared-backend`, file-linked, used today by `sohamyoga-frontend`).

## Verdict and what was actually built from this conversation (this session)

Per explicit user clarification (asked live, since guessing wrong here meant either fabricating a fake integration or building the wrong architecture):
- **No real Vapi/Retell/Sarvam credentials exist** → build the provider-agnostic layer honestly now; do not fabricate a working call.
- **"Global access from any project" = a reusable internal package** (like `@sohamyoga/shared-backend`), not a machine-wide Claude Code MCP server registration.

Built in `voice-agent-platform` (the correct project — its `CallScript`/`CallScriptVersion` domain already models exactly the idx-42 "push call script to Vapi" concept):
- Migration `006-vapi-sync`: `call_script_version.vapi_assistant_id` / `vapi_synced_at` / `vapi_sync_error`.
- `src/domain/call/VapiAssistantSync.ts` — builds a system prompt from a script version's sections and calls Vapi's real assistant create/update REST endpoints, **fails closed** (`VoiceProviderNotConfiguredError`) when `VAPI_API_KEY` is unset, exactly matching the existing `NotConfiguredVoiceProvider` pattern in the same codebase.
- `POST /api/scripts/[id]/versions/[versionId]/sync-vapi` + a "Sync to Vapi" button on the script detail page, showing real sync status (assistant id, last synced time, or the honest not-configured error).
- **Verified live, in two stages**: first the fail-closed path (no key: correct 409 + clear error, 401 unauthenticated, `tsc` clean). Then, once the user provided a real `VAPI_API_KEY`, **a genuine end-to-end live test against Vapi's real API**: created a real assistant (`POST /assistant`, returned a real Vapi assistant id), re-synced the same version and confirmed the update path (`PATCH /assistant/{id}`) correctly reused the same assistant id (`createdNew: false`) rather than creating a duplicate, confirmed the trace log captured the real success with accurate timing (208ms) and the initiating admin's email, and deleted the real test assistant from Vapi afterward via its real DELETE endpoint to avoid leaving test data in the user's account. The integration is now confirmed genuinely working, not just structurally plausible.

**Also built, same session, in direct response to the user's "track, trace" follow-up (idx 62's monitor/track/trace theme):** migration `007-vapi-sync-log` (`vapi_sync_log` table) + `appendVapiSyncLog`/`listVapiSyncLog` + `GET /api/scripts/[id]/versions/[versionId]/sync-vapi/history` + a "sync history" expandable panel on the script detail page. Every sync attempt (success, Vapi-side failure, or not-configured) is appended, not just the version's latest state — a real, minimal trace log, deliberately not a full observability/monitoring platform (this project's README already rejected that scale of over-engineering once). Verified live: a real not-configured sync attempt was correctly appended with the exact error message, duration, and initiating admin email; confirmed 401 unauthenticated on the history endpoint; test data cleaned up.

**Also built, same session, in direct response to "create an assistant for inbound with all the list of scenarios and another for outbound":** migration `008-script-direction` (`call_script.direction` inbound/outbound + `scenario_key`) + migration `009-vapi-advanced-config` (real, per-version, editable model/voice/transcriber/limits config, verified against the live Vapi API including a real rejection of an invalid voice id and a real success with a valid one) + a `VapiConfigEditor` UI + 11 real call scripts covering the requested scenario list: inbound (new patient inquiry, appointment booking, reschedule/cancel, billing/insurance question, general FAQ) and outbound (appointment reminder, appointment confirmation, post-visit thank-you, billing/payment reminder, satisfaction survey, new-patient outreach). Created as drafts, ready for review/publish/Vapi-sync.

**Also built, same session, in direct response to "contact management where a business can upload/add contacts, self-service or admin-managed, with real ownership/isolation, tracked in tables":** a full second authenticated user system, `business_customer` (migration `011-business-customer`), completely separate from `admin_user` -- own scrypt-hashed login (`/customer/login`, `/customer/register`), own session table/cookie, mirrored exactly off the existing admin auth pattern. Real business profile (business name, service type now including `yoga`, services offered, pricing, hours, holidays/closures -- migration `010-yoga-service-type` + fields in `011`) that grounds a business's own scripts, never fabricated. Contact and script ownership (`owner_customer_id` on both `contact` and `call_script`) so each business sees and manages only its own data -- verified live with two separate registered businesses, confirmed zero cross-visibility. CSV bulk contact import (real validation per row, honestly reports skipped rows with reasons rather than silently dropping them -- true `.xlsx` binary parsing would need a new dependency, not added without asking). A `needs_follow_up` flag added to `call_log` (migration `012`) plus a customer-facing call-history dashboard, correctly empty until real calls happen. A content-only script tab (inbound/outbound scenario lists, create-new-scenario form) -- deliberately excludes Vapi technical config and the sync trigger, which stay admin-only per explicit requirement ("customer or business user will not be given Vapi access"). An admin-side mirror (`/api/admin/business-customers`) so staff can create/manage a business's entire profile+contacts+scripts+calls on their behalf, for businesses that don't want to self-serve -- same underlying data, both paths verified. Full dashboard UI at `/customer/dashboard` with Profile/Contacts/Scripts/Calls tabs, all pages confirmed rendering (200) and all API routes confirmed 401 when unauthenticated.

**Explicitly NOT built, and why:** real email sending and real payment processing (both need a provider account/API key that doesn't exist — building the "thank you" and "payment reminder" scenarios as call scripts instead, per the honest-substitute pattern already established); a bulk contact-import path for "1000 leads" (the user confirmed this meant contacts to call, but it wasn't built this round — the existing `contact` CRUD would need a bulk-import endpoint added); cost/quality/script-performance/workflow/testing "matrices" and concurrent-user handling (all requested, all correctly deferred — none of them can be computed honestly without real call data, which needs a live Vapi phone number assigned and a webhook receiver built first, neither of which exists yet); n8n integration (the existing `n8n` container has been crashed for 6 months and needs investigating, not blindly restarting, before anything depends on it).

**Not built from this conversation** (all genuinely still blocked or out of current scope, not silently dropped): the full internal MCP Control Plane (Registry+Router+Policy+Observability) that idx 69/71/73 describe — voice-agent-platform intentionally has no MCP layer at all yet, unlike sohamyoga-frontend's own 29-server MCP gateway; the separate Calendar MCP, Mobile/Phone Communication Gateway, and Billing & Payment MCP from idx 75/77/81; actual outbound/inbound call placement (still credential-blocked); Apprise/Novu omnichannel messaging (idx 0–10) was not wired into either project this session.
