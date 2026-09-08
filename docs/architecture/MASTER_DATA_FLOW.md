# Master Data Flow — Repository-Wide

Verified 2026-09-08. The 3 real cross-system data flows in this repo (most data flow is intra-portal
— see each portal's own LLD for that detail).

## Flow 1: Customer auth (sohamyoga-frontend ↔ SohamYoga.Web)

```
Browser --cookie--> sohamyoga-frontend (Next.js)
  --forwards raw cookie header--> SohamYoga.Web /api/auth/me or /api/customer/auth/me
  --queries--> SQLite (ASP.NET Identity tables)
  <--role claims-- SohamYoga.Web
  <--{principal, denied}-- sohamyoga-frontend's getAdminPrincipal()/getCustomerPrincipal()
```
No session data is duplicated into the Postgres `sohamyoga` DB — sohamyoga-frontend holds zero
session state itself, it's a pure pass-through cache-free forward on every request.

## Flow 2: market-research-portal's read-only pricing/reviews sync

```
market-research-portal cron (PricingCrossPortalJob, weekly)
  --SELECT via sohamyoga_ro role (read-only, DB-enforced)--> sohamyoga.pricing_plan_master/price
  --writes--> market_research_portal.phase_run.output_content
```
One-directional, read-only, role-enforced (verified live: INSERT/CREATE denied for that role). No
write-back to sohamyoga from market-research-portal exists anywhere.

## Flow 3: AI provider routing (ai-orchestrator-platform)

```
User message --> praveenchatbot frontend (WS/REST)
  --> backend router.py (keyword/length heuristic, NOT ML)
  --> one of 6 providers: Ollama (local) | LM Studio (local) | llama.cpp (local) | LocalAI (local)
      | OpenAI (cloud, via OpenBao-fetched key) | Claude (cloud, via OpenBao-fetched key)
  --> single non-streaming completion --> SQLite (orchestrator.db: conversations, messages, cache)
  --> WS chunks the already-complete response back to the browser for UX (not real token streaming)
```

## What does NOT flow across portals (explicitly, to prevent a wrong mental model)

- **No customer/user record is shared** across sohamyoga-frontend, market-research-portal,
  voice-agent-platform, or password-manager — 4 separate customer/user identity stores, zero sync.
- **No event bus or message queue exists anywhere in this repo** — every cross-component
  communication found in this audit is either direct DB access (same portal), a cron-scheduled pull
  (market-research-portal's 2 cross-portal jobs), or a synchronous HTTP call (auth forwarding, MCP,
  vendor APIs). This is architecturally significant: it means there is no async decoupling layer,
  and any new cross-portal integration would need to be built as either a new direct-HTTP call or a
  new scheduled pull — see [MASTER_HLD.md](MASTER_HLD.md) for the implication.
- **No shared cache layer** (no Redis anywhere in this repo, confirmed absent in every
  `docker-compose.yml` across all 6 portals).
