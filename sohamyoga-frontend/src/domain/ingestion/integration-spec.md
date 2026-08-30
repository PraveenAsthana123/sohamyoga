# AI Ingestion — Phase 1: Source Registry & Discovery, Phase 2: Auth/OAuth

Real, scoped-down slice of Phase 1 of a 7-phase multi-source AI-ingestion spec that
originated as a pasted ChatGPT conversation ("Build Google Claude Integration"). Full
audit of the entire 7-phase spec against this repo: `docs/google-claude-integration-spec-gap-analysis.md`
(3 of 306 items were real before this domain existed).

## Why this is scoped down

Phase 1's literal spec (`/tmp/.../scratchpad/phases/phase1.md` at authoring time — not
committed, regenerate via `scripts/chatgpt_share_extract.py` against the same share link
if needed again) asks for 14 Postgres tables, a FastAPI layer, connectors for 15+ source
types with zero credentials available yet (OAuth is Phase 2, not built), 10 dashboards,
P0–P3 alerting, and a 1,000-source chaos test. Building that literally would fabricate a
large amount of dead scaffolding — tables and dashboards for Google Drive/Slack/WhatsApp
discovery that never actually runs, because no connector can authenticate yet.

This implementation instead builds exactly what's real today:

- A source registry (`connector`, `source`, `source_version`, `discovery_run`) that can
  hold any source family, populated so far by **one real connector**:
  `chatgpt_shared_snapshot` (`ChatGptShareConnector.ts`, a TypeScript port of
  `scripts/chatgpt_share_extract.py`'s turbo-stream decoder).
- Every other source family from the spec (`google_drive`, `google_docs`, `google_sheets`,
  `slack`, `google_chat`, `whatsapp`, `facebook_messenger`, `linkedin`, `manual_paste`,
  `txt`, `docx`, `html`, `pdf`, `csv_xlsx`) exists as a `connector` row with
  `status = 'not_configured'` and every capability flag `false` — visible in the registry,
  not fabricated as active. Canonical list: `INGESTION_SOURCE_FAMILIES` in `Connector.ts`.

## Deliberately not built yet

These require either OAuth-based connectors (Phase 2 of the original spec, not built) or
real multi-connector volume to be anything but empty scaffolding, so they're deferred
rather than built as dead tables/UI:

- `source_relationships`, `source_permissions_summary`, `expected_sources`,
  `reconciliation_runs` / `reconciliation_findings`, `quarantine_items` — no second real
  connector exists yet to generate relationships, permission diffs, or reconciliation
  mismatches worth tracking.
- A FastAPI layer — this app is Next.js; its existing `src/app/api/.../route.ts` +
  `requireAdmin()` convention is used instead, doing the same job.
- The spec's mandatory 1,000-source chaos test and P0–P3 alerting — no volume or
  operational history yet to alert on.

Build these when a second real connector (most likely Google Drive/Docs/Sheets, once
Phase 2 auth exists) gives them real data to hold.

## Source lifecycle actually reachable today

`REGISTERED → DISCOVERED → ACTIVE → CHANGED` (on re-check diff) `/ UNAVAILABLE` (fetch
fails). The schema's `ingestion_discovery_status` enum also includes `archived` for
forward compatibility; states requiring real permission tracking from an authenticated
provider (`PERMISSION_CHANGED`, `ACCESS_REVOKED`, `QUARANTINED`) are not implemented as
dead code branches — they'll be added when Phase 2 auth makes them meaningful.

## Sync note

`ChatGptShareConnector.ts` independently reimplements the same turbo-stream decode
algorithm as `scripts/chatgpt_share_extract.py` (Python CLI) and
`~/.claude/scripts/chatgpt_share_extract.py` (global cross-project copy, per the Global
ChatGPT Shared-Link Extraction Policy). Three copies because they run in different
environments (Node web app / standalone CLI / other-project CLI) — keep the decode logic
in sync across all three if ChatGPT changes their share-page format.

## Phase 2: Authentication, OAuth, Secrets

Real, scoped-down slice of Phase 2 (`/tmp/.../scratchpad/phases/phase2.md` at authoring
time). That spec asks for a full enterprise IAM stack — RBAC/ABAC, purpose-based access,
tenant/project isolation testing, optimistic concurrency, break-glass, credential-rotation
monitoring, 3 dashboards, P0-P3 alerts, chaos tests. Built instead:

- `connector_credential` table (`db-schema-auth.sql`) — per-connector OAuth state, vault
  references only, never raw secrets.
- A real Google OAuth2 authorization-code flow (`GoogleOAuthConnector.ts`,
  `connectorCredentialOps.ts`) using `google-auth-library` — this repo's first in-repo OAuth
  exchange handler (the existing Facebook callback just proxies to Postiz, which owns that
  exchange externally).
- A credential-entry admin UI (`/admin/ai-ingestion/auth`) — paste Client ID/Secret, save
  (vault-written), then a real "Connect via Google" button.
- `ConnectorTokenRefreshJob` — real scheduled job, honest no-op until a real connection
  exists.

**Deliberately deferred**, same reasoning as Phase 1's deferrals: full RBAC/ABAC taxonomy
(no distinct AI-agent execution identity exists separate from the human admin's own
session yet — `requireAdmin()` is the real gate today), tenant/project isolation testing
(this app is single-tenant in practice), optimistic concurrency / `STALE_SOURCE_VERSION` /
AI write-provenance timestamps / Google Doc/Sheet AI stamps (no write-capable connector
exists — Phase 1 is read-only by design), break-glass, credential-rotation monitoring,
access recertification, authorization-decision audit schema, monitoring dashboards, alerts,
chaos tests (no real operational history or policy-engine decisions yet to back any of
them). Build these once a write-capable connector (Phase 3+) or real multi-tenant/agent
volume exists to make them non-fabricated.

`googleapis` (the actual Drive/Docs/Sheets API client) is intentionally NOT added yet —
Phase 2 only establishes the auth grant; Phase 5 adds it when making real API calls.

## Shared OpenBao helper duplication (known, not yet consolidated)

`src/lib/openbao.ts` (added for Phase 2) reimplements the same KV-v2 REST pattern already
inlined separately in `src/app/api/config/credentials/route.ts` and `src/lib/skyvern.ts`.
Not consolidated this pass to avoid touching already-working code outside the ingestion
domain — a reasonable future cleanup once a third real consumer justifies it.

## Phase 3: Universal Connector Framework & Adapter SDK

Real, scoped-down slice: a `ConnectorAdapter` interface (`ConnectorAdapter.ts`) and a
generic `CircuitBreaker`, with `ChatGptShareConnector.ts`'s `ChatGptShareAdapter` as the
first (only) real implementation — wired into `chatGptSourceOps.ts` so the abstraction is
actually exercised, not decorative. Deliberately small: the interface only has what one
real connector needs (`read()`), not the full discover/write/webhook/incremental_sync/
history/search capability surface Phase 3's literal spec asks for — extend when a second
connector's real requirements demand it. Deferred: capability manifest JSON beyond
`Connector.ts`'s existing catalog, canonical Message/Document/Spreadsheet envelope types
(only one connector exists), bulkhead/backpressure/DLQ, compliance test suite with mock
providers, connector_sdk repo restructuring — all premature with one real connector.

## Phase 4: File Ingestion, Desktop Folder Monitoring

Real: `LocalFolderAdapter.ts` watches ONE admin-configured folder
(`WATCHED_FOLDER_PATH` env var) for `.txt`/`.md` files — the two formats needing zero
parsing beyond reading UTF-8 bytes, so they're real today. Files over 10MB are flagged
(`LARGE_SOURCE`) and skipped rather than blindly read, per Phase 1's own rule. A single
unreadable file logs a warning and does not abort the scan. `LocalFolderScanJob` (every 15
min) is an honest no-op until the env var is set.

Deferred: DOCX/PDF/HTML/CSV/XLSX/JSON/XML/YAML/ZIP parsers (each needs a real parsing
library and a real use case to justify adding it — speculative format support was exactly
the kind of unused scaffolding this pipeline has avoided elsewhere), active/archive
subfolder lifecycle, file leases, quarantine for macro/encrypted files, sidecar
`.ai-meta.json` metadata, the mandatory 70-file chaos test. Add per-format parsers one at a
time when a real file of that format needs ingesting, not preemptively.

## Phase 5: Google Drive, Docs & Sheets Connector

Real: `GoogleDriveAdapter.ts` (using `googleapis`, newly added) discovers Google Docs/Sheets
via `drive.files.list()`, exports Docs as plain text, reads Sheets' first-tab values —
using the access token Phase 2's OAuth flow stores. One important design note: Drive,
Docs, and Sheets share ONE OAuth grant (Phase 2's scopes already cover all three), so all
discovered items stay under the `google_drive` connector_id with `source_type` set to
`google_doc`/`google_sheet` — matching how Google's own consent screen presents this as
one grant, not three. The separate `google_docs`/`google_sheets` rows in
`INGESTION_SOURCE_FAMILIES` are consequently unused stubs now; not removed this pass to
avoid an unnecessary catalog/DB cleanup, but should not be treated as independently
connectable.

Deferred: Shared Drives, shortcut resolution, multi-tab spreadsheet sub-sources, Slides/
PDF/other Drive file types, permission-summary tracking, incremental sync via
`changes.list` (every scan is currently a full re-list), rate-limit/backoff handling. A
real connected Google account is still needed to exercise any of this live — that's an
action only the account owner can take (create the OAuth app, complete consent).

## Phase 6: Slack, Google Chat, WhatsApp, Facebook Messenger & LinkedIn

Real: Slack got the full treatment — `SlackOAuthConnector.ts` (real OAuth v2
authorization-code flow, no refresh step since classic bot tokens don't expire the same
way) and `SlackAdapter.ts` (real inbound read: `conversations.list` discovers member
channels, `conversations.history` reads recent messages — per Phase 1's own model,
Workspace→source, Channel→source). `connectorCredentialOps.ts` was generalized
(`SCOPES_BY_CONNECTOR` map, `startSlackOAuth`/`handleSlackOAuthCallback`) so the same
`/admin/ai-ingestion/auth` credential form and vault storage serve Slack, not just Google —
this is the multi-provider pattern the other deferred platforms would extend.

**Why the other four are deferred, not just "not gotten to yet":**
- **Google Chat** — reuses Google's existing OAuth grant (cheap to add: one more scope +
  a `GoogleChatAdapter` mirroring `GoogleDriveAdapter`'s shape). Deferred only for time,
  not a real blocker — the next-cheapest addition to this phase.
- **WhatsApp Business** and **Facebook Messenger** — Meta requires an app to go through
  **App Review** (a human Meta review process, days-to-weeks, requiring business
  verification) before these permissions are granted to any app, not just this one — this
  is a real external gate no amount of code can route around, unlike Google/Slack's
  self-serve OAuth app creation.
- **LinkedIn** — messaging-related API access requires LinkedIn's **Partner Program**
  application and approval — same category of real external gate.

Building OAuth plumbing for these three now, before that approval exists, would produce
code with no way to ever be exercised until the user separately completes an external
approval process — exactly the kind of dead-until-credentialed scaffolding this pipeline
has avoided everywhere else. `connectorCredentialOps.ts`'s generic shape (scopes map +
per-provider start/callback pair) means adding any of them later, once approved, is
additive, not a redesign.

Also deferred for Slack itself: threads, reactions, edited/deleted message handling, DMs,
private-channel discovery beyond bot membership, cross-channel identity resolution.

## Phase 7: ChatGPT Shared-Link & Manual Paste Ingestion (broader)

Real: exact cross-registration duplicate detection — `SourceEnvelope.metadata.conversationId`
(the underlying ChatGPT conversation ID, distinct from the share-link URL) is now stored
and checked on every registration. Re-sharing the same conversation under a new URL is
caught with a clear error pointing at the already-registered source, instead of silently
creating a confusing second copy of the same content.

Deferred, same reasoning as elsewhere in this pipeline — each of these needs either a real
downstream consumer that doesn't exist yet, or a real LLM step this phase's own spec
explicitly says comes later:
- **Manual paste ingestion** (pasting raw text instead of a share link) — no UI/route
  accepts arbitrary pasted text yet; would need its own validation/dedup path.
- **Prompt chunking for large conversations** — no downstream consumer (an LLM context
  window, a search index) exists yet that would need chunked text; the full conversation
  is stored as one hash today, which is sufficient for change detection.
- **Topic segmentation, requirement/conflict/supersession extraction** — these are
  genuinely LLM-shaped tasks (this repo has local Ollama available and a proven
  Action/Test/Advise pattern for it), not deterministic code — building them now, with no
  actual downstream requirements-tracking feature to feed, would be exactly the kind of
  ungrounded AI output this workspace's evidence policies warn against.
- **Dashboards, FinOps/cost metrics, security/PII scanning, retention/delete propagation,
  the mandatory 500-prompt synthetic test** — no real operational volume or compliance
  requirement yet to justify them over the registry's existing Dashboard tab.
