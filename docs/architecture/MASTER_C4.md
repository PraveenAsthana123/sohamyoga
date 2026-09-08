# Master C4 Model — Repository-Wide

System Landscape and Container views across all 6 real portals, synthesized from Phase 1/7
investigation. Verified 2026-09-08.

## L0 — System Landscape

```mermaid
graph TB
    Customer([Customer / public visitor]):::actor
    Admin([Admin / operator]):::actor
    Praveen([Praveen — single operator]):::actor

    SY[sohamyoga-frontend<br/>Enterprise marketing suite<br/>+ yoga vertical]:::system
    SYNet[SohamYoga.Web<br/>.NET auth backend]:::system
    MRP[market-research-portal<br/>Research pipeline + voice AI]:::system
    VAP[voice-agent-platform<br/>Vapi call config]:::system
    PM[password-manager<br/>Zero-knowledge vault]:::system
    AIO[ai-orchestrator-platform<br/>praveenchatbot]:::system
    CF[ContextForge<br/>MCP federation gateway]:::infra
    Shared[shared-backend<br/>npm package]:::infra

    Customer --> SY
    Admin --> SY
    Admin --> MRP
    Admin --> VAP
    Praveen --> PM
    Praveen --> AIO
    SY --> SYNet
    SY -.shared package.-> Shared
    MRP -.shared package.-> Shared
    MRP -.read-only cross-DB.-> SY
    VAP -.MCP federation.-> CF
    SY -.docker network only, no code coupling.-> CF

    classDef actor fill:#bef,stroke:#2c5282
    classDef system fill:#1e40af,color:#fff,stroke:#1e3a8a,stroke-width:2px
    classDef infra fill:#7c3aed,color:#fff,stroke:#5b21b6
```

## Real cross-portal coupling (not aspirational — each edge below is grep/file-confirmed)

| Edge | Type | Evidence |
|---|---|---|
| market-research-portal → sohamyoga (Postgres) | Read-only cross-DB (`sohamyoga_ro` role, GRANT SELECT only, verified live: INSERT/CREATE denied) | `PricingCrossPortalJob.ts`, `ReviewsCrossPortalJob.ts` |
| sohamyoga-frontend + market-research-portal → `@sohamyoga/shared-backend` | Shared npm package (OllamaClient w/ circuit breaker, `withApiErrorLog`) | `packages/shared-backend/package.json` consumers |
| voice-agent-platform → sohamyoga-network (Docker) | Network-level only, for ContextForge MCP reachability — **not a code dependency** | `voice-agent-platform/docker-compose.yml` comment |
| voice-agent-platform ↔ ContextForge | MCP federation (IBM ContextForge, pinned digest, on shared network, loopback-bound) | `deploy/contextforge/README.md`, `voice-agent-platform/src/app/api/mcp/route.ts` |
| sohamyoga-frontend ↔ SohamYoga.Web (.NET) | HTTP, cookie-forwarded auth (`/api/auth/me`, `/api/customer/auth/me`) — **two fully separate databases** (Postgres 496 tables vs. SQLite) | Reality Matrix |
| ai-orchestrator-platform → agentic-ollama-platform | In-process import via `bridge.py` sys.path hack — reuses engine rather than reimplementing | `backend/app/bridge.py` |
| password-manager | **No coupling to any other portal** — fully standalone, own Postgres DB, own auth | Reality Matrix |

## L1 — Container view (representative: sohamyoga-frontend + SohamYoga.Web, the largest pair)

See [sohamyoga-frontend/C4.md](sohamyoga-frontend/C4.md) for the detailed L1-L3 view of this pair —
not duplicated here. This document adds the system-landscape layer that file doesn't cover.

## What ContextForge actually is (real, not aspirational)

A real, deployed IBM ContextForge instance (pinned image digest, not `latest`-floating) runs as an
MCP federation control plane on the shared Docker network. Per its own README: authentication is
mandatory, public/basic-auth/query-string credentials are disabled, and — importantly — its own
documentation explicitly states **"the current `/api/mcp/social` route is an application HTTP
facade, not a protocol-compliant upstream MCP server"** — i.e., not everything that looks
MCP-related in this repo is actually federated through ContextForge yet. This matches the Phase 1
finding that only 2-3 of 29 registered MCP tools in sohamyoga-frontend's own gateway have real
working implementations.
