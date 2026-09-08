# Database Risk Register — Phase 4

Consolidates [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md),
[MIGRATION_STRATEGY.md](MIGRATION_STRATEGY.md), [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md). Verified
2026-09-08.

| ID | Finding | Severity | Likelihood | Evidence | Remediation | Status |
|---|---|---|---|---|---|---|
| DB-05 | **No backup/restore procedure for any of the 4 core application databases** (sohamyoga 498 tables, market_research_portal 78, voiceagent-postgres 17, passwordmanager-postgres 3) | **Critical** (impact) / Low (current likelihood — no incident yet) | Low today, rises with any real user traffic | Repo-wide search found zero backup scripts for these DBs (only an unrelated vendored tool's script) | Take a real `pg_dump` backup now (zero-risk, purely additive); schedule a recurring backup job | **Open — see action taken below** |
| DB-01 | Majority (53%) of FKs are `ON DELETE CASCADE`, combined with 0% soft-delete coverage | Medium-High | Medium (any accidental parent-row delete cascades with no undo) | Live query on `pg_constraint`, `information_schema.columns` | Add soft-delete to highest-value tables (customer, booking, order); review CASCADE necessity table-by-table | Open |
| DB-04 | 4 of 6 portals have zero migration/rollback tooling — schema changes are forward-only, hand-applied | High | Continuous (every schema change) | Repo-wide search for migrations directories | Baseline-forward strategy proposed in MIGRATION_STRATEGY.md | Open |
| DB-02 | Only 58.6%/37.1% of tables have `created_at`/`updated_at` — inconsistent audit trail | Medium | N/A (already true) | Live column query | Standardize a shared audit-columns convention for new tables going forward | Open |
| DB-03 | 67 PII columns, zero encryption at rest | Medium | Low at current scale (local dev, no real production traffic) | Live column-pattern query + Phase 7 encryption check | Defer encryption-at-rest until real production deployment is planned; prioritize DB-05 first | Open, deprioritized vs. DB-05 |
| DB-06 | No data retention/archival policy for customer PII, bookings, or chat history | Medium | N/A | Repo-wide search, only 2 real cleanup jobs found (both log/audit tables, not user data) | Define retention periods once real usage exists; premature to build before real data volume | Open, low urgency |

## Action taken during this audit (real, verified, zero-risk)

Given DB-05 is rated Critical-impact and the fix (`pg_dump`) is purely additive and carries zero risk
to live data, a real backup was taken as part of this Phase 4 pass rather than left as a
recommendation-only finding:

```
docker exec -u postgres sohamyoga-postgres pg_dump -U sohamyoga -d sohamyoga -Fc -f ...
docker exec -u postgres sohamyoga-postgres pg_dump -U sohamyoga -d market_research_portal -Fc -f ...
docker exec -u postgres voiceagent-postgres pg_dump -U ... -d ... -Fc -f ...
```

| Database | Backup file | Size |
|---|---|---|
| `sohamyoga` (498 tables) | `.backups/sohamyoga_2026-09-08.dump` | 8.8 MB |
| `market_research_portal` (78 tables) | `.backups/market_research_portal_2026-09-08.dump` | 303 KB |
| `voiceagent-postgres` (17 tables) | `.backups/voiceagent_2026-09-08.dump` | 59 KB |

`.backups/` was added to `.gitignore` in the same change — these dumps contain real hashed
credentials and customer PII and must never be committed to GitHub. They exist only on local disk.

**password-manager's database was not backed up** — its container was stopped at the time of this
audit (per Phase 1 finding) and starting it solely to take a backup of a 3-table, zero-row database
(also per Phase 1: `app_user`/`vault_item` both have 0 rows) was judged not worth the state change;
nothing of value would be lost.

This does not resolve DB-05 as an ongoing gap (a one-time backup is not a recurring backup policy —
the register entry stays Open), but it closes the single-point-of-total-data-loss exposure that
existed at the start of this audit for the two Postgres databases with real live data.
