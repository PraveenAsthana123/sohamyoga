# Technical Product Management Case Study — SohamYoga Platform

Verified 2026-09-08. Product-management framing of the same real system audited in
[FDE_CASE_STUDY.md](FDE_CASE_STUDY.md) — grounded in the same evidence, different lens.

## User problem & market need

Per project memory, the real product is a generic enterprise digital-marketing suite (CRM,
campaigns, social, SEO, reputation) — yoga-studio operations are one vertical demo, not the primary
market. The underlying JTBD: a small-to-mid business needs one system to run
lead-to-conversion marketing operations without stitching together 10 separate SaaS tools.

## Segmentation & personas (real, from the codebase's own persona modeling)

- **Admin/marketing operator** — the primary user across 230 gated admin routes
- **Customer** — 40 gated self-service routes (booking, billing, wellness tracking, loyalty)
- **Public visitor** — lead capture, content consumption, service inquiry
- **System/automation** — cron jobs, webhooks, MCP tool callers

## Jobs to be Done

1. "Capture and route a lead without losing attribution" — real, working (Journey 1 in
   END_TO_END_JOURNEYS.md)
2. "Know if my codebase/product is actually secure" — real, working (the security-scan journey is
   the single most complete journey in the repo)
3. "Understand my market before launching a campaign" — real, working (market-research-portal's
   17-phase pipeline)
4. "Get paid for a booking/service" — **not yet done** (no payment gateway, confirmed absent)

## MVP vs. current state

See [MVP_VS_FUTURE_SCOPE.md](../product/MVP_VS_FUTURE_SCOPE.md) — the product has already shipped
far past MVP breadth (174+ real modules); the honest gap is 3 narrow vendor integrations (payment,
email, one social channel), not more features.

## Prioritization: RICE on the real Technical Debt Register (top 5)

| Item | Reach | Impact | Confidence | Effort | RICE score | Rationale |
|---|---|---|---|---|---|---|
| TD-09: voice-agent-platform tenant-isolation regression test | Low (1 module) | High (prevents a repeat incident) | High (already understood) | Very low | **Highest** | Cheapest fix in the whole register, protects a proven failure mode |
| TD-07: Health-check/alerting for process death | High (all 6 portals) | High (would've caught all 3 real incidents) | High | Low-Medium | **Very high** | Single biggest ROI structural fix |
| TD-02: CI test/security gates | High (all portals) | High | High | Low-Medium | **Very high** | Mechanical, well-scoped |
| TD-19: Payment gateway | High (blocks all revenue) | Critical if revenue is sought | Medium (real integration work) | High | **Medium** — high impact but high effort and not currently sought | Deliberately deprioritized per current project stage |
| TD-01: OpenBao persistent storage | Medium (2 portals) | High (already caused an incident) | High | Medium | **High** | Architecture decision, not just a config flip |

## MoSCoW (this audit's own recommendations, not a feature wishlist)

- **Must have (if revenue is pursued):** payment gateway, real email delivery
- **Should have:** CI gates, health-check monitoring, the TD-09 regression test
- **Could have:** OpenAPI specs, shared auth-core package extraction, prompt regression tests
- **Won't have (this cycle):** LEVEL 3+ agentic AI, microservices split, multi-tenant SaaS — all
  explicitly named as premature per Phase 18's Stop-Building logic

## North Star metric (proposed, not measured — no analytics platform confirmed wired to a KPI dashboard)

Given the core JTBD is lead-to-conversion marketing operations: **attributable conversions per
month** (a real `campaign_lead` → conversion count, traceable via the real UTM attribution join) is
the most defensible North Star candidate — it's the one metric this audit found real, working
plumbing for end-to-end (capture → attribution → conversion tracking), unlike e.g. "revenue" (no
payment gateway) or "DAU" (no analytics platform confirmed).

## Activation / retention / acquisition / conversion — what's measurable today

- **Acquisition:** UTM-tracked, real (Journey 1)
- **Activation:** Customer self-service onboarding wizard is real (15/16 modules)
- **Retention:** Loyalty/gamification/journey modules are real; no cohort-retention dashboard
  confirmed built
- **Conversion:** Attribution-to-lead is real; conversion-to-revenue is blocked on payment (TD-19)

## Build vs. buy (real decisions already made, evaluated)

- **Built:** CRM, campaigns, security scanning, market research pipeline — all real, all
  differentiated for this specific product
- **Bought/self-hosted OSS:** Postiz (social scheduling), Matomo-adjacent SEO tooling, Skyvern
  (browser automation), ContextForge (MCP federation), Mautic/ActivePieces (found running in Phase 9,
  not deeply audited this pass) — correctly bought rather than rebuilt for commodity capability
- **Judgment call, worth revisiting:** the 5 independently-built auth systems (TD-18) — a real
  candidate for "should have bought/shared" in hindsight, though each is individually correct

## AI risk (grounded in Phase 10)

Low today — no agentic autonomy exists to misbehave, and every AI failure mode found fails closed
rather than fabricating output (AI_FAILURE_MODE_REGISTER.md). The real AI risk is not
safety/alignment — it's **invisibility**: zero cost tracking, zero eval framework, meaning quality
regressions would go undetected, not that current AI behavior is unsafe.

## Launch readiness / post-launch measurement

Per REVENUE_READINESS.md: **not launch-ready for paid revenue today** (payment gateway blocker), but
**genuinely demo-ready** for 6 of 10 standard demo journeys today, which is unusually strong for a
system with zero current CI test gates — a real, evidenced tension between "feature-complete" and
"production-hardened" worth naming explicitly to any stakeholder evaluating this for investment or
launch timing.
