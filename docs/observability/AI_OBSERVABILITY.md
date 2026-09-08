# AI Observability (LLMOps) — Phase 11

Verified 2026-09-08. Cross-references [Phase 10 AI docs](../ai/) — this document is the
observability-specific lens on the same AI feature inventory.

## What's tracked today, per AI use case

| AI feature | Prompt version | Model version | Token count | Latency | Cost | Output score | Retry count |
|---|---|---|---|---|---|---|---|
| Research-AI Draft Job | No | Yes (`phase_run_ai_log` records model name) | **No** | **No** | **No** | Yes — implicitly, via succeeded/fact_check_rejected/failed status (62/16/41 real historical counts) | **No** |
| Chatbot / onboarding assistant | No | No | No | No | No | No | No |
| praveenchatbot (all 6 providers) | No | Partial (provider name is inherently tracked per-call) | **No** | No | **No** | No | No |
| Vapi assistant sync | No | N/A (Vapi-hosted) | N/A | Real — `vapi_api_audit_log` records `duration_ms` per call | No | N/A | No |

**Finding OBS-01 (Medium-High):** of everything an LLMOps practice would track (prompt version,
model version, token count, latency, cost, output quality score, retry count), only 2 of 7 columns
have any real data anywhere in the repo, and even those (model name, call duration) are partial. **No
portal tracks LLM cost anywhere** — genuinely unknown, repo-wide, what any AI feature costs to run.

## Recommended minimal AI observability additions (proposal, not implemented)

Given the Ollama client already wraps every call (`OllamaClient.ts`, shared across sohamyoga-frontend
and market-research-portal), the lowest-effort highest-value addition is adding token count + latency
logging **inside that one shared wrapper** — it would instantly cover every Ollama call in both
portals without touching call sites individually. This is the same "cheap because it reuses an
existing shared abstraction" pattern already noted favorably in
[MASTER_LLD.md](../architecture/MASTER_LLD.md) for `OllamaCircuitBreaker`.
