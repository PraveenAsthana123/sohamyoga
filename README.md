# SohamYoga Portal

> A full-stack platform for a yoga studio: public website, admin panel, and customer portal.

---

## Overview

SohamYoga is a multi-role, full-stack web application serving three audiences:

| Audience | Entry Point | Purpose |
|----------|------------|---------|
| **Public** | `/` | Studio website — classes, teachers, products, blog, contact |
| **Admin** | `/admin` | Content management, marketing automation, social publishing, analytics |
| **Customer** | `/customer` | Self-service — bookings, articles, live chat, account |

## Tech Stack

### Backend — .NET 8 ASP.NET Core
- Framework: ASP.NET Core 8 Web API (`SohamYoga/SohamYoga.Web`)
- ORM: Entity Framework Core 8 (SQLite by default; PostgreSQL migration path available)
- Auth: ASP.NET Core Identity + cookie authentication
- Real-time: SignalR (live chat)

### Frontend — Next.js
- Framework: Next.js 14+ (App Router), TypeScript, Tailwind CSS (`sohamyoga-frontend/`)
- Local AI: `/api/ai/*` routes stream from a local Ollama daemon — no cloud AI tokens
- Social publishing: Postiz-backed multi-platform scheduling (`/admin/social`)
- Marketing automation: Ollama-drafted campaigns with human approval gates (`/admin/marketing-command`)

### Infrastructure
- Docker + Docker Compose (`docker-compose.yml`) — Postgres, backend, frontend, cron, Nginx
- Reverse proxy: Nginx (`nginx/nginx.conf`)
- Background jobs: `sohamyoga-frontend/src/cron` — Ollama-driven cron jobs (marketing, SEO, feature-gap advisory, etc.)

## Project Structure

```
sohamyoga/
├── SohamYoga/
│   └── SohamYoga.Web/           # .NET 8 backend — Controllers, Data, Models, Services
│
├── sohamyoga-frontend/          # Next.js frontend
│   └── src/
│       ├── app/
│       │   ├── (public)/        # Home, classes, teachers, products, blog, contact
│       │   ├── admin/           # Admin panel
│       │   └── customer/        # Customer portal
│       ├── cron/                # Ollama-driven background jobs
│       └── domain/              # Domain models + DB schemas, per feature area
│
├── agentic-ollama-platform/     # Local-first Ollama planning/job/RAG platform (separate repo)
├── nginx/                       # Reverse proxy config
├── docker-compose.yml           # Full stack: postgres + backend + frontend + cron + nginx
└── .env.template                # All required environment variables, documented
```

## Getting Started

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [Docker + Docker Compose](https://docs.docker.com/get-docker/) (for containerized run)
- [Ollama](https://ollama.com) (for local AI features — optional but recommended)

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/PraveenAsthana123/yoga.git sohamyoga
cd sohamyoga

# 2. Copy and configure env vars
cp .env.template .env

# 3. Start the .NET backend
cd SohamYoga/SohamYoga.Web
dotnet run
# API available at http://localhost:5062

# 4. Start the Next.js frontend (new terminal)
cd sohamyoga-frontend
cp .env.template .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:5062" >> .env.local
npm install
npm run dev
# Frontend available at http://localhost:3000
```

### Docker Compose (full stack)

```bash
cp .env.template .env
docker compose up -d --build
docker compose ps
```

See [.env.template](.env.template) for the full list of environment variables.

---

## Architecture documentation

Full grounded architecture docs (HLD, LLD, ADRs, ATAM, C4 model, feature status matrix, security
inventory) for `sohamyoga-frontend` — the largest and most active portal in this repo — live under
[`docs/architecture/sohamyoga-frontend/`](docs/architecture/sohamyoga-frontend/):

- [HLD.md](docs/architecture/sohamyoga-frontend/HLD.md) — container topology, tech stack, module map
- [LLD.md](docs/architecture/sohamyoga-frontend/LLD.md) — auth gate implementation, DB design, no graph/vector DB confirmation
- [C4.md](docs/architecture/sohamyoga-frontend/C4.md) — C4 context/container/component diagrams
- [FEATURES.md](docs/architecture/sohamyoga-frontend/FEATURES.md) — real built/partial/not_built matrix, pending list, recorded user stories
- [INTEGRATION.md](docs/architecture/sohamyoga-frontend/INTEGRATION.md) — real external integrations (Google, Postiz, Skyvern, Ollama, Slack, OpenBao, etc.)
- [SECURITY.md](docs/architecture/sohamyoga-frontend/SECURITY.md) — access layers by actor, SAST/DAST/SCA/IaC scanning inventory, SOLID/architecture-style notes
- [ATAM.md](docs/architecture/sohamyoga-frontend/ATAM.md) — tradeoff analysis and open risks
- [ADR/](docs/architecture/sohamyoga-frontend/ADR/) — architecture decision records

**Other portals in this repo** (voice-agent-platform, market-research-portal,
ai-orchestrator-platform, ai-agents) do not yet have this level of documentation — queued as
follow-up work, one portal at a time, rather than produced in bulk without verification.

## Tech / Module / Feature stack at a glance (sohamyoga-frontend, verified 2026-09-07)

| Dimension | Summary | Detail |
|---|---|---|
| Tech stack | Next.js 14 (App Router) + React 18 + TS 5.9, raw `pg` driver (no ORM), Tailwind, Jest + Playwright, self-hosted VAPID push, local Ollama LLM | [HLD.md §3](docs/architecture/sohamyoga-frontend/HLD.md#3-tech-stack-verified-via-packagejson--nextconfigjs--tsconfigjson--dockerfile) |
| Module stack | 57 domain modules under `src/domain/`, 221 pages + 383 API routes under `src/app/` | [HLD.md §4](docs/architecture/sohamyoga-frontend/HLD.md#4-moduledomain-map-57-top-level-folders-under-srcdomain) |
| Feature stack status | **164 real / 23 partial / 1 not_built** (188 cataloged, live DB count) | [FEATURES.md](docs/architecture/sohamyoga-frontend/FEATURES.md) |
| Tool stack | semgrep (SAST), OWASP ZAP (DAST), npm audit (SCA), trivy/checkov (IaC) — real, but in-app/cron-triggered, not CI-gated | [SECURITY.md](docs/architecture/sohamyoga-frontend/SECURITY.md) |
| DB design | Postgres 16, 496 tables, 144 domain-sharded schema files, no graph/vector DB in use | [LLD.md §2](docs/architecture/sohamyoga-frontend/LLD.md#2-database-design) |

---

*Backend seed data intentionally ships without demo services/testimonials/blog content —
populate them through the admin CMS.*
