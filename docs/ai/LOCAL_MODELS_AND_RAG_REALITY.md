# Local Models, RAG, and Integration Reality — Supplemental

Verified 2026-09-08 (later same day as the main 18-phase audit — this doc answers a rapid follow-up
question set with real data rather than leaving it scattered across chat). Cross-references
[AI_AGENT_INVENTORY.md](AI_AGENT_INVENTORY.md), [LOCAL_MODELS_AND_RAG_REALITY.md's own new checks
below], [MASTER_INTEGRATION_MAP.md](../architecture/MASTER_INTEGRATION_MAP.md).

## 1. Local Ollama models — what's installed, what's integrated, how

| Model | Installed? | Size | Configured for | Portal(s) that call it | Integration mechanism |
|---|---|---|---|---|---|
| `phi4-mini:latest` | ✅ (pulled this session — was missing, real bug, now fixed) | 2.5 GB | `OLLAMA_MODEL_FAST` tier | market-research-portal, sohamyoga-frontend (via shared `OllamaClient`) | Direct REST call to `/api/generate`, non-streaming, via `packages/shared-backend/src/OllamaClient.ts` |
| `qwen2.5-coder:latest` | ✅ (pulled this session) | 4.7 GB | `OLLAMA_MODEL_CODE` tier | Same as above | Same |
| `qwen2.5:latest` | ✅ (pulled this session) | 4.7 GB | `OLLAMA_MODEL_STRONG` tier | Same as above | Same |
| `qwen2.5:latest` (also referenced) | ✅ | — | ai-orchestrator-platform's default model for its own Ollama provider | ai-orchestrator-platform | `backend/app/providers.py`, one of 6 providers in its router |
| `nomic-embed-text:latest` | ✅ installed | — | **Nothing calls it** — confirmed via repo-wide grep, zero real embedding-generation code found anywhere | None | Not integrated — present on the Ollama daemon but unused by any of the 6 portals |
| gemma/gemma2/gemma3/codegemma/shieldgemma family (7 variants) | ✅ installed | — | Not referenced by name in any of the 6 portals' config | None found | Present on the daemon (likely pulled for other, non-sohamyoga work on this shared machine), not part of this repo's real integration |

**Real token/latency data, captured live this session** (via `/api/generate`'s own response fields,
not estimated):

| Model | Latency | Prompt tokens | Completion tokens | Note |
|---|---|---|---|---|
| `phi4-mini:latest` | 1,574 ms | 10 | 30 | Fast, matches its "fast" tier role |
| `qwen2.5-coder:latest` | 71,037 ms | 36 | 2 | Slow on this hardware — likely cold-load dominated (first real call after pulling) |
| `gemma:2b` | 18,921 ms | 29 | 2 | From the earlier `OllamaClient` fix verification |

**What "token" means here, concretely:** `promptTokens` is how many tokens the model had to read
(your input + system prompt); `completionTokens` is how many it generated in response. Both numbers
above are Ollama's own real counts (`prompt_eval_count`/`eval_count` in its API response), not
estimated from character count — this is the same fix from TD-10 (shared `OllamaClient` now surfaces
these instead of discarding them).

## 2. RAG system — confirmed absent, not just undocumented

Repeating and reinforcing [LLD.md's finding](../architecture/sohamyoga-frontend/LLD.md) with fresh
verification: **no chunking, no embedding generation, and no vector retrieval exists anywhere in
this repo's real code.**

- **Chunking:** the only "chunk" match in a repo-wide grep is `ChatGptShareConnector.ts`'s use of
  the term for React Router's "turbo-stream chunk" wire protocol (decoding a shared ChatGPT
  conversation payload) — a completely unrelated meaning, not document/RAG chunking.
- **Embedding:** `nomic-embed-text` is pulled on the Ollama daemon (table above) but zero code in
  any of the 6 portals calls `/api/embeddings` or generates a vector from it.
- **Vector storage/retrieval:** already confirmed absent in the main audit (no pgvector extension,
  no Qdrant, no Pinecone/Weaviate in active use — [DATABASE_ARCHITECTURE.md](../data/DATABASE_ARCHITECTURE.md)).

**Therefore, honestly: there is no chunking strategy to list, no embedding model selection to
justify, and no RAG statistical analysis (retrieval precision/recall, groundedness-via-retrieval) to
report — because the system doesn't exist.** Building one wasn't in scope for this audit and isn't
proposed here without a named use case, per the same Stop-Building discipline applied throughout.

## 3. System/software architecture documents — pointer, not duplication

"System architect doc" and "software architect doc" are already covered and shouldn't be
re-created — see:
- [MASTER_HLD.md](../architecture/MASTER_HLD.md) / [MASTER_LLD.md](../architecture/MASTER_LLD.md) / [MASTER_C4.md](../architecture/MASTER_C4.md) — system-of-systems view
- [ADR/REPO_WIDE_ADRs.md](../architecture/ADR/REPO_WIDE_ADRs.md) — 10 interview-grade architecture decisions
- Per-portal HLD/LLD/C4/ADR under [sohamyoga-frontend/](../architecture/sohamyoga-frontend/)

## 4. Bot UI

The one real chatbot UI is sohamyoga-frontend's `ChatBot.tsx`/`ChatWidget.tsx` (858 lines, per Phase
3's file-size finding) and praveenchatbot's `App.tsx` (773 lines). Both are LEVEL 1 (single
completion call, no tools) per [AGENTIC_MATURITY_MATRIX.md](AGENTIC_MATURITY_MATRIX.md) — nothing
new to add here beyond what that doc already says.

## 5. n8n and routing — status honestly split by verification level

- **n8n**: per prior project memory (not re-verified live this session), a *separate* n8n automation
  stack handles Instagram/Facebook/Reviews/YouTube automation *outside* this repo — explicitly noted
  in memory as "don't rebuild in sohamyoga-frontend." This is a **carried-forward, unverified-this-session**
  fact, not something this audit independently confirmed live. Flagging the provenance rather than
  restating it as freshly checked.
- **Routing feature**: the only real routing logic in this repo is ai-orchestrator-platform's
  `router.py` (keyword/length heuristic across 6 providers), already fully documented in
  [AGENTIC_MATURITY_MATRIX.md](AGENTIC_MATURITY_MATRIX.md). No other "routing feature" exists.

## 6. Tool integrations — pointer, not duplication

Full list already exists at [MASTER_INTEGRATION_MAP.md](../architecture/MASTER_INTEGRATION_MAP.md)
(Vapi, Postiz, Ollama, OpenBao, Skyvern, Google Drive, Slack, Cal.com, ContextForge, etc., each with
real/tested/status). Not re-listed here to avoid drift between two copies of the same table.
