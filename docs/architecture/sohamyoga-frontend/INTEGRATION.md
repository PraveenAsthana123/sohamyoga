# Real External Integrations — sohamyoga-frontend

Verified by reading the actual client code, not by filename or config presence alone. If it's not
listed here, no working client code was found (checked: Stripe, Twilio, OpenAI SDK, Vapi — all
grep-negative in `src/domain/`, only appearing as SQL/seed-file text).

| Integration | File | What it does | Status |
|---|---|---|---|
| Google Business Profile (reviews) | `src/domain/reputation/GoogleBusinessReviewAdapter.ts` | Calls `mybusinessaccountmanagement.googleapis.com` / `mybusinessreviews.googleapis.com` | Code real; needs Google's manual API-access approval, not end-to-end tested per file's own comment |
| Skyvern (browser automation) | `src/lib/skyvern.ts` | REST client to a local Skyvern instance (`127.0.0.1:18000`), credential from OpenBao vault | Container `soham-skyvern-skyvern-1` confirmed running |
| Ollama (local LLM) | `src/lib/ollama.ts` | Server-only client to local Ollama daemon (`127.0.0.1:11434`, default model `qwen2.5:latest`), wrapped in a circuit breaker from `@sohamyoga/shared-backend` | Running (part of `docker-compose.yml` topology) |
| Web Push | `src/lib/web-push.ts` | Self-hosted VAPID push, no 3rd-party push service | Send primitive real; not yet wired into `NotificationDispatchJob.ts` dispatch branch (disclosed gap) |
| Google Drive | `src/domain/ingestion/GoogleDriveAdapter.ts`, `googleDriveOps.ts` | OAuth-based file ingestion | Real |
| Slack | `src/domain/ingestion/SlackAdapter.ts`, `SlackOAuthConnector.ts` | Bearer-token REST client | Real |
| ChatGPT share-link ingestion | `src/domain/ingestion/ChatGptShareConnector.ts`, `chatGptSourceOps.ts` | Extracts shared ChatGPT conversation content | Real |
| Postiz (social scheduling) | `src/domain/social/*`, `src/cron/jobs/PostizProviderHealthJob.ts`, `PostizSocialAutoPublishJob.ts`, `FacebookAutoPublishJob.ts` | Self-hosted social scheduler (container `sohamyoga_postiz`) | Real, gated on Postiz being deployed + API key set — currently unset per FEATURES.md |
| Telegram / Discord / Mastodon / Bluesky | `src/domain/social/first-wave-adapters.ts` | Direct REST publish (no Postiz dependency): Telegram Bot API, Discord webhook, Mastodon `/api/v1/statuses`, Bluesky | Real, readiness-checked per platform; recently wired to a real call site |
| OpenBao (secrets vault) | `src/lib/openbao.ts` | Fetches credentials at runtime instead of env-var-only | Real, used by Skyvern client and others |

## Explicitly NOT integrated (checked, not assumed)

- **Stripe, Twilio, OpenAI SDK, Vapi** — no client code found in `src/domain/`; only text mentions in
  SQL/seed files.
- **Google Ads API** — see FEATURES.md, `not_built`.
- **Any graph/vector DB backend** (Qdrant, Neo4j, Pinecone, Weaviate) — see LLD.md §2, confirmed
  absent as a real integration; exists only as forward-looking spec text.

## Voice AI (inbound/outbound)

Not covered by this document — voice AI (Vapi-based inbound/outbound call scenarios) lives in the
separate `voice-agent-platform` portal, not in sohamyoga-frontend (grep-confirmed: `VAPI_` and
`Vapi` client code exists under `voice-agent-platform/src/domain/call/`, not here). Queued as a
separate follow-up doc per the current scoping decision (one portal at a time).
