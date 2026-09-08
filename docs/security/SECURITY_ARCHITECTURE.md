# Security Architecture — Phase 7 Audit

Verified 2026-09-08. Synthesizes Phase 1 (Reality Matrix) findings plus new Phase 7 investigation
(secrets scan, auth-gate completeness). Cross-references noted per claim.

## 1. Authentication & session model, by portal

| Portal | Mechanism | Session storage | Password hashing | Evidence |
|---|---|---|---|---|
| sohamyoga-frontend | Cookie forwarded to .NET backend (`getAdminPrincipal`/`getCustomerPrincipal` call `${SERVER_API_URL}/api/auth/me`) | Backend-owned (ASP.NET Identity) | N/A here — delegated | [LLD.md §1](../architecture/sohamyoga-frontend/LLD.md) |
| SohamYoga .NET backend | ASP.NET Core Identity, cookie auth | Identity tables in its own SQLite DB | ASP.NET Identity default (PBKDF2-HMAC-SHA256) | [Reality Matrix — SohamYoga.Web](../evidence/REPOSITORY_REALITY_MATRIX.md) |
| market-research-portal | Custom session table (`admin_session`) | Own dedicated Postgres DB | SHA-256 token hash storage, `timingSafeEqual` comparison, 12h TTL | Reality Matrix deep-dive |
| voice-agent-platform | Custom (`admin_session`, `business_customer_session`) | Own Postgres DB | scrypt password hash + timing-safe compare | Reality Matrix — voice-agent-platform |
| password-manager | Custom cookie session, in-memory-adjacent | `app_session` table, SHA-256 token hash | **Client-side PBKDF2 600k (Web Crypto) + server-side Argon2id re-hash** — the strongest of any portal in this repo | Reality Matrix — password-manager |
| ai-orchestrator-platform | Single shared password (`ORCH_AUTH_PASSWORD`), cookie session | **In-memory dict — does not survive backend restart** | N/A (single shared password, not per-user) | Reality Matrix — ai-orchestrator-platform |

**Observation:** 6 portals, 5 different session/auth implementations, no shared auth library. This
is a real architectural cost (each one is a separate attack surface to review and a separate place
a mistake can hide) but not necessarily wrong for a single-operator multi-app workspace — flagged
for the risk register, not prescribed a fix here.

## 2. Authorization / RBAC coverage

**sohamyoga-frontend — verified exhaustively in this pass, not sampled:** all 213 `/api/admin/*`
route files and all 40 `/api/customer/*` route files call `getAdminPrincipal`/`getCustomerPrincipal`
either directly or through one shared handler (`src/domain/video/workspaceApi.ts`'s `videoWorkspace()`,
which itself gates internally) — **253/253 verified, zero gaps found.** No `middleware.ts` exists
(per-route enforcement, not centralized), which remains a structural risk (a *new* route could
forget the check — nothing would catch that until this kind of audit re-runs), but every *existing*
route is correctly gated.

**Scope boundary, stated honestly:** 41 top-level `/api/*` directories outside `/admin` and
`/customer` (e.g. `contact`, `webhooks`, `pricing`, `crm`, `subscriptions`) were not individually
re-verified in this pass — some are legitimately public (contact form, inbound webhooks), others may
contain admin-sensitive writes not gated by directory convention. Recommend as a targeted P1
follow-up, not claimed as covered here.

**Other portals:** role checks confirmed present per-route during Phase 1 (SohamYoga .NET
`[Authorize(Roles=...)]`, voice-agent-platform `requireAdmin`/`requireCustomer`, market-research-portal
`requireAdmin`) but not re-verified exhaustively in this Phase 7 pass the way sohamyoga-frontend was.

## 3. Secrets management

| Mechanism | Where used | Real gap |
|---|---|---|
| OpenBao vault | ai-orchestrator-platform (OpenAI/Claude keys), sohamyoga-frontend (Skyvern credentials) | **Runs in OpenBao `-dev` mode** — in-memory, auto-unsealed, single root token. Confirmed via `docker inspect` (`Cmd: [server -dev]`) and a live `bao secrets list`/`bao kv list` showing an empty store after any restart. This is the single most consequential secrets-management finding in this audit: **any secret stored here is lost on every container restart**, and the vault itself offers none of its normal security properties (sealing, audit logging, real ACLs) in dev mode. |
| `.env`/`.env.local` files | Every portal | Confirmed clean: zero `.env*` files tracked in git (current tree or full history), zero private key blocks, zero AWS-style keys, zero hardcoded JWT/session secrets found via repo-wide grep — see [SECURITY_RISK_REGISTER.md](SECURITY_RISK_REGISTER.md) for the exact commands run |
| Docker Compose default passwords | root `docker-compose.yml` (`POSTGRES_PASSWORD: change-me-before-production`), `integrations/medusa/docker-compose.yml`, `integrations/offerkit/docker-compose.yml` (hardcoded `medusa_pass`/`offerkit_pass`) | Dev-only default credentials on internal Docker networks, not internet-facing — low materiality but worth rotating before any production exposure |

## 4. Network/transport boundaries

- **nginx** sits in front of sohamyoga-frontend + the .NET backend (`docker-compose.yml`) — exact
  header/TLS configuration not yet audited in this pass (pending header-audit sub-task).
- **ai-orchestrator-platform** is exposed via a Cloudflare quick tunnel (`cloudflared`, random
  `*.trycloudflare.com` URL, changes every restart) — password is the *only* gate once tunnel is up,
  per the app's own boot-time check (refuses to start with no `ORCH_AUTH_PASSWORD` set).
- **market-research-portal, voice-agent-platform, password-manager** — no tunnel/reverse-proxy
  found; reachable only on localhost ports unless something external is proxying them (not found in
  this pass).

## 5. Database security posture

- 3 separate Postgres databases in this workspace (`sohamyoga` 496 tables, `market_research_portal`
  78 tables) plus 1 separate SQLite store (SohamYoga .NET) plus password-manager's own Postgres —
  **no shared credential, no shared connection pool** between the major apps (confirmed in Phase 1).
- market-research-portal's cross-DB read access to `sohamyoga` uses a dedicated `sohamyoga_ro` role,
  **verified read-only live** (INSERT/CREATE denied) — this is a genuinely well-scoped pattern, not
  a shared superuser credential.
- Encryption at rest: not configured for local dev Postgres/SQLite in any portal (standard for local
  development; would need explicit disk/volume encryption or a managed DB service before any
  production deployment — not evaluated further here since no portal is currently deployed to a
  production environment with real user PII beyond local seed/test data).

## 6. What this document does not yet cover

Pending the parallel Phase 7 sub-investigations still running at time of writing: CORS/CSP/XSS/CSRF
posture per portal, and a dependency-vulnerability scan (`npm audit` etc.) per portal. Both will be
appended to [SECURITY_RISK_REGISTER.md](SECURITY_RISK_REGISTER.md) and
[THREAT_MODEL.md](THREAT_MODEL.md) in a follow-up commit — not fabricated here to appear complete.
