# Data Governance — Phase 4

Verified 2026-09-08.

## PII inventory (real, queried)

67 columns across the `sohamyoga` database match PII-pattern names (`email|phone|ssn|date_of_birth|dob|address`).
No `ssn`/government-ID columns were found in the pattern match — the real PII surface is
email/phone/address/DOB, consistent with a yoga-studio + marketing-suite domain (customer contact
info), not financial/health-record-grade sensitive data. No column-level encryption exists for any
of them (Phase 7 finding, re-confirmed here).

## Data classification (inferred from schema + domain purpose, not a formal DPO-reviewed policy)

| Class | Examples | Current protection |
|---|---|---|
| Direct PII | customer email, phone, address | Application-level auth gates only; no encryption at rest, no column masking |
| Indirect/behavioral | booking history, pose-mastery scores, wellness journal entries | Same — auth-gated, unencrypted |
| Credentials | password hashes (scrypt/Argon2id/ASP.NET Identity per portal — see [SECURITY_ARCHITECTURE.md](../security/SECURITY_ARCHITECTURE.md)) | Properly hashed, never stored plaintext (verified across all 6 portals) |
| Business-confidential | pricing, campaign strategy, competitor intelligence | Auth-gated only |
| Vendor secrets | Vapi/Postiz/Google API keys | Mixed — OpenBao vault (currently degraded, dev-mode) + plain env vars depending on portal |

## Retention & archival

**Finding DB-06 (Medium):** no retention policy or archival job was found for any portal's
transactional data — the only exceptions are SohamYoga.Web's `DataCleanupService` (purges
`ApiRequestLog` >30 days and `AuditLog` >90 days, confirmed real and running per Phase 1) and
market-research-portal's `security_scan_run`/`security_finding` fingerprint-dedup (not deletion,
just non-duplication). Customer PII, booking history, and chat messages have no documented retention
period anywhere in this repo — everything accumulates indefinitely by default.

## Data lineage

Not formally tracked (no lineage/catalog tool found in any portal). The module-registry system
(`schema_tables` JSONB array per module) is the closest thing to a lineage map that exists, and it's
real and queryable — see [MASTER_DEPENDENCY_MAP.md](../architecture/MASTER_DEPENDENCY_MAP.md) for
the one real cross-database lineage path found (market-research-portal's read-only pull from
sohamyoga's pricing/reviews tables).

## Compliance posture (stated honestly — not a legal assessment)

This audit is an engineering evidence-gathering exercise, not a legal/compliance review. What can be
said from the evidence: no GDPR/CCPA-style data-subject-request tooling (export/delete-my-data) was
found in any portal; no consent-management system beyond sohamyoga-frontend's
`marketing_consent_suppression` module (real, confirmed built, but scoped to marketing
opt-out/suppression specifically, not a general data-subject-rights system). If this system is ever
used with real customer data at scale, a real legal/compliance review — separate from this
engineering audit — would be needed before claiming any regulatory compliance.

## Recommendation (not implemented — a proposal)

Given PII exists but the system is pre-revenue/single-operator per project memory, the
highest-leverage next step is not encryption-at-rest (meaningful effort, limited value at current
scale) but **the database backup gap in [MIGRATION_STRATEGY.md](MIGRATION_STRATEGY.md) DB-05** — losing
customer PII to a bad DELETE with no backup is a more realistic near-term risk than a data breach at
current scale and traffic.
