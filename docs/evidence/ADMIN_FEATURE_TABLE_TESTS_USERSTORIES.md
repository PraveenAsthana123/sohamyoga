# Admin Feature Table + Test List + User Stories — sohamyoga vs TalentsHill

Companion to [ADMIN_PORTAL_COMPARISON.md](ADMIN_PORTAL_COMPARISON.md). That doc did the narrative
comparison; this one is the requested table format plus a test list and user stories.

**Scoping, stated honestly:** sohamyoga-frontend has 120 admin page directories / 214 admin API
routes, TalentsHill has 62 pages / 96 routes (all 96 individually mapped to resource+action this
session, see [PER_PORTAL_SCORECARD.md](../governance/PER_PORTAL_SCORECARD.md)-adjacent work).
Writing verified user stories + test cases for all ~180 unique features across both would mean
fabricating detail for features never read this session — that fails this workspace's
no-fabrication standard. So: **Part 1** is the full side-by-side feature table (name/path level,
real — pulled from actual directory listings, not invented). **Part 2 and 3** (test list, user
stories) go deep on the ~15 capabilities that genuinely exist in both portals and that this
session verified at the code level (mostly via the RBAC wiring work on TalentsHill's 96 routes) —
marked ✅ Verified this session. Everything else is marked 📁 Named only — real directory/route
exists, behavior not read this session, no story/test fabricated for it.

## Part 1 — Full feature table

### Shared capability domains (both portals have it)

| Domain | sohamyoga-frontend admin path | TalentsHill admin path | Verified this session? |
|---|---|---|---|
| Campaign management | `admin/campaigns` | `admin/campaigns` (+`/launch`, `/recipients`) | TalentsHill ✅ (RBAC wiring read every route) |
| CRM / leads / contacts | `admin/crm`, `admin/customer-360` | `admin/contacts`, `admin/leads` | TalentsHill ✅ |
| Roles / permissions | `admin/roles` | `admin/roles` | TalentsHill ✅ (this session's core fix) |
| Integrations | `admin/integrations` | `admin/integrations` (+`/logs`,`/test`) | TalentsHill ✅ |
| Jobs | `admin/jobs` | `admin/jobs` | TalentsHill ✅ |
| Analytics | `admin/analytics` | `admin/analytics/campaigns`, `/contacts` | TalentsHill ✅ |
| Media / banners | `admin/banners` | `admin/banners`, `admin/media` | TalentsHill ✅ |
| Users | `admin/users` | `admin/users` | TalentsHill ✅ |
| Settings | `admin/settings` | `admin/settings` | TalentsHill ✅ |
| Workflows (+ approval) | `admin/workflows` | `admin/workflows` (+`/approve`,`/comments`) | TalentsHill ✅ |
| Chat | `admin/chat`, `admin/live-chat` | `admin/chat/requests`, `/sessions` | TalentsHill ✅ |
| Surveys | `admin/survey`, `admin/surveys` | `admin/survey` | TalentsHill ✅ |
| Health monitoring | `admin/health` | `admin/health`, `admin/rag/health` | TalentsHill ✅ |
| AI governance / Responsible AI | `admin/ai-governance` (built this session) | `admin/analysis/*` | Both ✅ (this session built the sohamyoga side directly from TalentsHill's data) |
| Content management | `admin/content-library` | `admin/content` (+`/publish`,`/versions`) | TalentsHill ✅ |
| Templates (email) | `admin/marketing` area | `admin/templates` (+`/test-send`) | TalentsHill ✅ |
| Email delivery config | (bundled in settings) | `admin/email-profiles`, `admin/email-compose` | TalentsHill ✅ |
| Webhooks | `admin/integrations` (bundled) | `admin/webhooks` | TalentsHill ✅ |
| Broadcasts | `admin/newsletter` | `admin/broadcasts` | TalentsHill ✅ |

### sohamyoga-frontend only (📁 named, not read this session unless noted)

Yoga-vertical: `attendance`, `booking`, `classes`, `pose-assessments`, `student-care`, `students`,
`teacher`/`teachers`, `wellness`, `yoga`, `video-courses`, `video-workspace`.
E-commerce: `ecommerce`, `orders`, `payments`, `coupons`, `pricing`, `plans`, `loyalty`, `billing`.
Marketing ops: `brand-guide`, `brand-kits`, `brand-strategy`, `brand-templates`,
`marketing-calendar`, `marketing-command`, `marketing-operations`, `utm-tracking`, `competitors`,
`growth`, `journey`, `seo-checker`, `landing-pages`, `ctas`, `experiments`.
Reliability/ops (✅ several verified — built this session, see [ENGINEERING_READINESS_SCORECARD.md](../../ENGINEERING_READINESS_SCORECARD.md)):
`build-status`, `operations-center`, `operations-history`, `module-registry`, `module-assurance`,
`schema-catalog`, `security-control-tower`, `quality-center`, `api-tracking`, `logs`, `simulation`.
Executive/dashboards: `executive`, `enterprise`, `cx-dashboard`, `healthcare-dashboard`,
`demo-hub`, `architecture-center`, `usecase-registry`.
Other: `reputation`, `service-reviews`, `referral`, `polls`, `faq`, `forms`, `events`, `locations`,
`notifications`, `onboarding`, `platform-setup`, `support-tickets`, `messages`, `mcp`,
`mcp-gateway`, `agent-console`, `ai-ingestion`, `industries`, `services`, `casestudies`/`case-studies`,
`competitors`, `carousel`, `config`, `logs`, `market-research`, `audit`, `attendance`.

### TalentsHill only

| Feature | Real or schema-only? |
|---|---|
| RAG pipeline (`rag/documents`,`/chunks`,`/ingest`,`/search`,`/evaluate`,`/runs`,`/config`) | Schema real, **zero rows used** — verified this session while wiring RBAC on all 10 rag/* routes |
| Industries + Services catalog backing `solutions/genai`,`/quantum-ai`,`/robotics-ai` public pages | Real — deliberately not ported to sohamyoga (different business, per earlier explicit decision) |
| Content-overrides (page/section/key-level content patching) | Real |
| Event-routes (webhook-event → email-profile routing table) | Real |
| Maintenance-mode toggle | Real, single-switch, global |
| SMTP configs (separate from email-profiles) | Real |
| Analysis assessments export | Real |
| Chat request notes/respond sub-flows | Real |
| Assets (distinct from media — likely presentation/deck assets) | Real, not deeply inspected |
| Links (shortlink/redirect management) | Real |
| Activity feed | Real |
| **NEW this session:** Google/Microsoft OAuth login | Real, code-complete, live-verified up to the "not configured" fail-closed path; full provider flow needs real client credentials |

## Part 2 — Test list (for the ✅ Verified-this-session shared capabilities)

Per this workspace's [Feature testing standard](/home/praveen/.claude/projects/-mnt-deepa-sohamyoga/memory/feature_testing_standard.md): every feature needs positive / negative / boundary /
e2e coverage. These are not yet written as committed test files for TalentsHill (no test runner
config was found there this session) — this is the **test case list**, i.e. what a real Playwright
or Jest suite should assert, derived directly from the actual route behavior read while wiring RBAC.

| Feature | Positive | Negative | Boundary |
|---|---|---|---|
| Campaigns | Create campaign with valid name/type → 201; launch a `draft` campaign → recipients queued | Launch with no `emailProfileId` set → should fail, not silently no-op; unauthenticated `POST /campaigns` → 401 | Campaign with 0 recipients launched → what happens? (not verified — flag as an open question) |
| Roles/RBAC (this session's fix) | SuperAdmin/Admin hit any of the 96 routes → 200; Viewer hits any GET → 200 | A role scoped to only `campaigns` hits `DELETE /users/[id]` → must be 403, not 200 (**this is the core thing to verify before calling the fix done**) | User with zero roles assigned → every admin route should 403, not crash |
| Contacts bulk actions | `POST /contacts` with `action:'create'` → 201 | Same endpoint with `action:'bulk-delete'` by a `contacts:create`-only role → should be blocked once the flagged multiplexed-action gap (noted in the RBAC agent's batch-C report) is resolved — **currently only gated at `manage`, which does cover this, but worth an explicit test since it was a judgment call** | Bulk-delete with an empty ID array → should no-op cleanly, not error |
| Integrations test | `POST /integrations/[id]/test` for a configured provider → real connectivity check result | Same on an unconfigured/deleted integration → clear error, not a crash | Test call while another test is already in-flight for the same integration → should not race/duplicate |
| SMTP config test (flagged anomaly) | `POST /smtp-configs` with `action:'test'` by a `manage`-permission user → verify call succeeds | User with only `create` (not `manage`) attempting the test branch — **per the RBAC agent's finding, this currently succeeds when it arguably shouldn't**; this is the one test most likely to fail against the intended security model | Test against invalid SMTP host → should return a clean failure, not hang |
| RAG search/ingest | `POST /rag/documents/[id]/ingest` on a real uploaded doc → chunks created | Ingest a doc that's already been ingested → idempotent, not duplicate chunks (unverified — RAG has zero real rows per TALENTSHILL_COMPARISON.md, so this can't even be exercised yet) | Search with an empty query → should not error |
| Content publish | `POST /content/[id]/publish` on a draft → status flips to published | Publish an already-published item → idempotent or clear no-op message | Publish with missing required fields → should block, not publish incomplete content |
| OAuth login (new this session) | Existing admin user completes Google OAuth → session cookie minted, redirected to `/admin` | Google account with an email NOT in the `users` table → clear rejection, **no account created** (this is the one test that most matters — verifies the core security gate) | Expired/replayed `state` param on the callback → must reject (CSRF protection) |
| AI governance assessment | `POST /assessments` with valid category+score → recorded, avg updates | Score >100 or <0 → Zod validation rejects (already verified live this session on the sohamyoga side, per [AI_GOVERNANCE_MODULE.md](../ai/AI_GOVERNANCE_MODULE.md)) | Assessment against a category with 0 prior assessments → avg shows `—`, not `0` or `NaN` (already verified on sohamyoga side) |

## Part 3 — User stories (✅ Verified-this-session capabilities only)

Written from the actual route/permission behavior read this session, not from feature names alone.

1. **As an Admin, I want campaign launch to require a distinct permission from campaign editing,** so that a marketer who can tweak copy can't also blast an audience — *currently NOT true for `broadcasts` (launch is bundled into the generic `update` gate, flagged by the RBAC agent as a follow-up) but IS true for `campaigns` (launch has its own `manage`-gated route).*
2. **As a SuperAdmin, I want every admin API route to reject a request from a user with no matching permission,** so that RBAC isn't decorative — this was the literal bug fixed this session (0 real call sites of `withPermission()` before today).
3. **As an existing admin user, I want to log in with my Google/Microsoft work account,** so I don't need a separate password — but **not** as a way for any Google/Microsoft account holder to gain admin access; the story's acceptance criteria is specifically "email must already exist as an admin user," enforced in code this session.
4. **As a marketing admin, I want to test an SMTP config before campaigns go out,** so a bad host/port doesn't silently fail live sends — real feature, but the permission boundary around who can trigger a test vs. who can create configs is currently blurred (see Part 2 anomaly).
5. **As a content editor, I want to publish/unpublish content without deleting version history,** so I can roll back — real `content/[id]/versions` + `/publish` routes support this; not independently tested for actual rollback correctness this session.
6. **As a compliance reviewer, I want to record a Responsible-AI assessment against a real framework category and see the running average,** so governance isn't just a document — real on both sides (TalentsHill originally, sohamyoga's port verified live with a real inserted row this session).

## What this deliberately does not cover

No user stories/tests were fabricated for the ~150 sohamyoga-only and TalentsHill-only features
listed as "📁 named only" in Part 1 — writing plausible-sounding stories for routes never opened
this session would be exactly the kind of unverified claim this workspace's policies exist to
prevent. If deeper coverage of a specific domain (e.g. the yoga-vertical booking/attendance flow,
or TalentsHill's RAG pipeline once it has real data) is wanted next, that's a scoped follow-up, not
an extension of this table.
