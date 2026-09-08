# SohamYoga Portal

> A full-stack platform for a yoga studio: public website, admin panel, and customer portal.

**Last updated:** 2026-09-08 00:55 MDT · Feature counts and portal breakdown verified live against the `module_registry` Postgres table at that moment — see [Tech / Module / Feature stack](#tech--module--feature-stack-at-a-glance-sohamyoga-frontend-verified-2026-09-08) below.

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

## Engineering audit (18-phase, repo-wide, 2026-09-08)

A full evidence-based engineering audit covering all 6 real portals in this repository — start
here: [`ENGINEERING_READINESS_SCORECARD.md`](ENGINEERING_READINESS_SCORECARD.md) (25 dimensions,
scored 0-5 with evidence/weakness/next-action per row) and
[`TOP_10_P0_P1_ACTIONS.md`](TOP_10_P0_P1_ACTIONS.md) (priority-ordered, only high-value items).

- [`docs/evidence/REPOSITORY_REALITY_MATRIX.md`](docs/evidence/REPOSITORY_REALITY_MATRIX.md) — every module's real build status, live-DB-sourced
- [`docs/evidence/ENGINEERING_PROVENANCE.md`](docs/evidence/ENGINEERING_PROVENANCE.md) — 91.8% of commits git-history-provably AI-co-authored
- [`docs/architecture/`](docs/architecture/) — MASTER_HLD/LLD/C4/DEPENDENCY_MAP/DATA_FLOW/INTEGRATION_MAP + 10 repo-wide ADRs
- [`docs/engineering/CODE_QUALITY_AUDIT.md`](docs/engineering/CODE_QUALITY_AUDIT.md)
- [`docs/data/`](docs/data/) — database architecture, migration strategy, governance, risk register
- [`docs/api/`](docs/api/) — API standards, inventory, gap analysis
- [`docs/testing/`](docs/testing/) — test strategy, coverage gaps, quality gates
- [`docs/security/`](docs/security/) — architecture, threat model, CI gates, 17-item risk register
- [`docs/reliability/`](docs/reliability/) — 3 real incidents found and fixed live during this audit
- [`docs/performance/`](docs/performance/) — real measured baselines (no unverified scale claims)
- [`docs/ai/`](docs/ai/) — full AI/agent inventory, LEVEL 0-6 maturity classification
- [`docs/observability/`](docs/observability/)
- [`docs/product/`](docs/product/) — demo catalog, journeys, revenue readiness, MVP scope
- [`docs/governance/`](docs/governance/) — 22-item technical debt register, Stop-Building control
- [`docs/portfolio/`](docs/portfolio/) — FDE case study, interview question bank, PM case study

**Real fixes made during this audit, not just documented:** 2 systemd restart-policy gaps closed
(a 4-day silent outage's root cause), a broken production build rebuilt, nginx's stale-DNS 502
fixed structurally, a missing cron scheduler created, and a real database backup taken.

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
- [PORTALS.md](docs/architecture/sohamyoga-frontend/PORTALS.md) — the same feature matrix regrouped into the 5 real portals (Customer Self-Service, Admin, Yoga Customer-Facing, Digital Marketing, Market Research), plus dedicated Video Editing and Market Research feature call-outs

**Other portals in this repo** (voice-agent-platform, ai-orchestrator-platform, ai-agents) do not
yet have this level of documentation — queued as follow-up work, one portal at a time, rather than
produced in bulk without verification.

## Tech / Module / Feature stack at a glance (sohamyoga-frontend, verified 2026-09-08)

| Dimension | Summary | Detail |
|---|---|---|
| Tech stack | Next.js 14 (App Router) + React 18 + TS 5.9, raw `pg` driver (no ORM), Tailwind, Jest + Playwright, self-hosted VAPID push, local Ollama LLM | [HLD.md §3](docs/architecture/sohamyoga-frontend/HLD.md#3-tech-stack-verified-via-packagejson--nextconfigjs--tsconfigjson--dockerfile) |
| Module stack | 57 domain modules under `src/domain/`, 221 pages + 383 API routes under `src/app/` | [HLD.md §4](docs/architecture/sohamyoga-frontend/HLD.md#4-moduledomain-map-57-top-level-folders-under-srcdomain) |
| Feature stack status | **170 real / 25 partial / 1 not_built** (196 cataloged across both apps, live DB count) | [FEATURES.md](docs/architecture/sohamyoga-frontend/FEATURES.md) · [PORTALS.md](docs/architecture/sohamyoga-frontend/PORTALS.md) |
| Portal breakdown | Customer Self-Service 15/16 real · Admin 7/8 real · Yoga Customer-Facing 36/38 real · Digital Marketing 85/105 real · Market Research 27/29 real | [PORTALS.md](docs/architecture/sohamyoga-frontend/PORTALS.md) |
| Tool stack | semgrep (SAST), OWASP ZAP (DAST), npm audit (SCA), trivy/checkov (IaC) — real, but in-app/cron-triggered, not CI-gated | [SECURITY.md](docs/architecture/sohamyoga-frontend/SECURITY.md) |
| DB design | Postgres 16, 496 tables, 144 domain-sharded schema files, no graph/vector DB in use | [LLD.md §2](docs/architecture/sohamyoga-frontend/LLD.md#2-database-design) |

---

*Backend seed data intentionally ships without demo services/testimonials/blog content —
populate them through the admin CMS.*
