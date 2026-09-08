# Code Quality Audit — Phase 3

Verified 2026-09-08. Metrics are real (`wc -l`, `grep` counts), not estimated. Focused on
sohamyoga-frontend (1,154 TS/TSX files, 135,145 lines — the largest codebase by far) with
cross-references to other portals where Phase 1/7 already surfaced relevant evidence.

## 1. File/function size

| Metric | Value | Evidence |
|---|---|---|
| Files >500 lines | 19 (of 1,154) | `wc -l` scan, all under `src/app/admin/*/page.tsx` except `ChatWidget.tsx` and `CronRegistry.ts` |
| Files >300 lines | 50 | same |
| Largest file | `src/app/admin/ads/page.tsx`, 1,344 lines | confirmed 73 `useState`/`useEffect` calls, 11 top-level function/component declarations in one file |
| Average file size | ~117 lines | 135,145 / 1,154 |
| Total exported functions in `src/domain/` | 163 across 27,575 lines | ~169 lines/function average — reasonable, the size problem is concentrated in admin pages, not domain logic |

**Finding CQ-01 (Medium):** `src/app/admin/ads/page.tsx` (1,344 lines, 11 functions/components,
73 state hooks in one file) is a real God Component — likely a single file backing multiple tabs of
the Ads admin UI. Same pattern repeats in `crm/page.tsx` (1,180), `layout.tsx` (1,124),
`ecommerce/page.tsx` (963), `survey/page.tsx` (883), and 14 more admin pages over 500 lines.
**Recommendation:** split by tab/section into separate components — mechanical, low-risk refactor,
not a design problem (the underlying domain logic is properly separated in `src/domain/`; this is a
presentation-layer cohesion issue specifically in the admin page shells).

## 2. Type safety erosion

**Finding CQ-02 (Low):** 20 occurrences of `: any` / `as any` across 1,154 files — genuinely low
for a codebase this size (a healthy ratio, not a debt signal worth prioritizing).

## 3. Technical debt markers

**Finding CQ-03 (Low, positive):** only 12 `TODO`/`FIXME`/`HACK`/`XXX` comments across the entire
135K-line sohamyoga-frontend codebase. This is unusually low and, combined with the Reality Matrix's
`missing_items` field (which serves the same function — documenting known gaps — but in a queryable
DB column instead of inline comments), suggests debt is tracked deliberately via the module-registry
system rather than left as inline markers. Not a gap; a different (arguably better) tracking
mechanism.

## 4. Duplication (DRY violations)

**Finding CQ-04 (Medium):** the auth-gate pattern (`const { denied } = await getAdminPrincipal(req); if (denied) return denied;`)
is correctly but independently repeated across all 230 admin-gated route files (and the equivalent
customer pattern across 40 files) — see [MASTER_LLD.md](../architecture/MASTER_LLD.md) for the
cross-portal version of this same finding (the identical shape recurs in market-research-portal,
voice-agent-platform, and SohamYoga.Web too, each with its own independent implementation of the
concept). This is boilerplate duplication, not logic duplication — each call site correctly reuses
the underlying `getAdminPrincipal()` function; what's duplicated is the 2-line guard clause, which
is idiomatic Next.js App Router style (no middleware.ts to centralize it — see ATAM S-1 in
[sohamyoga-frontend/ATAM.md](../architecture/sohamyoga-frontend/ATAM.md)). Low actual risk, flagged
for completeness.

**Finding CQ-05 (Low):** zero files use a shared `apiError()`/`withApiErrorLog()` response helper
within `src/app/api/` route handlers directly (`withApiErrorLog` from `@sohamyoga/shared-backend`
is real and used elsewhere — see [MASTER_LLD.md](../architecture/MASTER_LLD.md) — but not
consistently in route error responses). Error response shape (`NextResponse.json({error: ...})`) is
built ad-hoc per route rather than through one shared helper. Low severity — consistent enough in
practice that no shape-mismatch bugs were found during Phase 1/7 investigation, but a shared helper
would reduce the chance of a future inconsistency.

## 5. Complexity / nesting

**Finding CQ-06 (clean):** deep nesting (5+ indent levels) is genuinely rare — only 1 file in
`src/domain/` matched a 12-space-indent proxy check. Domain logic is generally kept flat, consistent
with the file-size finding above (the size problem is UI-layer breadth, not logic-layer depth).

## 6. Circular dependencies

**Not fully evaluated this pass** — `madge` (the standard JS/TS circular-dependency tool) isn't
installed and installing it would require a network-dependent `npx` fetch during a read-only audit
pass; noted as a real gap rather than skipped silently. No circular-import-related build failures or
runtime errors were observed in any of the live verification done during Phases 1/2/7, which is
weak-but-real evidence against a severe circular-dependency problem (a genuinely broken cycle would
likely have surfaced as a build or runtime failure already).

## 7. Other portals (from Phase 1/7 evidence, not re-scanned in this pass)

| Portal | Largest file found | Note |
|---|---|---|
| ai-orchestrator-platform/frontend | `App.tsx`, 773 lines | Single-page chat UI — size is expected for the architecture (no router/multi-page split) |
| ai-orchestrator-platform/backend | `main.py`, 692 lines | FastAPI route file — consolidates most HTTP handlers in one file, same God-file pattern as sohamyoga-frontend's admin pages |
| market-research-portal | `PhaseTabs.tsx`, 510 lines | One file over the 500-line threshold — otherwise not flagged |
| voice-agent-platform, password-manager, SohamYoga.Web | Not individually re-scanned this pass | No file-size outliers surfaced during Phase 1 investigation of these portals |

## Prioritized remediation backlog

| Priority | Item | Effort | Risk if unaddressed |
|---|---|---|---|
| P2 | Split the 19 files >500 lines (mostly `admin/*/page.tsx`) into per-tab/section components | Medium (mechanical, one file at a time, low regression risk with existing test coverage) | Slower onboarding, harder code review, no functional risk |
| P2 | Extract a shared `apiError()` response helper and adopt it in `src/app/api/*` | Low | Low — cosmetic consistency, not a functional bug source |
| P3 | Extract a shared auth-gate/session-core package usable across sohamyoga-frontend, market-research-portal, voice-agent-platform (mirrors the existing `shared-backend` extraction pattern) | Medium-High (cross-portal refactor, needs careful behavior-preserving migration) | Low today (each implementation is independently correct) but raises the cost of any future security fix (has to be applied 3-5 times) |
| P3 | Install `madge` (or equivalent) and run a real circular-dependency check | Low | Unknown — no evidence of an actual problem, just an unverified gap |
| P4 | Reduce `: any`/`as any` usage from 20 to 0 | Low | Very low — already a small number |

No P0/P1 code-quality findings — the codebase's structural discipline (flat domain logic, low `any`
usage, low TODO count, honest-degradation pattern already noted in MASTER_LLD) is genuinely solid;
the concentration of size/duplication issues in admin-page presentation code is real but not urgent.
