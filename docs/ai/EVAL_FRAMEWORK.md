# AI Eval Framework — Phase 10

Verified 2026-09-08. Current state: no formal eval harness exists anywhere in the repo. This
document records what exists (one real, narrow evaluator) and proposes a minimal framework rather
than fabricating a comprehensive one that isn't built.

## What real evaluation exists today

**Research-AI Draft Job's fact-check gate** (market-research-portal) is the one genuine, automated
AI-output evaluator in the entire repository: a deterministic regex check that every `$`/`%` figure
in the generated text appears verbatim in the source grounding text, rejecting the output if not
(16 of 119 historical runs were rejected this way — real, live evidence, not a hypothetical). This is
a **groundedness** check specifically, not a general-purpose eval framework.

No other AI use case in the repo (chatbot, onboarding assistant, campaign optimization, praveenchatbot)
has any automated evaluation of its output — correctness, relevance, task completion, and safety are
all unverified for every other AI feature found in this audit.

## Proposed minimal eval dimensions (not implemented — a framework proposal)

| Dimension | Applicable to | Proposed method | Effort |
|---|---|---|---|
| Groundedness | Any AI feature generating text from a source (Research-AI Draft Job already has this) | Extend the existing fact-check pattern to the chatbot/onboarding assistant if they ever reference specific data | Low — pattern already exists, needs extension |
| Schema validity | Any AI feature expected to return structured output | None currently return structured/schema-validated output (all are free-text) — would need to define the schema first | Medium |
| Task completion | Chatbot, onboarding assistant | Would need a labeled test-conversation set — doesn't exist | Medium-High |
| Hallucination/correctness | All | No ground truth dataset exists to check against | High — requires building test fixtures |
| Cost/latency/token usage | All | **Not tracked anywhere** — no portal logs token counts or per-call cost | Low to add logging, but currently zero visibility |
| Human intervention rate | All | Not tracked — no signal exists for "did a human have to correct/override the AI output" | Medium |

## Recommendation

Given zero LEVEL 3+ agentic workflows exist (per AGENTIC_MATURITY_MATRIX.md), a full eval harness
(the kind needed for agent tool-selection accuracy, multi-step task completion, etc.) would be
solving a problem this codebase doesn't have yet. The single highest-value, lowest-effort next step
is **token/cost/latency logging** on the existing LLM call sites — currently zero visibility into
what any AI feature actually costs or how slow it is, which is a real gap regardless of whether
formal "evals" are ever built. This is proposed, not implemented in this pass.
