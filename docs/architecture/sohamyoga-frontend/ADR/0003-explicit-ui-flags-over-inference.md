# ADR-0003: Explicit `has_user_ui`/`has_admin_ui` booleans instead of text-pattern inference

**Status:** Accepted (in effect)

## Context
`module_registry` originally inferred UI coverage from free-text fields (`user_flow`, `admin_flow`).
`db-schema-dimensions.sql` adds two explicit boolean columns, `has_user_ui` and `has_admin_ui`
(default `false`), with an in-file comment explaining this was added after a prior false positive
from pattern-matching free text.

## Decision
Track UI coverage as explicit, manually-verified booleans, not as something inferred from
description text.

## Consequences
- **Positive:** the module-registry status matrix in [FEATURES.md](../FEATURES.md) can be trusted
  as a real, checked signal rather than a guess.
- **Negative:** requires a human (or verifying agent) to actually set the flag correctly — it does
  not update itself as code changes, so it can go stale without a re-verification pass.
