# Interview Question Bank — Phase 16

Generated only from this repository's real findings. Each question has a real, evidenced answer
grounded in the audit docs — not a generic interview-prep list.

## Architecture

1. **Why did you choose a modular monolith over microservices for 6 separate applications?**
   → ADR-R01: single operator, no team to coordinate service boundaries, no evidence any portal has
   outgrown a monolith's practical limits.
2. **You have 4+ separate databases in one workspace. Why not consolidate?**
   → ADR-R09: blast-radius containment was prioritized over a single source of truth; the one real
   cross-DB need (pricing/reviews sync) uses a narrowly-scoped read-only role instead of merging DBs.
3. **Walk me through what would break first if this system got 100x more traffic.**
   → SCALABILITY_PLAN.md: Postgres pool `max: 10` per portal and the complete absence of any caching
   layer are the two most likely first bottlenecks, by structural reasoning — not measured, and the
   candidate should say so rather than guess a number.

## Incidents / Debugging

4. **Tell me about a production incident you found and how you diagnosed it.**
   → The nginx stale-DNS 502: `docker ps` showed everything healthy, curl to nginx returned 502,
   curl to the frontend directly returned 200. The diagnostic move was testing from *inside* the
   nginx container to the frontend by hostname (worked) versus from the host through nginx (failed)
   — isolating the fault to nginx's own resolution, not the frontend.
5. **How do you tell the difference between "the process is alive" and "the service actually
   works"?**
   → All 3 real incidents in this audit (dead backend, broken build, stale nginx DNS) had a healthy
   `docker ps`/`systemctl status` the entire time. The answer has to name a concrete mechanism
   (application-level health check hitting real functionality, not just process presence).
6. **A systemd service has `Restart=on-failure` and dies anyway without restarting. Why?**
   → `Restart=on-failure` doesn't fire on a clean exit/SIGTERM — only on non-zero exit codes or
   signals systemd classifies as failures. `Restart=always` is the fix if the intent is "this should
   always be running."

## Security

7. **You found zero leaked secrets in a repo with 91.8% AI-co-authored commits. How did you verify
   that, not just assert it?**
   → `git grep` across tracked files for API-key/password/token patterns, plus `git log --all
   --diff-filter=A --name-only` for any `.env`/credential-shaped filename ever committed, even if
   later removed — checked full history, not just the current tree.
8. **All 6 portals rely solely on SameSite=Lax for CSRF protection. Is that a problem?**
   → Real but Medium, not Critical — SameSite=Lax is a genuine modern-browser mitigation for the
   classic attack shape; the gap is defense-in-depth, not an open vulnerability. Good answer names
   the actual residual risk (older browsers, edge-case configurations) rather than overstating it.
9. **Why is a secrets vault running in `-dev` mode a real production risk, not just a config
   nitpick?**
   → It materialized as a real incident during this very audit: a routine service restart wiped
   every stored API key with zero alert. "Directionally correct decision, incomplete
   implementation" is the precise framing (ADR-R06).

## Testing

10. **5 of 6 portals have zero tests. Where would you start, and why not "write tests everywhere"?**
    → The single highest-leverage test identified: voice-agent-platform's tenant-isolation guard,
    which already caught one real incident manually and has zero regression protection — cheapest
    fix, highest consequence if it silently breaks. "Where would tests catch a regression that
    already happened once" beats "where is coverage lowest" as a prioritization heuristic.

## AI Engineering

11. **You found "zero LEVEL 3+ agentic workflows." What does that mean concretely, and why does it
    matter?**
    → Every AI call in the repo is a single, non-autonomous completion — no LLM in this codebase
    decides to call a tool and act on the result. Matters because it's easy to overclaim "AI agent"
    marketing language for what is actually a single API call; this audit applied a strict
    definition and reported the real number, including in the repo's own favor (several files
    self-document this honestly already).
12. **What would you build first if you were asked to add real agentic capability here?**
    → Nothing, without a named use case — Phase 18's Stop-Building control applies directly; the
    audit explicitly recommends against speculative agentic infrastructure.

## Data/Database

13. **423 base tables, all with a PK, but an initial pass flagged "75 tables with no PK." What
    happened?**
    → False positive — the 75 were VIEWs, which don't have PKs by design. Good answer: describes
    re-verifying before reporting, not just trusting the first query's shape.
14. **No backup existed for a 498-table production-adjacent database. What did you do?**
    → Took a real `pg_dump` backup immediately (zero-risk, purely additive), added `.backups/` to
    `.gitignore` in the same change since the dump contains real hashed credentials/PII, and
    documented that a one-time backup isn't a recurring policy — the register entry stays open.

## Product/Business judgment

15. **164+ real modules exist. What's actually missing before this could take a paying customer?**
    → Not more modules — a payment gateway, real email/SMS delivery, and one fully-credentialed
    social channel. Breadth already exceeds MVP; the gap is narrow and vendor-integration-shaped.
