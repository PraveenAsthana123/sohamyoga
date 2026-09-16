# Architecture Documentation — sohamyoga Digital Marketing Platform

**Last updated:** 2026-09-15  
**Scope:** sohamyoga-frontend (primary), ai-orchestrator-platform, TalentsHill cross-reference  
**Source of truth:** live codebase at `/mnt/deepa/sohamyoga/`

All diagrams in this directory are grounded in direct code reads — real table names, real file
paths, real port numbers, real job names from `CronRegistry.ts`. No generic templates or
aspirational placeholders.

## Existing architecture documents (pre-2026-09-15)

These files existed before this documentation pass and remain authoritative:

| File | Description |
|---|---|
| [MASTER_C4.md](MASTER_C4.md) | C4 L0 system landscape — all 6 portals in the repo |
| [MASTER_HLD.md](MASTER_HLD.md) | High-level design across all 6 portals |
| [MASTER_DATA_FLOW.md](MASTER_DATA_FLOW.md) | Cross-portal data flow map |
| [MASTER_DEPENDENCY_MAP.md](MASTER_DEPENDENCY_MAP.md) | Cross-portal coupling (short, verified) |
| [MASTER_INTEGRATION_MAP.md](MASTER_INTEGRATION_MAP.md) | Every real external integration across all portals |
| [MASTER_LLD.md](MASTER_LLD.md) | Low-level design |
| [sohamyoga-frontend/C4.md](sohamyoga-frontend/C4.md) | C4 L1-L3 for sohamyoga-frontend |
| [sohamyoga-frontend/HLD.md](sohamyoga-frontend/HLD.md) | HLD for sohamyoga-frontend (verified 2026-09-07) |
| [sohamyoga-frontend/LLD.md](sohamyoga-frontend/LLD.md) | LLD: auth gate, DB design, module-registry schema |
| [sohamyoga-frontend/INTEGRATION.md](sohamyoga-frontend/INTEGRATION.md) | Real external integrations for sohamyoga-frontend |
| [sohamyoga-frontend/FEATURES.md](sohamyoga-frontend/FEATURES.md) | Feature status matrix (real/partial/not_built) |
| [sohamyoga-frontend/SECURITY.md](sohamyoga-frontend/SECURITY.md) | Security layers, SAST/DAST/SCA/SBOM inventory |
| [sohamyoga-frontend/ATAM.md](sohamyoga-frontend/ATAM.md) | Architecture tradeoff analysis |
| [sohamyoga-frontend/ADR/](sohamyoga-frontend/ADR/) | Architecture decision records |
| [FLOW_DIAGRAM.md](FLOW_DIAGRAM.md) | Business process flows |
| [NETWORK_FLOW.md](NETWORK_FLOW.md) | Deployment topology + ports |
| [SEQUENCE_DIAGRAMS.md](SEQUENCE_DIAGRAMS.md) | Top user-flow sequence diagrams |

## New documents (added 2026-09-15)

| File | Description |
|---|---|
| [c4-level1-system-context.md](c4-level1-system-context.md) | C4 L1 — sohamyoga as a black box with all external actors |
| [c4-level2-containers.md](c4-level2-containers.md) | C4 L2 — all deployable units with real ports/counts |
| [c4-level3-components-social.md](c4-level3-components-social.md) | C4 L3 — Social Publishing module components |
| [c4-level3-components-workflow.md](c4-level3-components-workflow.md) | C4 L3 — Workflow & AI Automation components |
| [c4-level3-components-monitoring.md](c4-level3-components-monitoring.md) | C4 L3 — Platform Monitoring & Debugging components |
| [hld-high-level-design.md](hld-high-level-design.md) | HLD: executive summary, principles, module inventory, security, data flow |
| [lld-social-publishing.md](lld-social-publishing.md) | LLD: Social Publishing — DB schema, sequence, state machine, class diagram |
| [lld-workflow-engine.md](lld-workflow-engine.md) | LLD: Workflow Engine — DB schema, execution sequence |
| [lld-multi-agent.md](lld-multi-agent.md) | LLD: Multi-Agent Supervisor — LangGraph agents, SQLite, trace flow |
| [integration-architecture.md](integration-architecture.md) | Integration map: all 36 platforms grouped by connector type |
| [process-flow-affiliate.md](process-flow-affiliate.md) | Affiliate marketing end-to-end process flow |
| [cron-job-registry.md](cron-job-registry.md) | Complete cron job registry — 93 jobs from CronRegistry.ts |

## Key verified facts (do not override without re-checking the source)

| Fact | Source | Value |
|---|---|---|
| Next.js version | `package.json` | 14.2.35 |
| App Router pages | `src/app/` count | 221 pages (142 admin, 32 customer, ~47 public) |
| API routes | `src/app/api/` count | 383 `route.ts` across 44 subfolders |
| PostgreSQL port | `docker-compose.yml` | 5437 (host) → 5432 (container) |
| PostgreSQL tables | live DB count | 496 tables |
| Domain modules | `src/domain/` | 57 top-level domain folders |
| Module registry entries | live DB (2026-09-07) | 188 total: 164 real / 23 partial / 1 not_built |
| Cron jobs in registry | `CronRegistry.ts` | 93 entries |
| Cron job files on disk | `src/cron/jobs/` | 104 files |
| Ollama default model | `src/lib/ollama.ts` | `qwen2.5:latest` |
| AI Orchestrator LLM | `agents/registry.py` | `llama3.2` |
| Social platforms in ref table | `db-schema.sql` seed | 17 rows (schema seed); up to 36 in `shared-social-platforms` package |
| Postiz connector | `ref_social_platform` | 12 platforms via Postiz in social schema seed |
| Frontend port | `docker-compose.yml` | 3010 (container), proxied through nginx |
| AI Orchestrator port | config | 8100 |
| LangChain/LangGraph | `pyproject.toml` | langchain>=0.3, langgraph>=0.2, langsmith>=0.1 (declared deps) |
| Shared package | `packages/shared-social-platforms/package.json` | `@sohamyoga/shared-social-platforms` — 36 platforms |
| TalentsHill coupling | `talentshill/package.json` | `file:../sohamyoga/packages/shared-social-platforms` |
| No Redis / no message broker | `docker-compose.yml` | Confirmed absent in all portals |
| No ORM | `src/lib/postgres.ts` | Raw `pg` pool, confirmed via ADR-0001 |
| Auth middleware | `src/lib/admin-auth.ts` | Per-route, not central `middleware.ts` |
