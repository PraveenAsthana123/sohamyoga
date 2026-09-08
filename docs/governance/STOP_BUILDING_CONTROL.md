# Stop-Building Control — Phase 18

Verified 2026-09-08. The mandatory 12-question gate, applied to 3 real candidate "next builds"
surfaced during this audit — demonstrating real application, not restating the checklist abstractly.

## The gate

1. Is there an existing module solving this?
2. Is this necessary for one of the priority demo journeys?
3. Is there a real user story?
4. Is success measurable?
5. Is there an owner?
6. Is there a dependency?
7. Is there a test plan?
8. Is there a security impact?
9. Does it increase operational complexity?
10. Is build better than buy?
11. Is AI actually needed?
12. Is this more valuable than hardening an existing partial module?

## Application 1: "Build a real payment gateway integration"

| Q | Answer |
|---|---|
| 1. Existing module? | No — confirmed absent repo-wide |
| 2. Priority journey? | Yes — blocks Journey 4 (booking→payment) and REVENUE_READINESS.md's #1 blocker |
| 3. Real user story? | Yes — implicit in every booking/checkout flow already built |
| 4. Measurable success? | Yes — real transaction completion rate |
| 5. Owner? | Not assigned in this repo |
| 6. Dependency? | A payment provider account (Stripe/similar) — external, not yet provisioned |
| 7. Test plan? | Would need one — none exists today for any financial flow |
| 8. Security impact? | High — PCI-adjacent concerns, must not store raw card data |
| 9. Operational complexity? | Meaningful increase — compliance surface, webhook handling, reconciliation |
| 10. Build vs. buy? | **Buy** — Stripe/similar, not a custom payment processor |
| 11. AI needed? | No |
| 12. More valuable than hardening existing partials? | **Only if revenue is actually being pursued now** — per project memory (self-funded, no commercial use), this is currently a "when needed" item, not a "build now" item |
| **Verdict** | **Do not build yet** — clear go-ahead once revenue is actually sought; premature today |

## Application 2: "Build LEVEL 3+ agentic AI workflows"

| Q | Answer |
|---|---|
| 1. Existing module? | No — confirmed zero LEVEL 3+ agents anywhere (Phase 10) |
| 2. Priority journey? | **No** — journeys 7 and 9 in DEMO_CATALOG.md were found to not require real agentic autonomy to deliver their actual business value |
| 3. Real user story? | Not found — no named business need for autonomous multi-step AI behavior surfaced anywhere in this audit |
| 4. Measurable success? | No eval framework exists to measure it even if built (Phase 10 finding) |
| 5. Owner? | N/A |
| 6. Dependency? | Would need an eval framework built first (currently absent) just to know if it worked |
| 7. Test plan? | No — would be building on an already-absent test foundation (Phase 6: zero AI output tests exist) |
| 8. Security impact? | Real — autonomous tool-use is a materially larger attack surface than single completion calls |
| 9. Operational complexity? | Significant increase |
| 10. Build vs. buy? | N/A — no clear buy option evaluated |
| 11. AI needed? | **This is the core question, and the answer is: not demonstrated** — every AI use case found in this audit works correctly as a LEVEL 1-2 single call; none showed a task that specifically requires autonomy |
| 12. More valuable than hardening partials? | **No** — TD-09 (a $0-effort regression test) and TD-02 (CI gates) both dominate this on every axis |
| **Verdict** | **Do not build** — fails question 11 outright, the clearest "don't build" case in this audit |

## Application 3: "Extract a shared auth-core package across the 5 independently-implemented auth systems"

| Q | Answer |
|---|---|
| 1. Existing module? | Partial — `shared-backend` already proves the extraction pattern works for `OllamaClient` |
| 2. Priority journey? | Indirectly — every journey depends on auth working correctly |
| 3. Real user story? | Engineering-facing: "as a maintainer, fixing an auth bug should mean fixing it once, not 5 times" |
| 4. Measurable success? | Yes — lines of duplicated auth code eliminated, time-to-fix for a future auth bug |
| 5. Owner? | Not assigned |
| 6. Dependency? | None blocking — could start today |
| 7. Test plan? | Each of the 5 systems already has Phase 7's verified-correct behavior as a real regression baseline to test against during migration |
| 8. Security impact? | Positive if done carefully (one place to apply a future fix) — but the migration itself is a real risk window |
| 9. Operational complexity? | Decreases long-term, real short-term migration risk |
| 10. Build vs. buy? | Build — this is internal-pattern consolidation, no buy option applies |
| 11. AI needed? | No |
| 12. More valuable than hardening partials? | **Genuinely debatable** — TD-18 is rated P3 (Low-Medium) precisely because each of the 5 systems is independently correct today (Phase 7 found zero gaps in any of them individually); this is a maintainability investment, not a correctness fix |
| **Verdict** | **Reasonable P3 candidate, not urgent** — matches the existing Technical Debt Register priority exactly |

## What this phase demonstrates

The gate correctly separates 3 real candidates into: build-when-triggered (payment), don't-build
(agentic AI — fails the core "is AI actually needed" test), and build-eventually-not-now (auth-core
extraction) — matching this audit's own Technical Debt Register priorities exactly, which is the
gate working as intended rather than producing a different answer than the rest of the audit already
converged on independently.
