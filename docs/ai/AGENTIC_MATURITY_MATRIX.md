# Agentic Maturity Matrix — Phase 10

Verified 2026-09-08. Classification per the framework's LEVEL 0-6 scale, applied strictly — a
prompt call is not an agent just because it's AI-powered.

```
LEVEL 0 — no AI
LEVEL 1 — prompt call
LEVEL 2 — structured AI feature (validated output schema, but single call)
LEVEL 3 — tool-using workflow (the AI itself decides to call tools)
LEVEL 4 — bounded agent (multi-step, constrained autonomy)
LEVEL 5 — multi-agent controlled workflow
LEVEL 6 — production governed agentic system
```

| Use case | Level | Why |
|---|---|---|
| AI Assistant (customer chatbot) | **LEVEL 1** | Single completion call, no tools, no schema validation found |
| AI Onboarding Assistant | **LEVEL 1** | Same pattern |
| AI Campaign Optimization Loop | **LEVEL 1-2** (unverified which) | Not deep-audited this pass — named "loop" but no evidence found of actual multi-step iteration; likely a single suggestion-generation call |
| Research-AI Draft Job | **LEVEL 2** | Single completion call, but with a real, deterministic output-validation gate (fact-check regex) — the validation step is what elevates it above LEVEL 1, not autonomy |
| Multi-provider chat (praveenchatbot) | **LEVEL 1** | Single non-streaming completion per turn, explicitly self-documented as not multi-step |
| MCP Gateway tools | **LEVEL 0 for this app** (it's a tool *provider*) — the *calling* agent (e.g. an external Claude Code session) is the one operating at whatever level it operates at; this app's own code contains no LLM decision loop | The distinction matters: exposing a tool via MCP doesn't make the exposing app "agentic" |
| Vapi voice assistant | **Unverified — likely LEVEL 3+ on Vapi's side**, but that's Vapi's platform, not this repo's code | This repo's code only configures/syncs the assistant; the actual conversational tool-use loop runs inside Vapi's hosted infrastructure, out of this audit's code-reading reach |
| Security scanners | **LEVEL 0** | Not AI at all — real CLI tools |
| Spatial Learning tutor | **LEVEL 0** | Confirmed templated, not AI |
| Construction Twin detection | **LEVEL 0** | Confirmed classical CV, not AI |

## Headline finding

**Zero LEVEL 3+ agentic workflows exist anywhere in this repository's own code.** Every AI
interaction found across all 6 portals is a single, non-autonomous completion call (LEVEL 1) or a
single call with output validation bolted on (LEVEL 2, exactly one instance: Research-AI Draft Job).
This is not a criticism — it matches the codebase's own repeated honesty pattern (Phase 1/8 finding):
nothing in this repo overclaims its AI as more sophisticated than it is. The one place real
tool-calling autonomy might exist (Vapi's voice conversation handling) runs on Vapi's own
infrastructure, not in code this audit can read.

## What LEVEL 3+ would require, if ever pursued (not recommended without a real business case)

A genuine tool-using workflow would need: the LLM call itself returning a structured tool-call
decision (not this app's code deciding which function to call), a loop that feeds the tool result
back to the model, and a stop condition. None of this exists today. Building it is explicitly **not**
recommended as a result of this audit — per the framework's own Phase 18 Stop-Building control, "is
AI actually needed" and "is this more valuable than hardening an existing partial module" both weigh
against speculatively building agentic infrastructure with no named use case driving it.
