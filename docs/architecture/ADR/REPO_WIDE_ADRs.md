# Repo-Wide Architecture Decision Records — Phase 15

Verified 2026-09-08. These are cross-portal decisions (distinct from sohamyoga-frontend's own
[ADR/](../sohamyoga-frontend/ADR/) directory, which covers portal-specific choices). Each entry:
context, decision, why, tradeoffs, reversal cost, future trigger to revisit — interview-grade detail
per the framework's Phase 15/16 intent.

## ADR-R01: Modular monolith per portal, not microservices

**Context:** 6 portals, 1 operator, no team to coordinate service boundaries.
**Decision:** Each portal is its own modular monolith (57 domains in sohamyoga-frontend's case,
sharing one process and one database). No portal has been split into microservices.
**Why:** Microservices add operational overhead (service discovery, distributed tracing, network
failure modes) that only pays off with a team large enough to need independent deployability per
service. Verified: no evidence in this audit that any portal has outgrown a monolith's practical
limits — MASTER_LLD.md found domain logic is generally cohesive (Phase 3), not tangled.
**Tradeoffs:** A large admin page (Phase 3, `ads/page.tsx` at 1,344 lines) is a real cost of keeping
everything in one deployable unit's UI layer, but that's a code-organization issue, not a deployment
architecture one.
**Reversal cost:** High — extracting a domain into its own service would need new inter-service auth,
its own DB or a sync strategy, and new deployment tooling.
**Future trigger to revisit:** A specific domain (e.g. video rendering, which is CPU/FFmpeg-heavy)
needing independent scaling from the rest of the app — not yet observed, per PERFORMANCE_BASELINE.md.

## ADR-R02: Raw `pg`/`psycopg`-style access, no ORM, anywhere in the repo

**Context:** All 4 Node portals with a real schema (sohamyoga-frontend, market-research-portal,
voice-agent-platform, password-manager) independently chose the same pattern.
**Decision:** Hand-rolled connection pool + raw SQL, domain-sharded schema files, no
Prisma/Drizzle/TypeORM/Sequelize anywhere.
**Why:** Full control over query shape across a combined ~600+ tables; avoids ORM abstraction tax.
**Tradeoffs:** No compile-time query type-checking, no auto-generated migrations (directly connects
to TD-05 in the Technical Debt Register — the migration-tooling gap is a direct consequence of this
choice, not a separate accident).
**Reversal cost:** Very high now — would mean rewriting the data-access layer across 4 portals and
~600 tables.
**Future trigger to revisit:** If TD-05 (no rollback capability) causes a real incident, that would
be the trigger to reconsider — not before.

## ADR-R03: Local Ollama as default LLM, cloud providers as an option

**Context:** sohamyoga-frontend, market-research-portal, and ai-orchestrator-platform all default to
local Ollama.
**Decision:** Ollama-first, with OpenAI/Claude available in ai-orchestrator-platform specifically
(not the other two portals).
**Why:** Zero per-call cost, no data leaving the machine, consistent with project memory's
"self-funded, no commercial use" framing.
**Tradeoffs:** Ollama's local models are meaningfully less capable than frontier cloud models for
some tasks — Phase 10 found this hasn't yet caused a documented quality problem (Research-AI Draft
Job's fact-check gate exists specifically to catch the kind of error a weaker model is more prone
to), but it's a real capability tradeoff.
**Reversal cost:** Low — the codebase already supports cloud providers as an option (`providers.py`,
ai-orchestrator-platform); extending that pattern to the other 2 portals would be incremental, not a
rewrite.
**Future trigger to revisit:** If a specific AI feature is found to underperform specifically due to
model capability (not yet observed/measured — no eval framework exists per Phase 10).

## ADR-R04: No vector database, no graph database, anywhere

**Context:** Confirmed absent repo-wide (Phase 1/2 LLD finding) despite forward-looking spec text
referencing Qdrant/Neo4j in `knowledge-mcp-registry.ts`.
**Decision:** Postgres-only for all structured data; no RAG pipeline exists.
**Why:** No feature currently requires semantic search or graph traversal — building the
infrastructure ahead of a real use case would violate Phase 18's Stop-Building principle.
**Tradeoffs:** Any future "search my documents semantically" or "recommend related X" feature would
need this infrastructure built from zero.
**Reversal cost:** Low to start (pgvector extension is a lightweight addition to existing Postgres
instances) — this is a "not yet needed" decision, not a "hard to reverse" one.
**Future trigger to revisit:** A named feature requiring semantic search (e.g., real content
recommendation, real knowledge-base Q&A) — none exists today per Phase 10's AI inventory.

## ADR-R05: `node-cron` in-process scheduling, not a real job queue

**Context:** No message queue (Redis/RabbitMQ/SQS-equivalent) exists anywhere in the repo.
**Decision:** Scheduled jobs run via `node-cron` inside the same process as the web server (or a
dedicated cron container/systemd unit running the same in-process pattern).
**Why:** Simple, no additional infrastructure, correct at single-instance scale.
**Tradeoffs:** Would double-execute jobs if a portal were ever horizontally scaled to multiple
instances (PERF-05 in the Bottleneck Register) — a real, known, currently-irrelevant limitation.
**Reversal cost:** Medium — would need a real queue (BullMQ+Redis is the natural fit given Node) plus
migrating each `node-cron` job to a queue consumer.
**Future trigger to revisit:** Any portal being horizontally scaled — not currently planned per
SCALABILITY_PLAN.md.

## ADR-R06: OpenBao for secrets, not environment variables alone — but deployed in dev mode

**Context:** ai-orchestrator-platform and sohamyoga-frontend (Skyvern credentials) fetch secrets from
OpenBao at runtime rather than relying solely on `.env` files.
**Decision:** Use a real secrets vault for the credentials that need it most (API keys), while other
config remains in `.env` files.
**Why:** Better than plaintext `.env` for the highest-value secrets — a real security improvement
over the baseline.
**Tradeoffs:** **The vault itself runs in ephemeral `-dev` mode** (SEC-01/TD-01) — this was very
likely a pragmatic "get it working locally" choice that was never revisited for the persistent-storage
config OpenBao supports. This is the clearest example in the whole audit of a *directionally correct*
architectural decision (use a real vault) undermined by an *incomplete* implementation (never
configured for persistence).
**Reversal cost:** Low — switching OpenBao's storage backend from `-dev` to file/Raft-based is a
config change, not an architecture change.
**Future trigger to revisit:** Should happen regardless of a trigger — this is already-identified,
already-materialized-as-an-incident debt (Phase 1's own P0 fix).

## ADR-R07: Postiz for social scheduling where available, direct-API adapters as a fallback

**Context:** Facebook/LinkedIn/YouTube go through Postiz (self-hosted); Telegram/Discord/Mastodon/
Bluesky have direct, Postiz-independent adapters (`first-wave-adapters.ts`).
**Decision:** Hybrid — use the aggregator (Postiz) where it saves real integration work (3 major
platforms behind one API), build direct adapters where the aggregator doesn't cover the platform or
credentials aren't yet available.
**Why:** Pragmatic — avoids reimplementing 3 platforms' APIs individually while still shipping real
functionality (the 4 direct-adapter platforms) without waiting on Postiz credentials.
**Tradeoffs:** Two different code paths to maintain and reason about for "social publishing" as a
concept.
**Reversal cost:** Low — the direct-adapter pattern already proves the aggregator isn't load-bearing;
either could be dropped independently.
**Future trigger to revisit:** If Postiz credentials are ever configured, worth re-measuring whether
the dual-path complexity is still justified.

## ADR-R08: Next.js API routes as the primary backend for sohamyoga-frontend, not a fully standalone service

**Context:** sohamyoga-frontend has 383 of its own API routes, while a separate SohamYoga.Web (.NET)
backend exists only for auth + a subset of legacy content endpoints.
**Decision:** Most business logic lives in Next.js API routes (same deployable as the UI); auth is
delegated to the separate .NET service.
**Why:** Historical — per project memory (SLP→SohamYoga rebrand), the .NET backend predates the
current marketing-suite direction; new development happens in Next.js.
**Tradeoffs:** Two separate databases (Postgres 498 tables vs. SQLite), two auth-adjacent surfaces to
reason about (Phase 4/7 findings) — a direct architectural cost of this historical split.
**Reversal cost:** Very high — migrating auth into Next.js/Postgres would mean a real identity
migration for all existing users.
**Future trigger to revisit:** Not recommended without a concrete pain point — the current split
works and is well-understood (Phase 1 verified 253/253 routes correctly gated against it).

## ADR-R09: Strict per-application database isolation, one narrow read-only exception

**Context:** 4+ separate databases across the repo (Phase 4), with exactly one cross-DB read path.
**Decision:** No shared superuser credential, no direct writes across app boundaries; the one
exception (market-research-portal reading sohamyoga's pricing/reviews data) uses a dedicated
read-only role.
**Why:** Blast-radius containment — a bug or breach in one portal's DB access can't touch another's
data.
**Tradeoffs:** No single source of truth for cross-cutting concepts (e.g., "all customers across all
apps") — duplicated schema-design effort per portal.
**Reversal cost:** High — consolidating would be a real data-migration project.
**Future trigger to revisit:** If a real cross-portal customer-identity need emerges (not observed
today — Phase 2 MASTER_DATA_FLOW.md confirms zero customer-record sharing exists or is needed today).

## ADR-R10: Local-first deployment (systemd/Docker on one machine), not cloud

**Context:** Every portal runs on this single local machine — no AWS/GCP/Azure deployment found
anywhere in this audit.
**Decision:** Local-first, matching the "self-funded, no commercial use" project framing.
**Why:** Zero infrastructure cost, full control, consistent with pre-revenue stage.
**Tradeoffs:** No geographic redundancy, no managed-service reliability guarantees — this machine
being unavailable takes down every portal simultaneously (a real, if currently accepted, single
point of failure).
**Reversal cost:** Medium — the Docker-based portals (sohamyoga-frontend, SohamYoga.Web,
voice-agent-platform) are already containerized, which is a real head start on any future cloud
migration; the systemd-based ones (market-research-portal, ai-orchestrator-platform, password-manager)
would need containerizing first.
**Future trigger to revisit:** Real revenue/uptime requirements that this single machine can't meet —
not the case today.
