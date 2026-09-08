# Low-Level Design — sohamyoga-frontend

Grounded in direct code reads on 2026-09-07. Companion to [HLD.md](HLD.md).

## 1. Auth/access gate (actual implementation, not middleware.ts)

There is **no `middleware.ts`** anywhere in the app — access control is enforced per API route
handler, not centrally at the edge. This is a real architectural choice with a real risk (see
[ATAM.md](ATAM.md) sensitivity point S-1).

Two gate helpers in `src/lib/`:

- **`src/lib/admin-auth.ts` — `getAdminPrincipal()`**: calls the .NET backend's
  `${SERVER_API_URL}/api/auth/me` with the forwarded cookie. Requires role in
  `['Admin','Editor','Sales']`, else 403 ("Marketing administrator access is required.").
  401 if unauthenticated, 503 if the auth service is unreachable.
- **`src/lib/customer-auth.ts` — `getCustomerPrincipal()`**: same cookie-forwarding pattern against
  `${SERVER_API_URL}/api/customer/auth/me`; any authenticated customer principal passes (no role
  filter beyond "is a customer").

Usage: `requireAdmin` is called from **230** files under `src/app/api/`; `requireCustomer` from
**38** files (grep-verified). `src/app/admin/layout.tsx` and `src/app/customer/layout.tsx` are
client-side nav shells only — they don't gate access themselves; enforcement happens when the
client hits a protected API route.

`src/domain/security/RolePermission.ts` + `src/domain/security/db-schema.sql` back a finer-grained
role/permission model layered on top of the coarse Admin/Editor/Sales check.

**Ops tier:** no separate "ops" role/tier was found distinct from Admin — API routes split into
customer / admin / public only.

## 2. Database design

- **Engine:** PostgreSQL 16 (`postgres:16-alpine`), confirmed live.
- **Scale:** 496 tables in the `public` schema (live count, `information_schema.tables`).
- **Schema management:** domain-sharded — 144 `db-schema*.sql` files under `src/domain/*/`, one or
  more per domain. **No central `migrations/` folder, no Prisma/Drizzle/TypeORM/Sequelize** — schema
  changes are applied by hand-running the relevant `.sql` file. This is a real scaling risk as the
  domain count grows (see ATAM S-2).
- **Access layer:** raw `pg` pool wrapper, `src/lib/postgres.ts` — no query builder, no ORM.

### Graph DB / vector DB — explicitly not in use

Checked directly, not assumed:

- `grep` across all `.sql` files for `pgvector|neo4j|weaviate|pinecone|qdrant|vector(` matched only
  two false positives: `src/domain/chat/db-schema.sql:79` has a plain `TEXT` column named
  `qdrant_collection` (a label/pointer, not a pgvector column), and
  `src/domain/ecommerce/db-schema.sql:72` has a Postgres full-text-search `to_tsvector` index
  (substring match on "vector(", unrelated to vector databases).
- `grep -i embedding` matched only an unrelated CHECK-constraint enum value in
  `src/domain/marketing/automation-schema.sql:24`.
- Qdrant/Neo4j/LlamaIndex/Apache Jena appear **only as forward-looking spec text** in
  `src/domain/mcp/knowledge-mcp-registry.ts` (`backingServices` array) and in admin UI copy. That
  same admin page (`src/app/admin/integrations/page.tsx`) explicitly documents a prior incident: an
  earlier version claimed 14 services including Keycloak and Qdrant were "connected" with fabricated
  status — since corrected to honest "not connected."
- A `documind-qdrant` Docker container exists on the host but is **not referenced anywhere** in
  `docker-compose.yml` and is not running (`Exited (143) 5 weeks ago`).

**Conclusion: no graph database, no vector database, no pgvector extension in active use anywhere
in this application.** Any future RAG/embedding work starts from zero here, not from an existing
integration.

## 3. Module-registry schema

`src/domain/module-registry/db-schema.sql` defines `module_registry`:

```
app            TEXT CHECK (app IN ('sohamyoga-frontend','market-research-portal'))
module_key     TEXT   -- e.g. 'utm-tracking'
name           TEXT   -- e.g. 'UTM Tracking'
built_status   TEXT CHECK (built_status IN ('real','partial','not_built','not_yet_cataloged'))
user_flow, admin_flow, data_flow, flowchart, user_story,
input_desc, process_desc, output_desc, final_outcome,
job_name, report_location, dashboard_location,
schema_tables TEXT[], demo_use_cases JSONB, integration_platforms JSONB,
missing_items, source_doc, last_verified_at, verified_by
has_user_ui, has_admin_ui   BOOLEAN NOT NULL DEFAULT false   -- see ADR-0004
```

10 incremental seed batch files exist under `src/domain/module-registry/seed-*.sql` — each only
partially populates the table. **The live DB is the source of truth, not any individual seed file.**

## 4. Known documented engineering fixes (found in code comments, not inferred)

- `next.config.js` rewrites use the object form with a `fallback` key specifically to avoid
  swallowing dynamic `/api/**/[id]` routes — the file comments this as a previously-hit real bug
  (matches project memory `nextjs_api_rewrite_routing_bug`).
- `src/domain/security/scanners/iac.ts` notes (dated 2026-09-01) that neither Trivy 0.70.0 nor
  Checkov 3.3.16 can scan `docker-compose.yml` directly — a documented, accepted gap, not an
  oversight.
- `src/lib/web-push.ts` notes the send primitive exists but is not yet wired into
  `NotificationDispatchJob.ts`'s dispatch branch — disclosed gap, not silently incomplete.

## 5. Testing inventory

- Jest unit tests: 125 files under `src/__tests__/`, mirroring `src/domain/*` structure.
- Playwright e2e: 28 spec files under `tests/e2e/` (onboarding, self-service, campaign health,
  funnel engine, viral detection, social provisioning, MCP gateway, market research, consent
  automation, NPS/CSAT, complaint alerts, AI governance, console-error sweep, and more).
- `tests/browser/stagehand-smoke.ts` — AI-driven browser smoke test (Stagehand).
- **Not wired into CI**: `.github/workflows/ci.yml` runs lint + typecheck + build only — no test
  execution step. See [SECURITY.md](SECURITY.md) for the full CI gate inventory.
