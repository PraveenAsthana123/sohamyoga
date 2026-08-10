# ai-agents/ · consolidated AI agent stack

Per operator 2026-06-08: "all must be deep folder". 11 tools × `deep/` subdir
each. All §90 + §91 work consolidated here for easy backport · clear ownership ·
single entry point.

## Layout

```
ai-agents/
├── README.md                          ← this index
├── _shared/                           ← cross-cutting
│   ├── policies/                      ← §90 + §91 + integration docs
│   ├── catalogs/                      ← use-case · hybrid · RAF · tool matrices
│   ├── datasets/                      ← Kaggle download script
│   ├── scripts/                       ← generators · audit · setup
│   └── use-cases/                     ← symlink to /docs/use-cases (123 stubs)
│
├── webllm/      deep/ · in-browser LLM via WebGPU                    (§91 stack)
├── cdp/         deep/ · Chrome DevTools Protocol                     (§91 stack)
├── rag/         deep/ · Chroma multi-tenant retrieval                (§91 stack)
├── langgraph/   deep/ · stateful agent DAG                           (§91 stack)
│
├── browser-use/ deep/ · Playwright wrapper · LLM browser automation  (alt to CDP)
├── skyvern/     deep/ · production RPA · vision-first                (alt to CDP)
├── ui-tars/     deep/ · vision-language model 7B                     (vision)
├── openadapt/   deep/ · process recorder                             (training data)
├── omniparser/  deep/ · screenshot → DOM                             (vision)
├── openhands/   deep/ · autonomous coding agent                      (code tasks)
└── agentops/    deep/ · observability/trace/cost SDK                 (cross-cut)
```


## Voice / Audio tools (operator-added 2026-06-08)

11 additional tools for STT · TTS · real-time voice agents · speech toolkits:

```
ai-agents/
├── pipecat/     deep/ · Pipecat OSS voice framework            (Voice agent)
├── livekit/     deep/ · LiveKit WebRTC + agents SDK            (Voice agent)
├── retell-ai/   deep/ · Retell AI SaaS                         (Voice agent)
├── vapi/        deep/ · Vapi SaaS                              (Voice agent)
├── coqui-tts/   deep/ · Coqui OSS multilingual TTS · XTTS-v2  (TTS)
├── cartesia/    deep/ · Cartesia Sonic low-latency TTS SaaS    (TTS)
├── piper-tts/   deep/ · Piper OSS fast offline TTS            (TTS)
├── elevenlabs/  deep/ · ElevenLabs best-in-class TTS SaaS      (TTS)
├── deepgram/    deep/ · Deepgram streaming STT SaaS            (STT)
├── assemblyai/  deep/ · AssemblyAI feature-rich STT SaaS       (STT)
└── speechbrain/ deep/ · SpeechBrain OSS PyTorch toolkit       (Speech toolkit)
```

Per §46 (TTS consent + watermark) · §88.4 G18 (Voice channel) · §90 Block J1 (Voice AI canonical use case).

### Quick install

```bash
./_shared/scripts/setup_ai_agent_stack.sh --tool pipecat --tool deepgram --tool elevenlabs
```

### Voice-stack recommended

| Use case | STT | LLM | TTS | Orchestration |
|---|---|---|---|---|
| Real-time agent (best quality) | Deepgram | Llama-3.1-70B (server) | ElevenLabs | LiveKit + LangGraph |
| Real-time agent (low cost) | Whisper local | Llama-3.1-8B (WebLLM) | Piper TTS | Pipecat |
| SaaS managed (fastest setup) | Retell AI bundles all | — | — | Retell AI |
| Multilingual feature-rich | AssemblyAI | (any) | Coqui XTTS-v2 | Pipecat |
| Lowest latency (sub-200ms) | Deepgram | (any) | Cartesia Sonic | LiveKit |


## Image generation · Survey/Forms · Email/Newsletter (operator-added 2026-06-08)

17 additional tools across 3 categories:

### Image Generation / Editing (5)
```
ai-agents/
├── gimp/                  deep/ · OSS raster image editor          (GIMP)
├── fooocus/               deep/ · Simplified SDXL UI               (image gen)
├── invokeai/              deep/ · Production SDXL/Flux node graph  (image gen)
├── stable-diffusion-webui/ deep/ · A1111 WebUI · most extensions   (image gen)
└── comfyui/               deep/ · Node-based SD workflow           (image gen)
```

### Survey / Forms (5)
```
├── limesurvey/            deep/ · OSS advanced survey · 80+ Q types
├── formbricks/            deep/ · In-product surveys + NPS · React
├── surveyjs/              deep/ · JS library · React/Vue/Angular
├── ohmyform/              deep/ · OSS Typeform alternative
└── yakforms/              deep/ · Framasoft form builder
```

### Email / Newsletter / Marketing Automation (7)
```
├── listmonk/              deep/ · High-perf newsletter manager (Go)
├── postal/                deep/ · OSS mail server (SendGrid alt)
├── mailtrain/             deep/ · OSS Node.js newsletter
├── keila/                 deep/ · OSS Elixir Mailchimp-alt · GDPR-friendly
├── sendportal/            deep/ · OSS Laravel email newsletter
├── mautic/                deep/ · OSS marketing automation
└── dittofeed/             deep/ · OSS customer engagement (Customer.io alt)
```

### Stack decision matrix

| Use case | Image gen | Forms/Survey | Email/Marketing |
|---|---|---|---|
| In-house · best quality | ComfyUI (custom workflows) | LimeSurvey | Mautic (marketing) + Postal (server) |
| Simple · low-friction | Fooocus | Formbricks | Listmonk |
| Embed in product | InvokeAI API | SurveyJS | Dittofeed |
| GDPR-priority | (any OSS) | Yakforms (FR origin) | Keila (Elixir) |
| Multi-channel marketing | InvokeAI | Formbricks | Mautic OR Dittofeed |
| Highest scale newsletter | (n/a) | (n/a) | Listmonk |


## Analytics · BI · Workflow automation · Social media (operator-added 2026-06-08)

4 additional tools across 4 categories:

| Tool | Category | Use |
|---|---|---|
| **matomo** | Web Analytics | OSS GA-alt · GDPR-friendly · self-hosted (port 8080) |
| **metabase** | BI Dashboards | OSS SQL + GUI dashboards · 30+ data sources · embedded (port 3000) |
| **activepieces** | Workflow Automation | OSS Zapier-alt · 200+ connectors · self-hosted (port 8080) |
| **mixpost** | Social Media | OSS Buffer-alt · multi-platform scheduling (port 8080) |

### Quick install

```bash
./_shared/scripts/setup_ai_agent_stack.sh --tool matomo --tool metabase --tool activepieces --tool mixpost
```


## Spec-Driven Development Frameworks (operator-added 2026-06-08)

5 methodology/framework tools that drive the dev process · not runtime tools:

| Tool | Type | Notes |
|---|---|---|
| **gsd** | Goal-Spec-Driven | Goal → Spec → Code methodology · LLM-assisted spec gen |
| **bmad** | Build-Measure-Analyze-Deploy | Already at [`_bmad/`](../_bmad/) in this repo |
| **spec-kit** | GitHub framework | YAML agent contracts · spec→test→impl loop |
| **superpowers** | Claude Code skills | Referenced extensively in `~/.claude/CLAUDE.md` |
| **openspec** | Open spec tooling | YAML/JSON schemas for agent behaviors |

### Composes with §43 (drill) · §47.3 (ADR) · §51 (forensic substrate) · §57 (production grade) · §59 (TDDD/DDD/ORF/MDD) · §64.43 #2 Council · §90 (each use-case stub IS a spec).

### Quick start

```bash
./_shared/scripts/setup_ai_agent_stack.sh --tool gsd --tool spec-kit --tool openspec
```


## Marketing AI composites · L13 + L14 (operator-added 2026-06-08)

2 composite tools that combine existing ai-agents/ pieces:

| Tool | Type | Composite of |
|---|---|---|
| **banner-ai** | Marketing visual gen | Fooocus/ComfyUI image gen + WebLLM copy + template engine + C2PA watermark + a11y |
| **contact-ai** | CRM entity res | sentence-transformers entity res + GNN relationship + bandit routing + per-tenant DB |

Per §90 L13 + L14. §82.21 watermark/provenance MANDATORY for banner-ai. §41.3 multi-tenant MANDATORY for contact-ai.

### Quick install

```bash
./_shared/scripts/setup_ai_agent_stack.sh --tool banner-ai --tool contact-ai
```

## Per-tool deep/ structure (uniform)

Every tool has the same skeleton:

```
<tool>/deep/
├── backend/      ← Python integration code
├── frontend/     ← React hooks · components
├── docs/         ← architecture · setup · troubleshooting
├── scripts/      ← install.sh + utilities
├── examples/     ← sample usage
└── tests/        ← unit + integration
```

## One-cmd install

```bash
./_shared/scripts/setup_ai_agent_stack.sh --help        # show options
./_shared/scripts/setup_ai_agent_stack.sh --core        # §91 essentials
./_shared/scripts/setup_ai_agent_stack.sh --all         # everything
./_shared/scripts/setup_ai_agent_stack.sh --tool agentops --tool browser-use
```

Or per-tool: `./<tool>/deep/scripts/install.sh`

## Master catalogs (in _shared/catalogs/)

| File | Content |
|---|---|
| [AI_USE_CASES.md](_shared/policies/AI_USE_CASES.md) | 80 canonical use cases across blocks A–N |
| [HYBRID_PER_DEPT.md](_shared/catalogs/HYBRID_PER_DEPT.md) | 94 hybrid cells · 21 depts × 5 types |
| [RAF_SCENARIOS.md](_shared/catalogs/RAF_SCENARIOS.md) | 75 Recommender/Anomaly/Fraud × Numerical/Text/Image |
| [TOOL_SETUP.md](_shared/catalogs/TOOL_SETUP.md) | 7-tool setup with code snippets |
| [CAPABILITY_MATRIX.md](_shared/catalogs/CAPABILITY_MATRIX.md) | 21 depts × 31 AI categories |
| [WEBLLM_CDP_RAG_LANGGRAPH.md](_shared/policies/WEBLLM_CDP_RAG_LANGGRAPH.md) | §91 integration architecture |

## Composes with

§64.40 (10-layer agentic stack) · §64.43 (pattern selection) · §64.44 (tool status) · §90 (mandatory AI use cases) · §91 (WebLLM+CDP+RAG+LangGraph default).

## Backport to other projects

```bash
# From insur_project root:
rsync -a --exclude=node_modules ai-agents/ /path/to/other-project/ai-agents/
```

Per share-folder mirror pattern (§63.7 + §58.7).
