# Sohamyoga — Enterprise Digital Marketing Suite

## Overview

Full-stack enterprise digital marketing suite built with Next.js 14 App Router.
Yoga/wellness is a demo vertical; the platform is purpose-built as a generic
enterprise marketing suite deployable for any industry vertical.

## Tech Stack

- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS
- **Database**: PostgreSQL (self-seeding tables via `CREATE TABLE IF NOT EXISTS`)
- **AI/ML**: Ollama (local-first), HuggingFace Inference API, OpenAI-compatible endpoints
- **Auth**: NextAuth.js with role-based access (Admin / Editor / Sales / HR)
- **Cron**: node-cron (25+ background jobs, in-process)
- **RAG**: Vector embeddings via nomic-embed-text + pgvector-compatible retrieval

## Quick Start

```bash
cp .env.example .env.local
# Fill in DATABASE_URL, NEXTAUTH_SECRET, and any third-party API keys
npm install
NODE_OPTIONS='--max-old-space-size=4096' npm run dev
```

App starts at `http://localhost:3000`.

## Portals

| Portal | URL | Description |
|--------|-----|-------------|
| Admin | `/admin` | Full-stack marketing operations portal (~490 modules) |
| Customer | `/customer` | End-user portal: classes, cart, referrals, social |

## Module Categories (~490 admin modules)

- **AI & Agents**: AI Control Tower, Multi-Agent Tower, Agent Factory, Agent Lifecycle, Agent Communication, AI Governance, AI CoE, RAG Knowledge Base
- **Social Media**: Multi-platform scheduling, compose, analytics, Postiz integration
- **Paid Ads**: Google Ads, Meta Ads, ad groups, campaign management
- **Email & SMS**: Campaign builder, sequences, deliverability
- **Affiliate & Referral**: Networks, publishers, commissions, fraud detection
- **CRM & Leads**: Pipeline, lead scoring, enrichment, outreach
- **Video Content**: Upload, pose detection, AI coach, courses
- **eCommerce**: Cart, checkout, orders, vendors, marketplace
- **Analytics**: Dashboard, attribution, cohort, funnel
- **Events & Booking**: Scheduling, kiosk QR login, attendance
- **Control Towers**: Error, Security, Compliance AI, AgentOps, MCP, Hallucination
- **Vertical Portals**: Real estate, healthcare, legal, insurance, mortgage, immigration, and 15+ more

## Testing

```bash
npm run build                       # TypeScript + Next.js production build
npm test                            # Jest unit tests
npx playwright test                 # Playwright E2E tests
```

## Architecture Patterns

- **API routes**: `src/app/api/` — always `export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'`
- **Admin pages**: `src/app/admin/` — always `'use client'` at top; no `backdrop-blur` (solid `bg-white`/`bg-gray-50` only)
- **Customer portal**: `src/app/customer/`
- **DB**: `src/lib/postgres.ts` — `getPool()` + `pool.connect()` + `try/finally client.release()`
- **Auth**: `src/lib/admin-auth.ts` — `requireAdmin(req)` guard on every admin API
- **Self-seeding tables**: Every API route creates its own tables on first request — no migration runner needed
- **Cron jobs**: `src/cron/jobs/` — 25+ jobs registered in `src/cron/index.ts`, run in-process

## Build Notes

```bash
# Increase heap for large builds:
NODE_OPTIONS='--max-old-space-size=4096' npm run build
```

## Docker Build

Build context must be the **monorepo root** (not the frontend subfolder):

```bash
# From repo root:
docker build -f sohamyoga-frontend/Dockerfile -t sohamyoga-frontend .
```

## Environment Variables

See `.env.example` for the full documented list (~130 variables) with REQUIRED / OPTIONAL
markers and descriptions. Key required variables:

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=http://localhost:3000
```

## Background Jobs

25+ cron jobs run in-process. Registered automatically on server start.
Job schedules and names in `src/cron/jobs/`. Live run history at `/admin/module-registry`.
