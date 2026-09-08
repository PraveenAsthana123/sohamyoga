# API Inventory — Phase 5

Verified 2026-09-08. Real counts from Phase 1/7 plus new checks this phase.

| Portal | API surface | Count | Documentation |
|---|---|---|---|
| sohamyoga-frontend | Next.js API routes | 383 route.ts files, 44 top-level subfolders | None — no OpenAPI spec found |
| SohamYoga.Web | ASP.NET Controllers | ~20 controllers | **Real** — Swashbuckle/Swagger configured (`AddSwaggerGen` in `Program.cs`, package `Swashbuckle.AspNetCore 6.5.0`) |
| market-research-portal | Next.js API routes | ~30+ (per Reality Matrix domains) | None found |
| voice-agent-platform | Next.js API routes | ~40 (per Reality Matrix) + 1 real MCP JSON-RPC server (8 tools) | None found for REST; MCP tools are self-describing via the MCP protocol itself |
| password-manager | Next.js API routes | 6 | None |
| ai-orchestrator-platform | FastAPI routes | consolidated mostly in `main.py` (692 lines) | **FastAPI auto-generates OpenAPI/Swagger UI by default** at `/docs` — not independently verified reachable this pass (backend was down for most of Phase 1), but the framework provides it for free unless explicitly disabled (no `docs_url=None` found in `main.py`) |

**Finding API-01 (Medium):** of 6 portals, only 1 (SohamYoga.Web) has an explicitly configured,
verified-present OpenAPI spec; 1 more (ai-orchestrator-platform, FastAPI) likely has one for free
via the framework default but wasn't independently confirmed reachable this pass. The 4 Next.js
portals — which together account for the large majority of the repo's ~450+ API routes — have **no
machine-readable API specification at all**. This matters most for sohamyoga-frontend given its 383
routes.
