# Database Architecture — Phase 4

Verified 2026-09-08 via live queries against `sohamyoga-postgres` (hosts both `sohamyoga` and
`market_research_portal` databases) and `voiceagent-postgres`.

## 1. Scale, per database (live counts)

| Database | Base tables | Views | FKs | Unique constraints | Primary keys | Indexes |
|---|---|---|---|---|---|---|
| `sohamyoga` | 423 | 75 | 478 | 172 | 423 (100% of base tables) | 1,118 |
| `market_research_portal` | 78 | not separately queried | not separately queried | — | — | — |
| `voiceagent-postgres` (17 tables per Phase 1) | 17 | — | — | — | — | — |
| `passwordmanager-postgres` (3 tables per Phase 1) | 3 | — | — | — | — | — |
| SohamYoga.Web SQLite | not counted (EF Core managed) | — | — | — | — | — |
| ai-orchestrator-platform SQLite | not counted | — | — | — | — | — |

**Positive finding:** every one of the 423 base tables in the main `sohamyoga` database has a
primary key (423 PKs / 423 base tables) — the 75 "tables with no PK" flagged by an initial pass
turned out to be VIEWs (which don't have PKs by design), not a real gap. Re-verified before
reporting, per this workspace's evidence discipline.

## 2. Schema organization

All 4 Node-based portals (sohamyoga-frontend, market-research-portal, voice-agent-platform,
password-manager) use the same pattern: **domain-sharded raw SQL files** (`db-schema*.sql`, one or
more per feature domain), applied by hand, no ORM. sohamyoga-frontend alone has 144 such files
across 57 domains. This is architecturally consistent across the workspace (see
[MASTER_LLD.md](../architecture/MASTER_LLD.md)) — not an accident, a repeated deliberate choice.

SohamYoga.Web (.NET) is the sole exception: real EF Core migrations exist
(`SohamYoga/SohamYoga.Web/Migrations/`), auto-generated and versioned.

## 3. Referential integrity & cascade behavior

| FK delete behavior | Count | % |
|---|---|---|
| CASCADE | 255 | 53% |
| NO ACTION | 177 | 37% |
| SET NULL | 46 | 10% |

**Finding DB-01 (Medium):** the majority FK behavior is CASCADE, and — see §4 — **zero tables
anywhere in the `sohamyoga` database implement soft delete**. Combined, this means deleting a parent
row (e.g. a customer, a campaign) can cascade-delete a real chain of dependent business data with no
recovery path other than a full database restore. This is a real, live characteristic of the schema,
not a hypothetical — worth a deliberate decision (accept it for a pre-revenue single-operator system,
or add soft-delete to the highest-value tables) rather than leaving it as an unexamined default.

## 4. Audit fields & soft delete

| Pattern | Tables with it | % of 423 base tables |
|---|---|---|
| `created_at` | 248 | 58.6% |
| `updated_at` | 157 | 37.1% |
| `deleted_at`/`is_deleted`/`soft_deleted` | **0** | **0%** |

**Finding DB-02 (Low-Medium):** audit-field coverage is partial, not universal — 41% of tables have
no `created_at` at all, meaning "when was this row created" is unanswerable for those tables without
external logging. Combined with DB-01, this is the same underlying gap from two angles: no soft
delete and inconsistent audit timestamps together mean data lineage/forensics after an incident
would be genuinely difficult for a meaningful fraction of the schema.

## 5. PII storage

**Finding DB-03 (Medium):** 67 columns across the `sohamyoga` database match PII-pattern names
(email/phone/address/date-of-birth). No column-level encryption was found for any of them (confirmed
absent in Phase 7's encryption-at-rest check — standard for local dev Postgres, but a real gap
before any production deployment handling real customer PII at scale). See
[DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) for the full inventory and handling recommendation.

## 6. Tenant isolation

Not applicable in the SaaS-multi-tenant sense for most portals — sohamyoga-frontend and
market-research-portal are each single-tenant-per-deployment (one business, not many tenants sharing
rows). The one place tenant-style isolation *is* real and verified: voice-agent-platform's
`owner_customer_id` scoping on contacts (Phase 1 finding) and the cross-DB `sohamyoga_ro` read-only
role, which is a genuine, DB-enforced isolation boundary (verified live: INSERT/CREATE denied).

## 7. Hot tables / locking risk

Not load-tested in this pass (no production traffic exists to profile against) — see
[PERFORMANCE_BASELINE.md](../performance/PERFORMANCE_BASELINE.md) (Phase 9) for what performance
data does exist. `module_registry` and the various `*_event_log`/`api_request_log`-style tables are
the most-frequently-written tables based on their role (every admin API request in SohamYoga.Web
writes to `ApiRequestLog`), making them the most plausible future hot-table candidates, but this is
inference from code role, not measured lock contention.
