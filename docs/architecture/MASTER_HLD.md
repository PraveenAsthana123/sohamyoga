# Master High-Level Design — Repository-Wide

Verified 2026-09-08. System-of-systems view; each portal's own HLD (where one exists, e.g.
[sohamyoga-frontend/HLD.md](sohamyoga-frontend/HLD.md)) remains the detailed source for that portal.

## What this repository actually is

Not one application — **6 independently-deployed, independently-databased applications** sharing a
workspace, a filesystem, and (mostly) a single operator (Praveen). The unifying business thread,
per project memory, is that sohamyoga-frontend is fundamentally a generic enterprise digital-marketing
suite (yoga is one vertical, not the primary product); the other 5 portals are either infrastructure
for that suite's operators (voice-agent-platform, market-research-portal), personal tools
(password-manager, ai-orchestrator-platform), or the suite's own legacy auth backend (SohamYoga.Web).

## Architecture style: modular monolith per portal, no microservices, no shared platform layer

Each of the 6 portals is itself a modular monolith (sohamyoga-frontend most prominently: 57 domains,
one Next.js process, one Postgres instance). There is **no shared platform/microservices layer**
connecting them — see [MASTER_DEPENDENCY_MAP.md](MASTER_DEPENDENCY_MAP.md) for the complete (short)
list of real cross-portal coupling. This is a defensible choice for the current scale (single
operator, no team to coordinate service boundaries with) — converting any of this into
microservices would be premature per the audit framework's own instruction not to do so without a
proven reason, and no such reason was found in this audit.

## The 6 portals at a glance

| Portal | Real purpose | Scale (Phase 1) | Deployment | DB |
|---|---|---|---|---|
| sohamyoga-frontend | Enterprise marketing suite + yoga vertical | 57 domains, 221 pages, 383 API routes, 174 real modules | Docker (`docker-compose.yml`), healthy | Postgres, 496 tables |
| SohamYoga.Web | Legacy/parallel .NET auth + content backend | ~20 controllers | Docker, healthy | Separate SQLite |
| market-research-portal | 17-phase research pipeline + voice AI + content factory | 78 tables, 25+ modules | systemd (transient unit, now also a persistent cron unit added this session) | Own Postgres |
| voice-agent-platform | Vapi call/script/contact config platform | 17 tables, 20 modules | Docker (`voiceagent-app`, currently stopped per Phase 1 — not yet restarted) | Own Postgres |
| password-manager | Personal zero-knowledge credential vault | 3 tables | Not deployed (container was stopped, app never run end-to-end) | Own Postgres |
| ai-orchestrator-platform | Personal multi-provider chat UI ("praveenchatbot") | 6 LLM providers, filesystem workspace | systemd (fixed this session — was down 4+ days) | SQLite |

## Cross-cutting architectural findings (from Phases 1 & 7, restated at HLD level)

1. **No async messaging/event bus anywhere** — every cross-component call is synchronous HTTP or a
   scheduled DB pull. See [MASTER_DATA_FLOW.md](MASTER_DATA_FLOW.md).
2. **No shared auth library** — 6 portals, 5 independently-implemented session/auth systems (2 of
   the 6 share one .NET backend). See [SECURITY_ARCHITECTURE.md](../security/SECURITY_ARCHITECTURE.md) §1.
3. **No shared observability layer** — each portal logs to its own store; no centralized log
   aggregation, tracing, or metrics platform found anywhere in this repo (confirmed absent, not
   assumed — see Phase 11).
4. **Database isolation is strict** — exactly one cross-DB read path in the entire repo, role-enforced.
5. **No portal uses a message queue, Redis, or any caching layer** — confirmed absent in every
   `docker-compose.yml`.
6. **Security posture is consistent-but-incomplete across portals** — the same gaps (no CSRF token,
   no CI security gate, inconsistent rate limiting) repeat independently in each of the 5
   custom-built auth systems, per Phase 7.

## What "production-ready" would require at the HLD level (not implemented, stated for planning)

A shared auth/session library (closing finding #2), a minimal event bus or webhook-relay pattern if
any real-time cross-portal feature is ever needed (currently none is), and centralized
logging/tracing (closing finding #3) would be the three highest-leverage HLD-level changes — each
is a genuine architectural decision requiring its own ADR, not something to bolt on silently. See
[ADR/](ADR/) for the decision-record format already established for sohamyoga-frontend.
