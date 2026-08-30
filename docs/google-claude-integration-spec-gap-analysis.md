# "Build Google Claude Integration" Spec — Reality Check

Real code/schema/service verification, 2026-08-25. Source: a pasted ChatGPT
conversation (title "Build Google Claude Integration", extracted via
`scripts/chatgpt_share_extract.py`) describing a 7-phase "multi-source AI
ingestion platform" — Google Drive/Docs/Sheets, Slack, WhatsApp, Google Chat,
Facebook Messenger, LinkedIn, desktop folders, and ChatGPT shared-link
ingestion, all feeding an AI agent (Claude). Every one of the ~306 numbered
sub-requirements across the 7 phases was checked individually against the
actual sohamyoga repo (sohamyoga-frontend, market-research-portal,
packages/shared-backend, ai-agents, scripts, docker-compose services,
.continuity/decisions.jsonl) by 7 independent research passes, one per phase.

**This is architecture design, not a build log.** Nothing in the source
conversation claims code was written — it's the user pasting requirements
into ChatGPT and getting back increasingly large phase specs. The audit
below checks how much of that design happens to already exist in this repo
for other reasons, not whether ChatGPT's plan was "completed."

## Headline number

| | Count | % of 306 |
|---|---|---|
| ✅ Real (working code/schema/service) | 3 | 1.0% |
| 🟡 Partial (related but narrower/different-domain) | 19 | 6.2% |
| ❌ Not found (pure unbuilt design) | 284 | 92.8% |

**22 of 306 items (7.2%) have any supporting evidence at all; 3 (1.0%) are
fully real.** The other 92.8% is unbuilt ChatGPT-conversation design with no
corresponding table, route, service, or script anywhere in the repo.

## Per-phase tally

| Phase | Items | ✅ Real | 🟡 Partial | ❌ Not found |
|---|---|---|---|---|
| 1 — Source Registry & Discovery | 29 | 0 | 1 | 28 |
| 2 — Auth, OAuth, Service Accounts, Secrets, RBAC | 28 | 3 | 7 | 18 |
| 3 — Universal Connector Framework & Adapter SDK | 32 | 0 | 3 | 29 |
| 4 — File Ingestion, Desktop Folder Monitoring | 31 | 0 | 2 | 29 |
| 5 — Google Drive, Docs & Sheets Connector | 35 | 0 | 2 | 33 |
| 6 — Slack, Google Chat, WhatsApp, Messenger, LinkedIn | 68 | 0 | 1 | 67 |
| 7 — ChatGPT Shared-Link & Manual Paste Ingestion | 83 | 0 | 3 | 80 |
| **Total** | **306** | **3** | **19** | **284** |

Phase 2 (auth/RBAC) is the clear outlier — it's the only phase with any ✅ Real
items, because this repo already has ordinary app authentication, tenant-scoped
RBAC, and an OpenBao-backed `vault://` secret-reference pattern for its own
(unrelated) social-publishing credentials. Every other phase is almost
entirely unbuilt.

## What's actually real (✅)

All three live in Phase 2, and all three serve this app's own auth/social
domain, not an AI-ingestion platform:

1. **"Never store raw provider passwords" discipline** — `src/app/api/config/credentials/route.ts` writes secrets straight to OpenBao; explicit code comment "NEVER stored in: database, .env, logs, or git."
2. **Tenant isolation via `tenant_id` on every table** — pervasive across `sohamyoga-frontend/src/domain/**/db-schema*.sql`.
3. **Credential vault / secret-reference pattern** — `social_oauth_connection.token_reference` and `account_provisioning_job.credential_reference` are `CHECK (... LIKE 'vault://%')`, backed by a live OpenBao service.

## What's partially real (🟡) — the recurring pattern

Every 🟡 in this audit is the same shape: **a structurally similar mechanism
exists, built for a different domain**, and gets miscredited if you only
pattern-match on keywords rather than checking direction and scope:

- **Outbound vs. inbound confusion (Phase 6's core risk).** This repo has real, working *outbound* social-publishing infrastructure (Postiz-based Facebook/LinkedIn/YouTube auto-publish jobs, Telegram/Discord/Bluesky/Mastodon adapters). The spec asks for *inbound* reading of Slack/WhatsApp/Google Chat/Messenger conversations as an AI input source — the opposite direction. Only one genuine inbound artifact exists anywhere: a minimal Slack Socket-Mode `app_mention`/DM bot in the unrelated `agentic-ollama-platform` project, with no persistence, checkpointing, or governance.
- **MCP tool-tier registries look like a connector SDK but aren't one.** `ChatMcpRegistry.ts`, `AnalyticsMcpRegistry.ts`, `external-platform-mcp.ts` expose tiered (`auto`/`staff`/`admin`) *action* tools over this app's own data — not a read framework over external ingestion sources.
- **The Ollama circuit breaker (this session's own shared-backend extraction) is a real, working reliability primitive** — but scoped to the local Ollama LLM daemon, not per-ingestion-source reliability (Phase 3 wants per-Slack/per-Google-Drive circuit breakers).
- **The construction-twin plan-import feature** (`market-research-portal`, OpenCV+Tesseract OCR, SHA256 checksum, human-review workflow) is real, working file-ingestion-shaped code — for handwritten floor-plan images in one narrow feature, not a general file/folder ingestion engine.
- **A vendored third-party Google Sheets MCP server** (`integrations/paperclip/packages/google-sheets-mcp-server`, its own nested git project) does real service-account-authenticated Sheets read/write — no Drive, no Docs, no OAuth, not built for or wired into anything in this repo.
- **This very session's `chatgpt_share_extract.py`** satisfies the raw fetch/parse half of Phase 7's "shared link = snapshot source" — and, per its own audit, violates two of that phase's explicit principles: it discards non-visible conversation branches and uses positional index as message identity, exactly the "sequence number alone" the spec warns against trusting.

## Conclusion

The repo does not need to be "fixed" against this spec — it was never being
built toward it. This was a scoping exercise to confirm exactly that, with
per-item evidence rather than a plausibility guess, before any of the
7-phase design gets treated as a real backlog.
