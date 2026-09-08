# API Gap Analysis — Phase 5

Consolidated from API_INVENTORY.md and API_STANDARDS.md. Verified 2026-09-08.

| Gap | Severity | Affected | Recommendation | Effort |
|---|---|---|---|---|
| No schema validation library on ~450 routes | Medium-High | All 4 Node portals | Adopt zod incrementally, starting with public-facing write endpoints (lead capture, checkout, signup) | Medium |
| No OpenAPI spec for 4 of 6 portals | Medium | sohamyoga-frontend (383 routes), market-research-portal, voice-agent-platform, password-manager | Generate from zod schemas once adopted (zod-to-openapi tooling exists), rather than hand-writing 450 spec entries | Medium, sequenced after validation adoption |
| No API versioning | Low | All 6 | Acceptable today — every API consumer is the portal's own first-party frontend, not a public/third-party integration surface. Revisit only if a public API is ever offered | None needed now |
| No idempotency keys | Low-Medium | All 6, most relevant to payment/order-mutating endpoints | Add for the highest-value mutation endpoints (checkout, invoice generation) if double-submission becomes a real observed problem — no evidence of it happening yet | Low, deferred until evidence of need |
| Inconsistent pagination (9/383 routes) | Low | sohamyoga-frontend | Standardize on the existing 9-route pattern for any new list endpoint | Low |
| IDOR not systematically tested | **Unverified — real audit gap, not a confirmed vulnerability** | All 6 | A dedicated IDOR test pass (attempt cross-tenant/cross-customer ID access on a sample of endpoints) would close this — not attempted in this pass due to scope/time; flagged explicitly rather than silently assumed safe | Medium — needs live testing, not just code reading |
| No correlation ID propagation outside SohamYoga.Web | Low-Medium | sohamyoga-frontend, market-research-portal, voice-agent-platform, ai-orchestrator-platform, password-manager | Cross-portal request tracing is currently impossible (no shared correlation ID crosses the sohamyoga-frontend → SohamYoga.Web boundary consistently, and none of the other portals generate one at all) — see Phase 11 (Observability) for the full implication | Medium |

## What this document does not cover

A live penetration-test-style pass against IDOR, mass assignment, and SSRF specifically was not
performed — Phase 5's evidence comes from static code reading and grep, not dynamic testing against
a running instance with adversarial inputs. This is stated as a real, bounded limitation of this
audit rather than implied as "checked and clean."
