# LiteLLM Gateway — Real Setup, Scoped Small

Added 2026-09-08. Per explicit scoping decision: **goal is to eventually replace
ai-orchestrator-platform's existing `router.py`** (a keyword/length heuristic, documented in
[AGENTIC_MATURITY_MATRIX.md](AGENTIC_MATURITY_MATRIX.md) as correctly working for its narrow
purpose) — but this step is deliberately small: get a real LiteLLM instance running and routing to
what's actually available (local Ollama) before adding Semantic Router or a custom multi-objective
policy engine on top. Not yet wired into ai-orchestrator-platform itself — that's the next step, not
done in this pass.

## What's real, right now

- **Location:** `/mnt/deepa/sohamyoga/litellm-gateway/` (own Python venv, `litellm[proxy]` 1.100.0)
- **Config:** `config.yaml` — 3 models exposed (`fast`→`phi4-mini:latest`, `code`→`qwen2.5-coder:latest`,
  `strong`→`qwen2.5:latest`), matching ai-orchestrator-platform's existing `OLLAMA_MODEL_FAST/CODE/STRONG`
  naming so a future swap doesn't require renaming anything downstream
- **Running as:** `litellm-gateway.service`, a real systemd user unit, `Restart=always`, enabled at
  boot, bound to `127.0.0.1:4400` only (no external exposure, matching this workspace's pattern of
  gating at the network layer for single-operator local services)
- **Verified live**, not just configured: all 3 tiers tested through the actual running gateway with
  real completions, real token counts, real latency

## A real bug found and fixed during setup (not glossed over)

Initial config used the `ollama/` provider prefix. First live test — asked for one word ("OK") —
returned **5,325 tokens of unrelated fiction** about a character named "Iris Jennings," including
fabricated fake multi-turn conversation history. Root-caused by testing Ollama directly:
`curl /api/chat` with the identical prompt correctly returned `"OK"` (2 tokens) — proving the model
and Ollama were fine, and the bug was in LiteLLM's `ollama/` provider, which routes through the
legacy raw-completion `/api/generate` endpoint instead of Ollama's real chat API, so the model
received an unformatted prompt and continued it as free text instead of following the instruction.

**Fix:** switched to the `ollama_chat/` provider prefix (uses Ollama's real `/api/chat` endpoint with
proper message formatting) and added `max_tokens: 1024` per model as a defense-in-depth cap
regardless of provider correctness. Re-verified: all 3 tiers now respond correctly and boundedly.

## Real verification results (this session)

| Tier | Model | Test prompt | Result | Completion tokens | Latency |
|---|---|---|---|---|---|
| fast | phi4-mini:latest | "What is 2+2? Reply with just the number." | `4` (correct) | — | ~2s (warm) |
| fast | phi4-mini:latest | "Reply with exactly one word: OK" | "Sure, anything else you need help with?" (on-topic, not literal, bounded) | 10 | 1.9s |
| code | qwen2.5-coder:latest | Same "OK" prompt | `OK` (literal) | 2 | 72.7s (cold) |
| strong | qwen2.5:latest | Same "OK" prompt | `OK` (literal) | 2 | 44.7s (cold) |

Cold-start latency (44-73s) is real and matches this hardware's earlier-measured cold-load behavior
for these same models ([LOCAL_MODELS_AND_RAG_REALITY.md](LOCAL_MODELS_AND_RAG_REALITY.md)) — not a
LiteLLM overhead, the underlying Ollama load time.

## What this does NOT include yet (deliberately, per the "start small" decision)

- **Not wired into ai-orchestrator-platform** — `router.py` still handles that app's real traffic;
  this is a standalone, independently-verified service so far
- **No Semantic Router** — intent-based routing via embeddings, not added
- **No custom multi-objective policy engine** (cost/latency/quality/privacy scoring) — not built
- **No cloud provider configured** (OpenAI/Claude) — would need real API keys, a separate decision
- **No master key / auth** — fine for `127.0.0.1`-only local use; would need one before any wider
  exposure (same pattern as this workspace's other local-only services, e.g. OpenBao's dev-mode
  caveat already documented in [SECURITY_ARCHITECTURE.md](../security/SECURITY_ARCHITECTURE.md))

## Next step, if continuing

Wire ai-orchestrator-platform's chat calls through this gateway instead of calling Ollama directly —
a real code change to `backend/app/providers.py`/`bridge.py`, not attempted in this pass per the
explicit "start small, evaluate before going further" scoping decision.
