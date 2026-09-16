# C4 Level 2 — Container Diagram: sohamyoga Digital Marketing Platform

**Verified:** 2026-09-15 — grounded in `docker-compose.yml`, `src/cron/CronRegistry.ts`,
`src/lib/postgres.ts`, `ai-orchestrator-platform/backend/pyproject.toml`,
`ai-orchestrator-platform/backend/app/agents/registry.py`.

## Container Diagram

```mermaid
graph TB
    Admin([Admin / Developer]):::actor
    Customer([Customer]):::actor

    subgraph "sohamyoga Docker Compose"
        Nginx[nginx\nReverse proxy\nSSL termination]:::container
        FE[Next.js 14 Frontend\nApp Router · port 3010 container\n221 pages · 383 API routes\n57 domain modules · no ORM]:::container
        BE[SohamYoga.Web\n.NET auth backend\nsession / auth/me endpoints\nseparate SQLite DB]:::container
        PG[(PostgreSQL 16\nport 5437 host / 5432 container\n496 tables\npg pool max=10 no ORM)]:::db
        OB[ollama-bridge\nHTTP proxy to host Ollama]:::container
        OHB[ollama-host-bridge\nHost network bridge]:::container
        CronEngine[Cron Engine\nnode-cron + tsx runner\nsrc/cron/runner.ts\n93 jobs in CronRegistry\n104 job files on disk]:::container
    end

    subgraph "AI Orchestrator (separate process)"
        FASTAPI[AI Orchestrator\nFastAPI · port 8100\nLangChain + LangGraph\nMulti-agent supervisor\nMediaStudio · Operations center]:::container
        SQLITE[(SQLite DB\nAgent runs · test cases\nagent_run / agent_test_case\nagent_test_result)]:::db
    end

    subgraph "Shared npm package (file reference)"
        PKG[@sohamyoga/shared-social-platforms\nPure TypeScript\n36 platforms · tab configs\nscenarios · permissions\nAPI catalog]:::package
    end

    subgraph "Local AI (host process)"
        OllamaHost[Ollama daemon\nport 11434\nqwen2.5 default model\nllama3.2 for orchestrator\nlocal inference]:::ai
        LangFlow[LangFlow\nport 7860\nVisual flow builder\nLangChain visual editor]:::ai
        LangSmith[LangSmith SDK\nAgent run tracing\nTrace ID → admin UI\nexternal dashboard]:::ai
    end

    subgraph "Parallel automation (separate local processes)"
        N8N[n8n local\nParallel automation\nInstagram/Facebook\nReviews/YouTube]:::external
        PostizSrv[Postiz server\nSelf-hosted social scheduler\n12 platforms\ncontainer sohamyoga_postiz]:::external
    end

    TalentsHill[TalentsHill\nSeparate Next.js portal\nDrizzle ORM + better-sqlite3\nShares shared-social-platforms]:::external

    Admin -->|HTTPS| Nginx
    Customer -->|HTTPS| Nginx
    Nginx --> FE
    FE -->|cookie-forward /api/auth/me\n/api/customer/auth/me| BE
    FE -->|raw pg pool\nno ORM| PG
    FE -->|local LLM HTTP| OB
    OB --> OHB
    OHB --> OllamaHost
    BE --> PG
    CronEngine -->|scheduled DB reads/writes| PG
    CronEngine -->|Ollama calls via pool| OllamaHost
    FE -->|internal HTTP| FASTAPI
    FASTAPI --> SQLITE
    FASTAPI -->|LangChain Ollama| OllamaHost
    FASTAPI --> LangSmith
    LangFlow -->|visual chain editor| FASTAPI
    N8N -.->|parallel, separate process| FE
    PostizSrv <-->|REST API gated on POSTIZ_PUBLIC_API_KEY| FE
    PKG -.->|file: reference| FE
    PKG -.->|file: reference| TalentsHill

    classDef actor fill:#d4e6f1,stroke:#2c5282,color:#1a1a1a
    classDef container fill:#1e40af,color:#ffffff,stroke:#1e3a8a
    classDef db fill:#d4edda,stroke:#155724,color:#1a1a1a
    classDef ai fill:#fff3cd,stroke:#856404,color:#1a1a1a
    classDef external fill:#f3e5f5,stroke:#7c3aed,color:#1a1a1a
    classDef package fill:#e8f5e9,stroke:#2e7d32,color:#1a1a1a
```

## Container Descriptions

### Next.js 14 Frontend (primary container)

| Property | Value |
|---|---|
| Framework | Next.js 14.2.35, App Router, `output: 'standalone'` |
| Language | TypeScript 5.9.3, `strict: true` |
| Port | 3010 (container), proxied through nginx |
| Pages | 221 `page.tsx`: 142 admin / 32 customer / ~47 public |
| API routes | 383 `route.ts` across 44 subfolders |
| Domain modules | 57 top-level folders under `src/domain/` |
| DB access | Raw `pg` pool, `src/lib/postgres.ts`, max 10 connections — no ORM (ADR-0001) |
| Auth | Per-route via `getAdminPrincipal()` / `getCustomerPrincipal()` — no central `middleware.ts` |
| Tests | 125 Jest unit test files + 28 Playwright e2e specs + Stagehand browser AI tests |
| Module registry | 188 cataloged modules: 164 real / 23 partial / 1 not_built (live DB, 2026-09-07) |

### PostgreSQL 16

| Property | Value |
|---|---|
| Host port | 5437 |
| Container port | 5432 |
| Tables | 496 tables in `public` schema (live count) |
| Schema management | 144+ domain-sharded `.sql` files — no central migrations folder, no ORM |
| Cross-DB access | One read-only cross-DB path: `market-research-portal` reads via `sohamyoga_ro` role (SELECT only) |

### Cron Engine (separate `cron` container)

| Property | Value |
|---|---|
| Runner | `src/cron/runner.ts` with `node-cron` |
| Registered jobs | 93 entries in `CronRegistry.ts` |
| Job files on disk | 104 `.ts` files in `src/cron/jobs/` |
| Jobs using Ollama | 29 of 93 registered jobs call Ollama |
| Cloud AI tokens | Zero — all AI calls local via Ollama |

### AI Orchestrator (FastAPI :8100)

| Property | Value |
|---|---|
| Framework | FastAPI, Python |
| Port | 8100 |
| Providers | Ollama (local), OpenAI (blocked — vault dev-mode), Anthropic/Claude (blocked — vault dev-mode) |
| LangChain | `langchain>=0.3`, `langchain-ollama>=0.2`, `langchain-community>=0.3` |
| LangGraph | `langgraph>=0.2` — multi-agent supervisor pattern |
| LangSmith | `langsmith>=0.1` — run tracing |
| Agents | supervisor, content_agent, analytics_agent, review_agent, scheduling_agent |
| DB | SQLite (`data/agents.db`): `agent_run`, `agent_test_case`, `agent_test_result` |
| Bridge | `app/bridge.py` imports `agentic-ollama-platform` engine via sys.path — avoids duplicating Ollama logic |
| Modules | MediaStudio (`app/media.py`), Operations center (`app/operations.py`) |

### Shared Package

| Property | Value |
|---|---|
| Package name | `@sohamyoga/shared-social-platforms` |
| Location | `packages/shared-social-platforms/` |
| Consumers | sohamyoga-frontend (via `transpilePackages`), TalentsHill (via `file:` dependency) |
| Content | 36 platform configs, tab configurations, scenarios, permissions, API catalog |

### Ollama (host process)

| Property | Value |
|---|---|
| Port | 11434 |
| Default model (sohamyoga-frontend) | `qwen2.5:latest` (`src/lib/ollama.ts`) |
| Model (AI Orchestrator agents) | `llama3.2` (`agents/registry.py`) |
| Circuit breaker | In `@sohamyoga/shared-backend` OllamaClient |

### LangFlow

| Property | Value |
|---|---|
| Port | 7860 |
| Purpose | Visual LangChain flow builder — connects to AI Orchestrator |

### n8n (parallel local process)

| Property | Value |
|---|---|
| Purpose | Instagram / Facebook / Reviews / YouTube automation |
| Coupling | Parallel — not a code dependency in sohamyoga-frontend |
| Source | Project memory — installed in parallel alongside sohamyoga-frontend |
