# Module: Voice AI (inbound/outbound calling)

Real, working module in `market-research-portal`. This doc is the shared/plug-and-play
contract for the module — what it is, what it touches, what it doesn't — per the
mandatory [Operational Portal Page & Tab Standard](../../../docs/chatgpt-extracts/voice-agent-outbound-inbound-calling-platform.md)
and the "each module = its own folder + a portable contract" request.

## Where it lives (its "folder")

| Layer | Path |
|---|---|
| UI (8 mandatory tabs + module workspace) | `market-research-portal/src/app/(app)/voice-ai/page.tsx` |
| API | `market-research-portal/src/app/api/voice-ai/route.ts`, `/preview/route.ts`, `/transcribe/route.ts` |
| Schema | `market-research-portal/src/domain/pipeline/db-schema-digital-marketing.sql` (voice_* tables), `db-schema-voice-lead-link.sql` (lead↔call link) |
| Automatic Process job | `market-research-portal/src/domain/pipeline/VoiceCallDispatchJob.ts`, wrapper `src/cron/jobs/VoiceCallDispatchJob.ts`, registered in `job_registry` as `voice-call-dispatch` |
| STT dependency | `market-research-portal/src/domain/pipeline/Transcriber.ts` (faster-whisper, local) |
| TTS dependency | `market-research-portal/src/app/api/voice-ai/preview/route.ts` (espeak-ng, local) |

## Data model (real tables)

`voice_agent`, `voice_script`, `voice_call` (now with `lead_id` FK), `voice_call_event`,
`voice_sip_trunk`, `voice_sip_endpoint`, `voice_modulation_profile`, `voice_workflow`,
`voice_routing_rule`, `voice_monitor_snapshot`. All scoped to `marketing_workspace`.

## End-to-end flow

```text
Lead capture (form/manual, CRM page)
        │
        ▼
Admin authors voice_agent + voice_script (draft)
        │
        ▼
Admin approves script (draft/review → approved/active)
        │
        ▼
CRM "Queue call" button (or Voice AI page test scheduler)
   — validates E.164 phone, requires consent_basis + DNC confirmation,
     requires an approved script
        │
        ▼
voice_call row created: status = scheduled (if PSTN connected) or
blocked (if not) — never fabricated as placed
        │
        ▼
voice-call-dispatch job (every 5 min + on-demand): sweeps any call still
"scheduled" past its scheduled_at, relabels it "blocked" with the real
reason — enforces the schedule even with nobody watching
        │
        ▼
(If a real call ever happens via a future PSTN client) recording →
/api/voice-ai/transcribe → real faster-whisper transcript → voice_call.transcript
        │
        ▼
lead.status auto-advances new → contacted when a call is queued for it
```

## Demo use cases

1. **Consented follow-up call** — lead submits a form → CRM captures it → admin queues a call with an approved script.
2. **Qualification + appointment booking** — `qualification`/`appointment` script types drive discovery questions and a booking CTA.
3. **Inbound routing (business-hours aware)** — `voice_routing_rule` maps a DID + business hours to an agent/script/workflow with a human-handoff fallback.
4. **Local voice preview for compliance review** — draft a disclosure line, generate a real local WAV, review before approving.
5. **Call transcript for QA** — upload a recorded call's audio, get back a real local transcript.

## Reporting & dashboard

Both are tabs on the module page (not separate pages): **Dashboard** (PSTN/PBX status, call
counts by outcome, script approval counts, callable-lead count) and **Report** (narrative
summary of the same, generated live from real rows — no static/mock numbers).

## Job (Automatic Process)

`voice-call-dispatch`, every 5 minutes (`*/5 * * * *`) plus on-demand via `/api/jobs/run`.
Real, verified live: creates no fabricated call outcomes — it only ever transitions a stale
`scheduled` row to `blocked` with the true reason, because no PSTN dispatch client exists in
this app yet.

## What this module deliberately does NOT do (exclusion boundary)

- Cannot place or receive a real PSTN call — no telephony carrier account or SIP dispatch
  client exists. Every path that would need one fails closed with an honest `blocker` string.
- No voice cloning execution (schema field `cloning_consent_ref` exists, unused).
- No LLM-drafted scripts — `script_generate` job type exists in the schema enum with zero
  implementation; all script content today is human-authored.

## Reusing this module in another project ("plug and play")

Copy the schema file + the three API routes + the page + the two job files; the only external
dependencies are Postgres, `espeak-ng` and `faster-whisper` binaries, and a `marketing_workspace`
row to scope data to. No paid API keys are required until a real telephony provider is wired in.
