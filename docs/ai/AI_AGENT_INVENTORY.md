# AI/Agent Inventory — Phase 10

Verified 2026-09-08. Every real AI/LLM use case found across all 6 portals during this audit,
consolidated. Per the audit framework's own instruction: **do not call a prompt chain an "agent"
unless it has meaningful autonomy/tool use.**

| Use case | Portal | Business objective | Why AI (not deterministic code) | Model | Tools/RAG | Output validation | Human approval | Cost/latency tracked? |
|---|---|---|---|---|---|---|---|---|
| AI Assistant (customer chatbot) | sohamyoga-frontend | Answer customer questions | Natural-language Q&A doesn't reduce to rules | Ollama (local) | None — no tool calls, confirmed via code read (`ChatBot.ts`, 121 lines, no tool/function_call reference) | None found | No | No |
| AI Onboarding Assistant | sohamyoga-frontend | Guide new customer setup | Same | Ollama | None | Unverified this pass | Unknown | No |
| AI Campaign Optimization Loop | sohamyoga-frontend | Suggest campaign adjustments | Pattern recognition across campaign metrics | Ollama | None confirmed | Unverified | Unknown | No |
| Research-AI Draft Job | market-research-portal | Draft grounded research notes per pipeline phase | Synthesizing free-text research content | Ollama (`phi4-mini`/`qwen2.5`) | None (no external tool calls) | **Yes — real, deterministic post-hoc fact-check**: regex-verifies every $/% figure in the output against the source grounding text, rejects if unsupported (62 succeeded / 16 rejected / 41 failed, live counts from Phase 1) | Implicit — output surfaces in an admin-reviewed Report tab | Partial — `phase_run_ai_log` records model + char counts |
| Security scanning (SAST/DAST/SCA/IaC) | sohamyoga-frontend | Find real vulnerabilities | N/A — **not AI at all**, real CLI tools (semgrep/ZAP/npm audit/trivy) wrapped in code | None | N/A | Tool-native (each scanner's own finding format) | Admin triages findings | N/A |
| Multi-provider chat (praveenchatbot) | ai-orchestrator-platform | Personal ChatGPT-style assistant | Natural-language interaction | 6 providers (Ollama/LM Studio/llama.cpp/LocalAI/OpenAI/Claude) | None — single completion call per turn, explicitly self-documented as not streaming/not multi-step | None | No | Partial — `response_cache`, `tasks` tables track some data |
| Filesystem workspace "ask about this file" | ai-orchestrator-platform | Help navigate project files | N/A — this is deterministic file browse/search/grep, not AI | None | N/A | N/A | N/A | N/A |
| MCP Gateway (29 registered tools, 3 real) | sohamyoga-frontend | Expose internal ops as MCP tools for external LLM callers | Tools are called BY an external LLM agent (e.g. Claude Code), not autonomously invoked by this app's own AI | N/A (tool provider, not tool consumer) | N/A — `internal-tool-execution.ts` (69 lines) is a deterministic dispatcher, no LLM decision-making found in it | N/A | Depends on the calling agent | No |
| Vapi voice assistant (call handling) | voice-agent-platform | Handle a phone call conversationally | Real-time voice conversation | Vapi-hosted (not this app's own LLM call) | Vapi's own tool-calling, not verified independently this pass | Vapi-native | N/A | No |
| Spatial Learning "ask_tutor" | market-research-portal | Answer questions in a 3D lesson | **N/A — confirmed NOT AI**: templated/canned responses off static `knowledge.explanation` text, verified in Phase 1 | None (deterministic) | N/A | N/A | N/A | N/A |
| Construction Twin floor-plan detection | market-research-portal | Auto-detect rooms/walls from a photo | **N/A — confirmed NOT AI**: classical computer vision (OpenCV Hough/contour + Tesseract OCR), verified in Phase 1 | None | N/A | Confidence score written back to DB | N/A | N/A |

## What's conspicuously absent

No RAG (retrieval-augmented generation) pipeline exists anywhere in this repo — Qdrant/vector-DB
usage is confirmed absent (Phase 1 LLD finding), so any "knowledge base" style AI feature is either
not built or uses static/templated content instead (as Spatial Learning's tutor does). No agent
framework (LangChain, AutoGPT-style loop, CrewAI, etc.) is used anywhere — every AI call found is a
direct provider SDK/REST call.
