# AI Failure Mode Register — Phase 10

Verified 2026-09-08. Real failure modes, cross-referenced to earlier phases where the same finding
already surfaced from a different angle.

| Failure mode | Where | What happens today | Evidence |
|---|---|---|---|
| LLM provider unreachable (Ollama down) | sohamyoga-frontend, market-research-portal, ai-orchestrator-platform | Circuit breaker opens, fails closed with a clear error — **does not hallucinate or fabricate a response when the model is unavailable** | Phase 1/8 finding, `OllamaCircuitBreaker.ts` |
| Cloud provider key missing/vault down | ai-orchestrator-platform | Reports `no_key` explicitly, does not fall back to fabricating a response from a different unintended provider | Phase 1 finding (this session's own P0 incident) |
| Generated content contains an unsupported figure | market-research-portal's Research-AI Draft Job | **Rejected before reaching the user** — the one real groundedness gate in the repo, 16/119 historical rejections | Phase 10 AI_AGENT_INVENTORY.md |
| Generated content from the chatbot/onboarding assistant is wrong or irrelevant | sohamyoga-frontend | **No detection exists** — no eval, no user-feedback capture confirmed for these specific features, no fact-check gate (unlike Research-AI Draft Job) | Confirmed absent this pass |
| Prompt drift (a code change unintentionally alters a prompt's behavior) | Any prompt-construction code | **No regression protection anywhere** (see PROMPT_REGRESSION_TESTS.md) | This phase |
| Cost overrun from unthrottled AI calls | Any portal with a chatbot | **No token/cost tracking exists** — genuinely unknown what any AI feature costs to run, and no rate limit specifically scoped to AI-calling endpoints beyond the general endpoint rate-limiting gaps already in SECURITY_RISK_REGISTER.md | This phase + Phase 7 |
| Vapi voice AI produces an inappropriate/unsafe response during a real call | voice-agent-platform | **Unknown — Vapi's own safety layer, not independently verified in this audit** (the conversational loop runs on Vapi's infrastructure, out of this repo's code) | AI_AGENT_INVENTORY.md |

## Pattern

The same "honest degradation over fabrication" discipline found throughout this audit (Phases 1, 8)
holds for AI failures specifically too — every *provider-availability* failure mode fails closed
correctly. The gap is entirely in **content-quality failure modes** (wrong/irrelevant/costly output)
rather than availability — and only 1 of 4+ AI features in the repo (Research-AI Draft Job) has any
content-quality gate at all.
