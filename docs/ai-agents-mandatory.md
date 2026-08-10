# §92 — `ai-agents/` Mandatory in Every Project

> Per operator 2026-06-08: "all the tool must be part of global policy must use in each project"
> Effective 2026-06-08. Every project Claude creates or maintains MUST scaffold `ai-agents/` from `~/.claude/templates/webllm-cdp-rag-langgraph/ai-agents-deep-folder-template/`.

## 92.1 The brutal rule

> A project without `ai-agents/` re-invents browser automation, voice AI, image generation, RAG retrieval, agent observability, and methodology frameworks every time. The catalog is finite (50 tools across 8 categories) and proven. The cost of scaffolding is ~30 seconds (rsync). The cost of NOT scaffolding is days of operator time per project when each capability is needed first time.

## 92.2 What every project gets

```
ai-agents/
├── README.md                            master index · 50 tools · 8 categories
├── _shared/                             cross-cutting
│   ├── policies/                        §90 catalog + §91 integration
│   ├── catalogs/                        HYBRID_PER_DEPT · RAF_SCENARIOS · TOOL_SETUP · CAPABILITY_MATRIX · MCP_AVAILABILITY · RECOMMENDER_FLAVORS_PER_DEPT
│   ├── datasets/                        download_kaggle_datasets.sh
│   ├── scripts/                         setup_ai_agent_stack.sh · generate_use_case_stubs.py · generate_raf_stubs.py · audit_use_case_stubs.py · scaffold_recommendation_files.py · scaffold_dept_artifacts.py · audit_recommender_flavors.py · audit_dept_artifacts.py · audit_folder_readmes.py
│   ├── examples/                        spec_pipeline/ (GSD → openspec → spec-kit → §43 drill)
│   └── use-cases/                       symlink to docs/use-cases when scaffolded
│
├── [§91 core stack]                webllm · cdp · rag · langgraph
├── [Agent/RPA OSS]                 browser-use · skyvern · ui-tars · openadapt · omniparser · openhands · agentops
├── [Voice/Audio]                   pipecat · livekit · retell-ai · vapi · coqui-tts · cartesia · piper-tts · elevenlabs · deepgram · assemblyai · speechbrain
├── [Image gen/editing]             gimp · fooocus · invokeai · stable-diffusion-webui · comfyui
├── [Survey/Forms]                  limesurvey · formbricks · surveyjs · ohmyform · yakforms
├── [Email/Marketing]               listmonk · postal · mailtrain · keila · sendportal · mautic · dittofeed
├── [Analytics/BI/Workflow]         matomo · metabase · activepieces · mixpost
├── [Spec-Driven Dev]               gsd · bmad · spec-kit · superpowers · openspec
└── [Marketing AI composites]       banner-ai · contact-ai
```

Each tool folder has the uniform `deep/` skeleton:

```
<tool>/deep/
├── README.md                         purpose · cross-links
├── docs/DEEP_DIVE.md                 8-section (overview · arch · install · §91 integration · examples · Top 1% gates · troubleshooting · references)
├── scripts/install.sh                runnable · DRY_RUN supported
├── backend/                          drop-in adapter (per §91 interface)
├── frontend/                         hooks/components if applicable
├── examples/                         smoke tests
└── tests/                            unit + integration
```

## 92.3 Required entry-point scripts (every project)

| Script | Wraps | Purpose |
|---|---|---|
| `./setup.sh` | 7 underlying scripts | Single CLI entry point (10 flags: --status / --bootstrap / --core / --all / --health / --gen-stubs / --audit / --spec-pipeline / --bmad / --dry-run) |
| `./scripts/setup_ai_agent_stack.sh` | per-tool install scripts | Universal installer (48 tool entries · --core / --all / --tool / --dry-run / --help) |
| `./scripts/audit_folder_readmes.py` | §58 + §63 audit | 50 tools × 4 invariants weekly |

## 92.4 Mandatory cron triad (per §70)

Every project installs 3 weekly audits per §70 cron-installer pattern:

```
0  9 * * 1  audit_recommender_flavors.py  # §64.22 · 21 cells     → recommender-audit/
30 9 * * 1  audit_dept_artifacts.py        # §64.29 · 315 cells    → recommender-audit/
0 10 * * 1  audit_folder_readmes.py        # §58/§63 · 200 cells   → folder-readme-audit/
```

## 92.5 Mandatory CI gate (per §47.6)

Every project ships `.github/workflows/audits.yml` running the 3 audits on every push + PR. Non-zero exit fails the build.

## 92.6 Mandatory backend audit API (per §68 read-only surface)

Every project's backend exposes 4 endpoints reading the audit reports:

```
GET  /api/v1/insur/audit/list                      list 3 kinds + latest run timestamps
GET  /api/v1/insur/audit/{kind}/latest             full report (capped 50 KB)
GET  /api/v1/insur/audit/{kind}/history?n=10       last N reports metadata
POST /api/v1/insur/audit/{kind}/run                trigger sync run (60s cap)
```

Read-only invariants per §68.3.

## 92.7 Adoption command (one cmd per new project)

```bash
# From any new project root:
SRC=~/.claude/templates/webllm-cdp-rag-langgraph/ai-agents-deep-folder-template
rsync -a "$SRC/" ./ai-agents/

# Plus the entry-point script + audit/scaffolder scripts:
cp ~/.claude/templates/webllm-cdp-rag-langgraph/setup.sh ./
cp ai-agents/_shared/scripts/*.py scripts/
cp ai-agents/_shared/scripts/setup_ai_agent_stack.sh scripts/
mkdir -p .github/workflows
cp ai-agents/audits.yml .github/workflows/ 2>/dev/null || true

# Optional: install --core deps if Python env ready
./setup.sh --core
```

## 92.8 What's NOT mandatory (operator picks per project)

- Installation of any specific tool (universal installer = on-demand)
- Per-tool API keys (operator decision per integration)
- Frontend UI for any tool (only build when use case demands)
- Production STT/TTS keys (rule-based fallback per §57.7 honest)

## 92.9 What IS mandatory (no exception)

- The `ai-agents/` directory tree (scaffolded)
- All 50 tool README.md + DEEP_DIVE.md + install.sh stubs (§58 + §63)
- `_shared/policies/` + `_shared/catalogs/` + `_shared/scripts/`
- `./setup.sh` entry point + 3 audit scripts + 3 generator scripts
- `.github/workflows/audits.yml` CI gate
- Backend `/api/v1/insur/audit/*` route
- Weekly cron triad installed

## 92.10 Per-§ compliance map

| Catalog content | Codifying § |
|---|---|
| 50 tool deep folders | §58 (folder-README standard) + §63 (two-file convention) |
| 8 categories grouping | §63 (org structure) |
| §91 core stack (webllm/cdp/rag/langgraph) | §91 (browser-native agentic AI) |
| Spec-driven dev tools (gsd/bmad/spec-kit/superpowers/openspec) | §59 (TDDD/DDD/ORF/MDD design approaches) |
| Voice/Audio 11 tools | §46 (TTS consent + watermark) + §90 Block J |
| Image gen 5 tools | §76 + §82.21 (Secure AI · provenance/watermark) |
| Email/Marketing 7 tools | §64.14 + §76.10 Art. 50 (consent) |
| MCP availability catalog | §64.40 (10-layer agentic substrate) |
| Hybrid per-dept matrix | §64.43 (pattern catalog) |
| RAF (Recommender/Anomaly/Fraud) 75 scenarios | §64.22 + §64.23 (per-dept R/A/F mandatory) |
| Recommender 3-flavor per dept | §64.22 (3 flavors mandatory) |
| Demo pipeline (spec_pipeline/) | §43 (drill discipline) + §59 |
| Audit triad (cron + CI + API) | §47.6 (DevSecOps) + §70 (cron pattern) + §68.3 (read-only) |

## 92.11 Composes with

§38.3 · §41.3 · §43 · §46 · §47.6 · §47.7 · §50.7 · §57.5 · §57.7 · §58 · §59 · §63 · §64.2 · §64.3 · §64.4 · §64.13 · §64.14 · §64.22 · §64.23 · §64.25 · §64.27 · §64.29 · §64.32 · §64.34 · §64.40 · §64.43 · §64.44 · §68.3 · §70 · §76 · §80 · §82.7 · §82.21 · §87.4 · §88 · §90 · §91.

## 92.12 The brutal rule (reprise)

> The 50-tool catalog is finite. The §-references are finite. The entry-point script is one file. The cron + CI + API surface is shippable in an afternoon. Re-inventing this per project is the #1 waste pattern §92 prevents. If the project doesn't have `ai-agents/`, the project isn't compliant with §92 — and §92 is non-negotiable.

**Effective date**: 2026-06-08. Files: `~/.claude/policies/ai-agents-mandatory.md`, `~/.claude/templates/webllm-cdp-rag-langgraph/ai-agents-deep-folder-template/` (50 tool folders + _shared/), `~/.claude/templates/webllm-cdp-rag-langgraph/setup.sh`.
