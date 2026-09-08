# API Standards (current state, not aspirational) — Phase 5

Verified 2026-09-08. What's actually consistent vs. ad-hoc across the repo's ~450+ API endpoints.

| Dimension | Current state | Evidence |
|---|---|---|
| Authentication | Consistent per-portal pattern (cookie-forwarded/DB-backed session), 253/253 verified gated in sohamyoga-frontend (Phase 7) | Reality Matrix, SECURITY_ARCHITECTURE.md |
| Schema validation | **No validation library used anywhere** — zero `zod`/`yup`/`joi`/`ajv`/`class-validator` in any Node portal's `package.json`. 24 files in sohamyoga-frontend use manual inline `if (!body.x)` checks; the remaining ~360 routes' validation depth is unverified in this pass | grep-confirmed |
| OpenAPI coverage | 1 of 6 portals confirmed (SohamYoga.Web/Swashbuckle); FastAPI backend likely has a default one, unconfirmed reachable | API_INVENTORY.md |
| Error contract | **Ad-hoc per route** — no shared error-response helper adopted (CQ-05 in CODE_QUALITY_AUDIT.md); shape is usually `{error: string}` but not formally typed/shared | grep-confirmed |
| Idempotency | Not implemented anywhere (no `Idempotency-Key` header handling found in any portal) | grep-confirmed absent |
| Pagination | **Partial** — 9 of 383 sohamyoga-frontend routes show a `LIMIT`/`OFFSET` or `page`/`limit` query-param pattern; not a repo-wide convention | grep-confirmed |
| Filtering/sorting | Not systematically checked this pass — inferred ad-hoc per route from the pagination finding | Not fully verified |
| API versioning | **None** — no `/v1/`/`/v2/` prefix anywhere in any portal | grep-confirmed absent |
| Request size limits | Not independently verified this pass beyond Next.js/FastAPI framework defaults | Unverified |
| Timeouts | Framework defaults only; no explicit per-route timeout configuration found | Unverified |
| Correlation IDs / tracing | **Real in SohamYoga.Web only** (`CorrelationIdMiddleware`, propagated into Serilog); essentially absent elsewhere — only 2 files in sohamyoga-frontend reference it | grep-confirmed |
| Rate limiting | Covered in [SECURITY_RISK_REGISTER.md](../security/SECURITY_RISK_REGISTER.md) SEC-06/07 — inconsistent, mostly absent | Phase 7 |
| Input sanitization / injection | **No SQL string-interpolation risk found** — 0 hits for template-literal SQL with embedded variables outside parameterized `$1`/`$2` placeholders; 52 files show the correct parameterized-query pattern in sohamyoga-frontend alone | grep-confirmed |
| IDOR (insecure direct object reference) | Not systematically tested this pass (would require per-endpoint authorization-boundary testing, e.g. "can customer A fetch customer B's booking by ID") — flagged as a real gap in this audit's coverage, not claimed clean | Not verified |
| Mass assignment | Not systematically checked — manual validation (24 files) suggests some fields are allowlisted per-route, but this wasn't verified across all 383 routes | Not verified |
| Concurrency | No optimistic-locking (`version`/`etag` column) pattern found in a spot check of `db-schema*.sql` files; market-research-portal's `SelfHealJob` uses real `FOR UPDATE SKIP LOCKED` for its own job-claiming (Phase 1 finding) — the only concurrency-control pattern confirmed in the repo | Phase 1 |

## Recommended standard (proposal, not implemented)

Adopt `zod` (already zero-cost to add, TypeScript-native, no framework lock-in) for new/touched
routes going forward, starting with the highest-traffic public-facing ones (lead capture, booking,
checkout) rather than a big-bang rewrite of 383 files. Standardize the error-response shape via the
existing (but underused) `withApiErrorLog` helper. Both are low-risk, incremental changes — not
proposed for immediate bulk implementation in this audit pass.
