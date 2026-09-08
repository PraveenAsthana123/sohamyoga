# ADR-0001: Raw `pg` driver instead of an ORM

**Status:** Accepted (in effect — this is a description of the existing, verified state, not a proposal)

## Context
`package.json` has no Prisma/Drizzle/TypeORM/Sequelize dependency (grep-confirmed). All 496 tables
across 144 domain-sharded `db-schema*.sql` files are accessed through a hand-rolled pool wrapper at
`src/lib/postgres.ts` using the raw `pg` driver (^8.22.0).

## Decision
Use raw SQL via `pg` directly; no ORM, no query builder, no central migrations folder.

## Consequences
- **Positive:** no ORM abstraction tax on top of a 57-domain, 496-table schema; full control over
  query shape and index usage per domain.
- **Negative:** schema changes are applied by hand-running the relevant `.sql` file — no migration
  history/versioning, no automatic rollback, no compile-time query type-checking. This is a real
  scaling risk as the domain/table count grows (see [ATAM.md](../ATAM.md) S-2).
