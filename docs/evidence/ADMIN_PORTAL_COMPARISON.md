# Admin Portal Comparison — sohamyoga-frontend vs TalentsHill

Originally verified 2026-09-08. **Refreshed 2026-09-09** after a full-session TalentsHill build-out
(33 admin modules brought onto the Operational Portal 10-tab standard — Manual/Pipeline/Agentic/
Monitoring/Dashboard/Report/Governance/User Story/Testing/Log&Tracking) that materially changed
several of this document's original findings, most notably the RAG-pipeline and admin-tab-structure
rows below. Builds on [TALENTSHILL_COMPARISON.md](TALENTSHILL_COMPARISON.md) (platform-level, done
2026-09-08) — this pass is scoped specifically to the two admin surfaces. All counts in this refresh
were re-run live against both codebases today, not carried forward from the 2026-09-08 pass.

## What changed since the 2026-09-08 pass (read this first)

- **RAG pipeline flipped from schema-only to real.** Two compounding gaps were found and fixed:
  nothing anywhere ever created the `rag_embed` job (a document could reach 'chunked' status with no
  path to 'embedded'), and both the embed handler and hybrid search were hardcoded to a
  `DummyEmbeddingProvider` generating random vectors — so even once reachable, vector search would
  have been meaningless. Fixed with a real local-Ollama embedding provider (`nomic-embed-text`),
  verified live end-to-end (real document → real chunks → real embeddings → a real search query
  correctly ranking the relevant chunk → a genuine RAG-powered Q&A agent giving a grounded, cited
  answer and correctly refusing to answer from outside knowledge on an out-of-corpus question).
- **TalentsHill's admin is now built to a page/tab standard** (see the "Operational Portal 10-tab
  standard" row below, previously listed as a gap TalentsHill didn't have).
- **The single most severe bug found all session was in TalentsHill's Broadcasts module, not RAG or
  Settings:** clicking "Launch" on a broadcast never actually sent any emails — nothing enqueued the
  real send job, only a DB status flip happened. Fixed at the root. Found by chance while building
  out the new Run Console module and needing a real send to test against — a reminder that "the admin
  page works and the API returns 200" is not evidence a feature has any real-world effect; see the
  session's [search-existing-data-before-building memory](/home/praveen/.claude/projects/-mnt-deepa-sohamyoga/memory/feedback_search_existing_data_before_building.md)
  for the full pattern (7+ occurrences this session alone).
- **Settings → public site was also disconnected:** the admin Social Links form wrote to a DB table
  the public site's Footer never read (it read build-time env vars instead) — fixed, plus a
  duplicate/dead Feature-toggle UI (colliding key names with the real, separate Feature Flags module)
  was removed in favor of pointing at the real one.

## Raw scale, verified by directory/file count (re-run 2026-09-09)

| | sohamyoga-frontend admin | TalentsHill admin |
|---|---|---|
| Admin page directories | 110 (`find src/app/admin -maxdepth 1 -type d`, sohamyoga-frontend/) | 34 (`find app/admin -maxdepth 1 -type d`) |
| Admin API routes | 220 (`find src/app/api/admin -name route.ts \| wc -l`) | 276 (`find app/api/admin -name route.ts \| wc -l`) |
| RBAC enforcement | Not audited this pass — flagged below as a follow-up | Real, `withPermission()` wired across all 276 routes as of this session's build-out (was dead code as of the 2026-09-08 pass) |
| 10-tab Operational Portal standard | No — sohamyoga-frontend's admin pages are not built to this structure | **Yes as of 2026-09-09** — all 33 pre-existing admin modules brought onto Manual/Pipeline/Agentic/Monitoring/Dashboard/Report/Governance/User Story/Testing/Log&Tracking |
| Currently running | Yes, live traffic this session (multiple portals) | No — dev server started/stopped repeatedly this session purely for live verification of each change, not left running persistently |

Note on the page-directory count: TalentsHill's 34 top-level admin directories now each typically
contain ~10-12 files (one per tab, e.g. `ManualTab.tsx`, `PipelineTab.tsx`, `GovernanceTab.tsx`)
rather than one file per directory — the directory count alone understates how much real UI surface
exists per module compared to the 2026-09-08 baseline of 62 (a number that was never independently
re-walked, only taken from TalentsHill's own README). sohamyoga-frontend's admin is now roughly 3x
TalentsHill's by page-directory count but TalentsHill now has *more* admin API routes in absolute
terms (276 vs 220) — the two portals' scale relationship inverted from the original "sohamyoga is
~2x TalentsHill" framing once TalentsHill's build-out is counted. This still isn't a apples-to-apples
"more real" claim either way — it reflects this session's build focus, not a capability judgment.

## Where the two overlap (same capability, built independently, different stack)

| Capability | sohamyoga-frontend | TalentsHill |
|---|---|---|
| Campaign management | `admin/campaigns` | `admin/campaigns` (+ `[id]/launch`, `[id]/recipients`) |
| CRM / leads / contacts | `admin/crm`, `admin/customer-360` | `admin/contacts`, `admin/leads` (+ export, import) |
| Roles/permissions | `admin/roles` | `admin/roles` (274 real permission rows; enforcement was dead code until this session's fix) |
| Integrations | `admin/integrations` | `admin/integrations` (+ per-integration `/logs`, `/test`) |
| Jobs | `admin/jobs` | `admin/jobs` |
| Analytics | `admin/analytics` | `admin/analytics/campaigns`, `admin/analytics/contacts` |
| Media/banners | `admin/banners` | `admin/banners`, `admin/media` |
| Users | `admin/users` | `admin/users` |
| Settings | `admin/settings` | `admin/settings` |
| Workflows | `admin/workflows` | `admin/workflows` (+ `/approve`, `/comments` — a real approval-chain UI) |
| Chat | `admin/chat`, `admin/live-chat` | `admin/chat` (`/requests`, `/sessions`) |
| Surveys | `admin/survey`, `admin/surveys` | `admin/survey` |
| Health | `admin/health` | `admin/health` (+ `rag/health` specifically) |
| AI governance / Responsible AI | `admin/ai-governance` — **built this session**, 35 categories seeded directly from TalentsHill's real taxonomy (see [AI_GOVERNANCE_MODULE.md](../ai/AI_GOVERNANCE_MODULE.md)) | `admin/analysis/*` — the original, more mature version (2 real assessments recorded, full framework/assessment CRUD) |

The AI-governance row is the one place actual code-level sharing already happened this session —
concept and category data ported, implementation kept native to each stack (raw-pg/Next.js on one
side, Drizzle/SQLite on the other).

## What TalentsHill has that sohamyoga-frontend doesn't

| TalentsHill feature | Real or schema-only? | Worth porting? |
|---|---|---|
| RAG pipeline (`rag/documents`, `/chunks`, `/ingest`, `/search`, `/evaluate`, `/runs`) | **Real as of 2026-09-09** — was schema-only/zero-rows at the 2026-09-08 pass; this session found and fixed two compounding gaps (the embed job was never created, and the embedding provider generated random vectors) and verified real ingestion → chunking → real local-Ollama embeddings → real hybrid search → a genuine RAG-powered Q&A agent, live, end-to-end | Now a genuinely proven, exercised pattern — worth referencing for sohamyoga's own RAG work (`admin/ai-ingestion`) specifically for the "wire a real embedding provider, not a dummy/random one" and "make sure the job that actually gets you from ingested to embedded is reachable" lessons, both of which cost real debugging time here. Per the [RAG + Ollama mandatory policy](/home/praveen/.claude/projects/-mnt-deepa-sohamyoga/memory/policy_rag_ollama_mandatory_global.md), sohamyoga's implementation should still be built and verified independently against its own stack, not copy-pasted |
| Content versioning + publish workflow (`content/[id]/versions`, `content/[id]/publish`) | Real (needs re-verification for actual row usage — not checked this pass) | Yes — sohamyoga's `content-library` doesn't have an equivalent draft/version/publish flow today. Concrete, checkable gap |
| Industries + Services catalog (`admin/industries`, `admin/services`) backing the public `solutions/genai`, `solutions/quantum-ai`, `solutions/robotics-ai` pages | Real | **No** — this is deliberately TalentsHill-specific business content (robotics/quantum/satellite/embedded-systems consulting lines), already correctly kept out of sohamyoga per this session's earlier decision |
| Email compose UI (`admin/email-compose`) as a distinct surface from campaign creation | Real | Minor — sohamyoga's campaign/newsletter admin likely covers this already; not independently verified |
| Maintenance-mode toggle (`admin/maintenance`) | Real | Small, easy, genuinely useful — sohamyoga has no equivalent single-switch maintenance-mode admin control found in this pass |

## What sohamyoga-frontend has that TalentsHill doesn't

| sohamyoga feature | Why it matters for TalentsHill |
|---|---|
| `module-registry` + `module-assurance` (real registry-backed built-vs-missing tracking, per the [Module Understanding Standard](/home/praveen/.claude/projects/-mnt-deepa-sohamyoga/memory/policy_module_understanding_standard.md)) | **No longer a TalentsHill gap** — TalentsHill built its own `admin/module-registry` this session (2026-09-09), real DB-backed, catalog of every admin module's real/partial/not-built status with a disclosed-gap column. It additionally now has a real drift-detection pipeline (flags a registry row whose `last_verified_at` is stale, or whose disclosed status is internally inconsistent) that sohamyoga's module-registry does not have as of this pass — worth checking whether sohamyoga's version has an equivalent drift check, not verified this pass |
| `security-control-tower`, `quality-center`, `api-tracking`, `logs`, `build-status` | TalentsHill still has no equivalent live observability/ops dashboards found this pass — still consistent with it not being run as a persistent service. These remain exactly what would need to exist before TalentsHill could be called production-grade |
| `scripts/health-monitor.sh` + `scripts/backup-databases.sh` (real, tested, cron-scheduled this session) | TalentsHill still has no backup/health-check automation found this pass. SQLite makes this simpler for TalentsHill than sohamyoga's Postgres case — a straight file-copy backup + one HTTP health check, not a large lift |

## Two-way, already-verified-safe shares (recommend doing now)

1. **RBAC enforcement audit for sohamyoga-frontend.** TalentsHill had a real critical bug
   (`withPermission()` defined, never called — originally 96 unprotected admin routes, now fully
   wired across all 276 real admin routes as of this session's completed build-out) found and fixed
   earlier this session, on top of an earlier, separate critical bug (middleware not gating
   `/api/admin/*` at all). sohamyoga-frontend has 220 admin routes (re-counted 2026-09-09) and has
   not been checked for the same dead-code authorization pattern. **Recommend auditing this next** —
   same failure class, unverified on this side. TalentsHill's build-out also repeatedly found the
   *next* layer of the same failure class beyond RBAC — a route/UI being reachable and permission-
   checked is no guarantee the thing it triggers is itself wired to anything (see the "What changed"
   section at the top); worth keeping that broader framing in mind for the sohamyoga audit, not just
   a narrow `withPermission()` grep.
2. **Health-monitor + backup script pattern → TalentsHill.** sohamyoga's `scripts/health-monitor.sh`
   and `scripts/backup-databases.sh` are real, tested, and adaptable to TalentsHill's SQLite file with
   minimal changes — genuinely portable, low-risk, closes a real gap.
3. **OAuth (Google/Microsoft) login pattern, once verified in TalentsHill** — per TalentsHill's own
   module registry (checked 2026-09-09), this is still marked `partial` with a disclosed real gap
   (code-complete and fail-closed-path-verified, but not fully exercised), not yet a "recommend
   copying now" pattern. The manual OAuth2+PKCE-against-existing-session-cookie approach is
   stack-agnostic and worth replicating in sohamyoga-frontend's own admin login once TalentsHill's
   own gap closes, not before.

## What this comparison deliberately does not do

This 2026-09-09 refresh only re-verifies the specific rows called out in "What changed since the
2026-09-08 pass" above (RAG, the admin tab standard, module-registry, RBAC route counts, the
Broadcasts/Settings bugs) — those were confirmed live against the actual current code and, for RAG
and Broadcasts, against real running-server test evidence recorded this session. Every other row
carried forward from the 2026-09-08 pass (content-versioning, industries/services, email-compose,
maintenance-mode, security-control-tower, health-monitor/backup scripts, the OAuth pattern) was
**not** independently re-checked this pass and should not be read as freshly verified just because
the surrounding document was touched today. Does not audit sohamyoga-frontend's 220 admin routes for
RBAC enforcement — still flagged above as the most consequential recommended follow-up, not yet
executed. Does not attempt a fresh TALENTSHILL_COMPARISON.md-style DB table/row-count audit beyond
what the RAG and Broadcasts fixes directly touched.
