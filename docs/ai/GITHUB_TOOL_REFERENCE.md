# GitHub Tool Reference — LLM/Agent Ecosystem Survey

Verified 2026-09-08. A factual survey of ~40 named open-source projects the user asked about
(agent frameworks, observability/eval, search/cache/embedding, gateway/mesh/orchestration),
researched live via the GitHub API/web (not from training-data memory — several entries below
directly contradict what a memory-based answer would have said). **None of these are installed or
used anywhere in this repository** (confirmed separately via `LOCAL_MODELS_AND_RAG_REALITY.md` and
a repo-wide manifest/import grep) — this document is a reference catalog for future evaluation, not
a statement about this codebase's current dependencies.

**Methodology note:** star counts and activity are a 2026-09-08 snapshot and will drift. Where an
agent could not confirm a fact via the GitHub API directly, it's marked as such rather than guessed.

## Corrections worth flagging first (things that would be wrong if stated from memory alone)

| Item | What changed |
|---|---|
| **LangServe** | Archived May 5, 2026 — read-only, superseded by LangGraph Platform |
| **Netflix Conductor** | Archived Dec 13, 2023 by Netflix — the actively-maintained continuation is `conductor-oss/conductor` (Orkes-led, ~32.2k stars), a different org |
| **Hugging Face TGI** | Archived March 21, 2026 — HF's own README now recommends migrating to vLLM or SGLang |
| **GPTCache** | Effectively abandoned — last real commit **July 2025** (14+ months stale), despite GitHub's generic `updated_at` metadata field looking recent; README confirms it no longer adds new API/model support |
| **Ragas** | Org moved from `explodinggradients/ragas` to `vibrantlabsai/ragas` (301 redirect, same repo ID) |
| **Sentence-Transformers** | Org moved from `UKPLab` (academic origin) to `huggingface` |
| **AgentScope** | Org moved from `modelscope/agentscope` to `agentscope-ai/agentscope` |
| **Microsoft AutoGen** | Now in maintenance mode; Microsoft points new users to "Microsoft Agent Framework." The founding team forked to **AG2** (`ag2ai/ag2`), a separate, actively-governed continuation — not a clean rename, two real projects exist |
| **"Microsoft Conductor" vs. Netflix Conductor** | Two real, unrelated projects with the same name — Microsoft's is a small (425 stars) CLI for YAML-defined multi-agent workflows via GitHub Copilot/Anthropic Agents SDKs; not a fork or successor of Netflix's |

## Not found as a specific, canonical project (reported honestly, not guessed)

- **"OpenEval"** — no canonical project by this exact name; closest real match is `langchain-ai/openevals` (plural, 1,190 stars)
- **"Embedding drift"** — no dominant canonical tool; only small academic/research artifacts found (none star-comparable to the other 9 observability tools)
- **"token-frugal LLM gateway"** — generic descriptive phrase, not a project name; several unrelated gateways could loosely fit
- **"Agent Studio"** — too generic; at least 5 unrelated projects share this name, none is "the" canonical one, none is Microsoft-branded
- **"OmniAgentStudio"** — no project with this exact name exists
- **Standalone multi-agent workflow visualization tool** — none confidently identified as independent from the frameworks already listed (LangGraph Studio and AutoGen Studio are both sub-features of their parent frameworks, not separate repos)
- **AgentBoard** — ambiguous; several unrelated small repos share the name, closest named match (`hkust-nlp/AgentBoard`) looks dormant (20 commits)

## Agent / RAG frameworks

| Name | GitHub | Stars | Maintained? | What it does |
|---|---|---|---|---|
| LangChain | `langchain-ai/langchain` | ~146k | Yes, very active | Framework connecting LLMs to data/tools |
| LangGraph | `langchain-ai/langgraph` | ~41.3k | Yes | Stateful agent graph orchestration |
| LangServe | `langchain-ai/langserve` | ~2.3k | **No — archived** | Deploy LangChain chains as REST APIs |
| CrewAI | `crewAIInc/crewAI` | ~58.2k | Yes | Role-playing multi-agent "crews" |
| Microsoft AutoGen | `microsoft/autogen` | ~60.9k | Maintenance mode | Multi-agent apps (see AG2 fork above) |
| AG2 | `ag2ai/ag2` | ~4.9k | Yes | Active continuation of AutoGen |
| Semantic Kernel | `microsoft/semantic-kernel` | ~28.5k | Yes | Microsoft LLM-integration SDK |
| AgentScope | `agentscope-ai/agentscope` | ~31.1k | Yes | Alibaba-backed multi-agent framework |
| Haystack | `deepset-ai/haystack` | ~26.5k | Yes | RAG/agent/semantic-search orchestration |
| Microsoft GraphRAG | `microsoft/graphrag` | ~35.9k | Yes | Knowledge-graph-based RAG |
| LightRAG | `HKUDS/LightRAG` | ~30.3k | Yes | Lightweight dual-layer KG+vector RAG |
| HippoRAG | `OSU-NLP-Group/HippoRAG` | ~4.0k | Plausibly, lower cadence | Human-memory-inspired RAG + PageRank |
| LangConfig | `LangConfig/langconfig` | 67 | Real but tiny/niche | Visual drag-and-drop LangGraph builder |

## LLM Observability / Evaluation

| Name | GitHub | Stars | Maintained? | What it does |
|---|---|---|---|---|
| Langfuse | `langfuse/langfuse` | 34,356 | Yes, very active | LLM tracing/eval/prompt-mgmt platform |
| Ragas | `vibrantlabsai/ragas` | 15,676 | Yes, slower cadence (~6.5mo) | RAG pipeline evaluation |
| Giskard | `Giskard-AI/giskard-oss` | 5,805 | Yes | LLM testing/red-teaming |
| DeepEval | `confident-ai/deepeval` | 18,176 | Yes | Unit-test-style LLM eval metrics |
| TruLens | `truera/trulens` | 3,540 | Yes | LLM/agent evaluation & tracking |
| Arize Phoenix | `Arize-ai/phoenix` | 11,380 | Yes | AI observability/eval platform |
| OpenLIT | `openlit/openlit` | 2,748 | Yes | OTel-native LLM/agent observability |
| Helicone | `Helicone/helicone` | 6,134 | Yes | One-line LLM observability |
| Promptfoo | `promptfoo/promptfoo` | 24,934 | Yes, very active | Prompt/RAG/agent testing + red-teaming |
| OpenAI Evals | `openai/evals` | 19,412 | Slowing (~5mo) | OpenAI's eval framework/registry |

## Search / Cache / Embeddings

| Name | GitHub | Stars | Maintained? | What it does |
|---|---|---|---|---|
| OpenSearch | `opensearch-project/OpenSearch` | 13,686 | Yes, daily | Elasticsearch-fork search/analytics |
| Vespa | `vespa-engine/vespa` | 7,078 | Yes, daily | AI search/recommendation/ranking platform |
| RedisVL | `redis/redis-vl-python` | 425 | Yes | Redis vector-DB Python client |
| GPTCache | `zilliztech/GPTCache` | 8,185 | **No — abandoned** | Semantic response caching |
| Valkey | `valkey-io/valkey` | 27,147 | Yes, very active | Redis fork (Linux Foundation) |
| MTEB | `embeddings-benchmark/mteb` | 3,418 | Yes | Text embedding benchmark suite |
| Sentence-Transformers | `huggingface/sentence-transformers` | 19,079 | Yes, very active | Sentence/text embedding framework |
| semcache | `sensoris/semcache` | 96 | Marginal, real but early | Semantic caching proxy for LLMs |
| Infinity | `michaelfeil/infinity` | 2,932 | Slowing (~5.5mo) | Embedding/reranking inference server |
| HF TEI | `huggingface/text-embeddings-inference` | 5,044 | Yes, active | Rust embedding inference server |
| vLLM Semantic Router | `vllm-project/semantic-router` | 5,670 | Yes, very active | MoE-style LLM routing/control layer |
| Semantic Router (aurelio) | `aurelio-labs/semantic-router` | 3,883 | Yes | Embedding-similarity-based routing |

## Gateway / Service Mesh / Orchestration / Inference

| Name | GitHub | Stars | Maintained? | What it does |
|---|---|---|---|---|
| Portkey | `Portkey-AI/gateway` | ~12.9k | Yes | AI gateway, 1,600+ models, guardrails |
| Istio | `istio/istio` | ~38.4k | Yes, CNCF graduated | Service mesh |
| Kiali | `kiali/kiali` | ~3.6k | Yes | Istio observability console |
| Elasticsearch (ELK) | `elastic/elasticsearch` | ~77.9k | Yes | Search/analytics engine (Elastic Stack core) |
| OpenTelemetry Collector | `open-telemetry/opentelemetry-collector` | ~7.5k | Yes, CNCF | Vendor-neutral trace/metric/log collector |
| Temporal | `temporalio/temporal` | ~22.9k | Yes | Durable-execution workflow platform |
| Conductor OSS | `conductor-oss/conductor` | ~32.2k | Yes | Netflix Conductor's active community continuation |
| vLLM | `vllm-project/vllm` | ~91.3k | Yes, very active | High-throughput LLM inference engine |
| LiteLLM | `BerriAI/litellm` | ~58.3k | Yes, very active | Already installed this session — see LITELLM_GATEWAY_SETUP.md |

## How this maps back to real gaps this audit already found

- **Langfuse, Arize Phoenix, OpenLIT, Helicone** → directly close the AI_OBSERVABILITY.md gap (zero cost/token/latency tracking) more thoroughly than this session's basic OllamaClient logging fix
- **Promptfoo, DeepEval, Ragas, Giskard, TruLens** → directly close PROMPT_REGRESSION_TESTS.md and EVAL_FRAMEWORK.md (zero prompt regression tests, zero eval harness exist today)
- **vLLM Semantic Router, aurelio Semantic Router** → the real "intent-based routing" layer that would sit on top of the LiteLLM gateway just set up, per the earlier architecture discussion
- **Everything else** (Istio, Kiali, ELK, Temporal, OpenSearch, Vespa) → real, well-known, but infrastructure-heavy — not proposed for this single-operator, local-first workspace without a concrete scaling trigger, per this audit's Stop-Building discipline
