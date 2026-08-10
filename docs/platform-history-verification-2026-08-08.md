# Platform history verification — 2026-08-08

## Verified

- PostgreSQL migrations `060` and `061` applied transactionally.
- 289/289 public tables have primary keys; 310 foreign keys exist.
- Real Next.js → Ollama Director health call recorded with trace ID and closed circuit.
- Real streamed `gemma3:1b` call recorded in `model_invocation` with purpose, status, prompt/output character counts and latency.
- Database triggers recorded a master-data update and closed → open → closed circuit transitions.
- Cross-runtime systemd collector recorded frontend, .NET backend, Paperclip, OpenClaw and Ollama Director health.
- .NET 8 backend build: 0 warnings, 0 errors.
- Shell syntax checks passed.
- Core Ollama platform tests: 64 passed.
- New/changed TypeScript history, schema, agent and Ollama files have no TypeScript errors; both admin pages return HTTP 200.

## Existing unrelated TypeScript debt

The complete frontend typecheck still reports 37 legacy errors outside the new history implementation:

- 14 campaign fixture readonly/type mismatches.
- 12 `ClassSequence` implementation/test errors.
- 5 membership subscription fixture errors.
- 2 chat MCP registry target/iterator errors.
- 1 each in analytics MCP registry, Plyr options, AOS typings and notification fixtures.

These prevent claiming the entire historical frontend codebase is type-clean. They do not prevent the new operations-history pages from compiling and running.

The unrestricted `pytest` discovery also enters duplicated imported ECC skill-source trees and reports four collection/import-path errors. The supported platform test target is `pytest -q tests`, which passes all 64 tests.
