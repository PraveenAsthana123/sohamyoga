# MVP vs. Future Scope — Phase 12

Verified 2026-09-08.

## What's already far beyond a typical MVP

sohamyoga-frontend alone has 174+ real modules across CRM, campaigns, social, SEO, e-commerce
infrastructure, loyalty, surveys, and more (Phase 1). This is not an under-built system — if
anything, the breadth (57 domains) exceeds what a typical MVP would need, and Phase 18's
Stop-Building Control is directly relevant: **the honest recommendation from this audit is to
harden and complete existing partial modules, not add new ones.**

## True MVP for a first paying customer (given the marketing-suite core objective)

A minimal viable version of this product, if launched today for one real paying customer, would need
only:
1. Lead capture + CRM (real)
2. One real social/content channel end-to-end (Telegram/Discord/Mastodon/Bluesky are real; pick one)
3. Booking or service inquiry (real, minus payment)
4. A real payment gateway (the one Critical gap from REVENUE_READINESS.md)
5. A real email delivery provider (the one High gap)

Everything else already built (SEO tooling, security scanning, experiments, loyalty, video
production, market research) is real value beyond MVP scope — genuinely more than needed for a first
customer, not a gap.

## Explicitly future scope (not needed now, correctly not yet built)

- Multi-tenant SaaS architecture (current single-tenant-per-deployment model is correct for current
  stage — see MASTER_HLD.md)
- LEVEL 3+ agentic AI workflows (Phase 10 — no evidence this is needed yet)
- Horizontal scaling infrastructure (Phase 9 SCALABILITY_PLAN.md — premature at 1-user scale)
- Formal compliance certification (Phase 4 DATA_GOVERNANCE.md — premature pre-revenue)

## Recommendation

Per the framework's own Phase 18 instruction, do not build new modules to reach "MVP" — the module
count already exceeds MVP requirements by a wide margin. The real remaining work is narrow and
vendor-integration-shaped (payment, email, one social channel), not broad feature work.
