# Admin Portal Comparison — sohamyoga-frontend vs TalentsHill

Verified 2026-09-08, in response to an explicit request to compare the two admin portals
feature-by-feature and identify what's genuinely shareable in each direction. Builds on
[TALENTSHILL_COMPARISON.md](TALENTSHILL_COMPARISON.md) (platform-level, done earlier this session)
— this pass is scoped specifically to the two admin surfaces.

## Raw scale, verified by directory/file count

| | sohamyoga-frontend admin | TalentsHill admin |
|---|---|---|
| Admin page directories | 120 (`find src/app/admin -maxdepth 1 -type d`) | 62 (per TalentsHill's own README, not independently re-walked this pass) |
| Admin API routes | 214 (`find src/app/api/admin -name route.ts \| wc -l`) | 96 (`find app/api/admin -name route.ts \| wc -l`, this session) |
| RBAC enforcement | Not audited this pass — flagged below as a follow-up | Was schema-only, dead code (`withPermission()` called 0 times) until the wiring in progress right now this session |
| Currently running | Yes, live traffic this session (multiple portals) | No — confirmed not running, per TALENTSHILL_COMPARISON.md |

sohamyoga-frontend's admin is roughly **2x TalentsHill's** by page count and API-route count. That
scale difference matters for the rest of this comparison — sohamyoga isn't "behind," it's a much
larger, longer-lived surface with a different center of gravity (yoga-vertical + generic
marketing-suite breadth vs TalentsHill's tighter enterprise-AI-consulting focus).

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
| RAG pipeline (`rag/documents`, `/chunks`, `/ingest`, `/search`, `/evaluate`, `/runs`) | **Schema only — zero real rows**, per TALENTSHILL_COMPARISON.md | Schema shape is a reasonable reference, but it's not a proven pattern — TalentsHill hasn't exercised it either. Per the new [RAG + Ollama mandatory policy](/home/praveen/.claude/projects/-mnt-deepa-sohamyoga/memory/policy_rag_ollama_mandatory_global.md), sohamyoga's own RAG work (`admin/ai-ingestion`) should be built and verified independently, not copied from an unexercised reference |
| Content versioning + publish workflow (`content/[id]/versions`, `content/[id]/publish`) | Real (needs re-verification for actual row usage — not checked this pass) | Yes — sohamyoga's `content-library` doesn't have an equivalent draft/version/publish flow today. Concrete, checkable gap |
| Industries + Services catalog (`admin/industries`, `admin/services`) backing the public `solutions/genai`, `solutions/quantum-ai`, `solutions/robotics-ai` pages | Real | **No** — this is deliberately TalentsHill-specific business content (robotics/quantum/satellite/embedded-systems consulting lines), already correctly kept out of sohamyoga per this session's earlier decision |
| Email compose UI (`admin/email-compose`) as a distinct surface from campaign creation | Real | Minor — sohamyoga's campaign/newsletter admin likely covers this already; not independently verified |
| Maintenance-mode toggle (`admin/maintenance`) | Real | Small, easy, genuinely useful — sohamyoga has no equivalent single-switch maintenance-mode admin control found in this pass |

## What sohamyoga-frontend has that TalentsHill doesn't

| sohamyoga feature | Why it matters for TalentsHill |
|---|---|
| `module-registry` + `module-assurance` (real registry-backed built-vs-missing tracking, per the [Module Understanding Standard](/home/praveen/.claude/projects/-mnt-deepa-sohamyoga/memory/policy_module_understanding_standard.md)) | TalentsHill's own README claims (79 tables, 124 routes, 62 pages) were **not self-verified** anywhere in TalentsHill itself — they were verified externally, by this session's audit. A module registry would let TalentsHill track its own real-vs-schema-only status continuously instead of via one-off external audits |
| `security-control-tower`, `quality-center`, `api-tracking`, `logs`, `build-status` | TalentsHill has no live observability/ops dashboards found — consistent with it "not currently running." These are exactly what would need to exist before TalentsHill could be called production-grade, which is the standard the user set explicitly earlier this session ("this needs to be production") |
| `scripts/health-monitor.sh` + `scripts/backup-databases.sh` (real, tested, cron-scheduled this session) | TalentsHill has no backup/health-check automation found. SQLite makes this simpler for TalentsHill than sohamyoga's Postgres case — a straight file-copy backup + one HTTP health check, not a large lift |
| Operational Portal 8-tab page standard (Dashboard/Report/Manual Process/Automatic Process/AI Exp/AI Governance/AI Risk/ResAI per policy) | TalentsHill's admin pages are single-purpose CRUD screens, not built to this tab structure. Only worth adopting if/when TalentsHill's admin is deliberately re-platformed to the same operational maturity bar — not a small change, flagging as a structural gap rather than proposing to force it in now |

## Two-way, already-verified-safe shares (recommend doing now)

1. **RBAC enforcement audit for sohamyoga-frontend.** TalentsHill just had a real critical bug
   (`withPermission()` defined, never called — 96 unprotected admin routes) found and fixed this
   session, on top of an earlier, separate critical bug (middleware not gating `/api/admin/*` at
   all). sohamyoga-frontend has 214 admin routes and has not been checked for the same dead-code
   authorization pattern. **Recommend auditing this next** — same failure class, unverified on this
   side.
2. **Health-monitor + backup script pattern → TalentsHill.** sohamyoga's `scripts/health-monitor.sh`
   and `scripts/backup-databases.sh` are real, tested, and adaptable to TalentsHill's SQLite file with
   minimal changes — genuinely portable, low-risk, closes a real gap.
3. **OAuth (Google/Microsoft) login pattern, once verified in TalentsHill** (in progress this
   session) — the manual OAuth2+PKCE-against-existing-session-cookie approach is stack-agnostic and
   could be replicated in sohamyoga-frontend's own admin login if social login is ever wanted there.

## What this comparison deliberately does not do

Does not re-verify TalentsHill's README claims beyond what TALENTSHILL_COMPARISON.md already
checked (DB table counts, RAG row counts, AI-governance row counts) — this pass is structural
(directory/route inventory + cross-reference), not a fresh live-data audit. Does not audit
sohamyoga-frontend's 214 admin routes for RBAC enforcement — flagged above as the most
consequential recommended follow-up, not yet executed.
