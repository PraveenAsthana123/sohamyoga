# Platform historical operations ledger

Migration `060-platform-observability` adds the canonical cross-runtime ledger. Migration `061-platform-history-triggers` captures circuit transitions and master changes at database level.

## Canonical data

- `platform_component`: registered TypeScript, .NET, Python, Node and shell components.
- `ai_model_master` and `tenant_ai_model`: installed model master and tenant enable/default policy.
- `service_master`, `business_condition_master`, `text_asset_master`, `product_master`: tenant commercial and content masters.
- Existing `tenant`, `organization`, `app_user`, tax, price, discount and module tables remain authoritative.

## Historical transactions

- `operation_run` → one correlated unit of work with `trace_id` and optional parent.
- `operation_event` → ordered stages, messages and structured details.
- `error_occurrence` → deduplicated error fingerprint, occurrence count and resolution state.
- `model_invocation` → model, purpose, token/character counts, latency, quality and status.
- `integration_call` → provider/API attempt, response, circuit and error reference.
- `circuit_breaker_state` + `circuit_breaker_transition` → current and historical resilience state.
- `data_change_history` → inserts, updates and deletes for canonical master tables regardless of calling language.

Every table has a primary key. Transaction records reference their component, run, tenant, organization, model, error or circuit using foreign keys where the relationship exists. System-level health operations intentionally allow a null tenant; tenant business records do not.

## Collection

`soham-platform-history.timer` runs every minute and records frontend, backend, Paperclip, OpenClaw and Ollama Director health. Next.js records Ollama gateway calls and model streams directly. Python retains its detailed SQLite queue ledger; the cross-runtime PostgreSQL ledger provides the shared operational view.

Admin UI: `/admin/operations-history`. Schema UI: `/admin/schema-catalog`.

## Vector policy

`soham-knowledge-index.timer` indexes an explicit safe allowlist nightly: documentation, architecture/configuration, domain schemas and local AI policy. Customer records, payments, credentials, raw audit payloads and secrets are excluded. “Vectorize everything” is prohibited because it would duplicate sensitive data into a store with different deletion and access semantics.
