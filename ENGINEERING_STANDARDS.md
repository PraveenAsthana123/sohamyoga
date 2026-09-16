# Engineering Standards — sohamyoga Platform

> **Version:** 2.0.0 · **Last updated:** 2026-09-16 · **Owner:** Platform Engineering  
> Anyone reading, reviewing, or contributing to this codebase MUST follow every standard in this document and the linked sub-standards. No exceptions without a documented ADR (Architecture Decision Record).

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Security Standard](#security-standard)
3. [Database Standard](#database-standard)
4. [API Standard](#api-standard)
5. [Frontend Standard](#frontend-standard)
6. [AI / Model Standard](#ai--model-standard)
7. [Cache Standard](#cache-standard)
8. [Testing Standard](#testing-standard)
9. [Versioning & Release Standard](#versioning--release-standard)
10. [Observability Standard](#observability-standard)
11. [AI Governance Standard](#ai-governance-standard)
12. [GitHub Push Checklist](#github-push-checklist)

---

## Quick Reference

| Standard | Location | Status |
|----------|----------|--------|
| Security | `docs/standards/SECURITY_STANDARD.md` | Mandatory |
| Database | `docs/standards/DATABASE_STANDARD.md` | Mandatory |
| API | `docs/standards/API_STANDARD.md` | Mandatory |
| Frontend | `docs/standards/FRONTEND_STANDARD.md` | Mandatory |
| AI/Model | `docs/standards/AI_MODEL_STANDARD.md` | Mandatory |
| Cache | `docs/standards/CACHE_STANDARD.md` | Mandatory |
| Architecture | `docs/architecture/` | Reference |
| Security Gates | `docs/security/SECURITY_GATES.md` | Mandatory |

**Tech Stack:** Next.js 14 · TypeScript · PostgreSQL · Tailwind CSS · Ollama (llama3.2) · LangChain · LangSmith · FastAPI · UV · Jest (4,346 tests) · 104 cron jobs · 36 social platforms

---

## Security Standard

> Full detail: [`docs/standards/SECURITY_STANDARD.md`](docs/standards/SECURITY_STANDARD.md)

### Non-Negotiable Rules (every PR blocked if violated)

```
RULE S-1: NEVER store secrets, tokens, API keys, or passwords in the database.
          Store only the env var NAME (e.g. "FACEBOOK_PAGE_ACCESS_TOKEN").
          The check-env route returns {set: boolean} — never the value.

RULE S-2: NEVER commit .env, .env.local, *.key, *secret*, credentials.*
          These are in .gitignore. If accidentally committed, rotate ALL keys
          in that file immediately — git history is public.

RULE S-3: ALL database queries MUST use parameterized statements.
          NO string concatenation into SQL. Ever.
          BAD:  `SELECT * FROM users WHERE id = ${id}`
          GOOD: `SELECT * FROM users WHERE id = $1`, [id]

RULE S-4: ALL admin routes MUST be protected by auth middleware.
          Verify: routes under /app/admin/ and /api/admin/ must call requireAdmin().
          Bot/public routes (e.g. /api/bot/chat, /api/survey/*/submit) are exempt
          but MUST use session tokens for identity.

RULE S-5: ALL user input MUST be sanitized before storage or AI prompting.
          Use sanitizeInput() from @/lib/security.ts.
          Max length: 10,000 chars for free text, 500 for names/titles.

RULE S-6: AI prompts MUST NOT contain PII (email, phone, full name, address).
          Use anonymized identifiers or {customer_id} placeholders.

RULE S-7: Webhook signatures MUST be verified before processing payload.
          Meta: X-Hub-Signature-256. Stripe: Stripe-Signature. GitHub: X-Hub-Signature-256.

RULE S-8: API rate limiting MUST be applied to all public endpoints.
          Limit: 60 req/min per IP for public, 300 req/min for authenticated.
```

### Security Layers (what's implemented)

| Layer | Implementation | Location |
|-------|---------------|----------|
| Authentication | Session middleware + cookie | `app/auth.py`, Next.js middleware |
| Authorization | Role-based: Admin / Customer / Public | `src/lib/auth.ts` |
| Input Sanitization | `sanitizeInput()` strips XSS vectors | `src/lib/security.ts` |
| SQL Injection | Parameterized queries (pg Pool) | All `src/lib/db.ts` calls |
| Secret Management | Env vars only, names stored in DB | `platform_credential_config` table |
| Webhook Verification | HMAC-SHA256 per platform | `platform_webhook_config` |
| API Logging | Every call logged with sanitized payload | `platform_api_log` table |
| Security Audit Log | High/critical events | `security_audit_log` table |
| Automated Security Scan | 20 checks, daily 4am | `SecurityScanJob.ts` |
| AI Prompt Injection Guard | Input sanitized before Ollama | All AI routes |

---

## Database Standard

> Full detail: [`docs/standards/DATABASE_STANDARD.md`](docs/standards/DATABASE_STANDARD.md)

### Schema Rules

```sql
-- RULE DB-1: Every table MUST have:
--   id SERIAL/BIGSERIAL PRIMARY KEY
--   created_at TIMESTAMPTZ DEFAULT NOW()
--   updated_at TIMESTAMPTZ DEFAULT NOW()  (for mutable tables)

-- RULE DB-2: All CREATE TABLE statements MUST use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS my_table (
  id SERIAL PRIMARY KEY,
  ...
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RULE DB-3: All seed INSERT statements MUST use ON CONFLICT DO NOTHING
INSERT INTO ref_table (key, value) VALUES ('x', 'y')
ON CONFLICT (key) DO NOTHING;

-- RULE DB-4: Foreign keys MUST include ON DELETE behavior
--   parent data deleted → CASCADE or SET NULL (never silent orphan)
campaign_id INT REFERENCES affiliate_campaign(id) ON DELETE SET NULL

-- RULE DB-5: Index every foreign key column and every frequently-filtered column
CREATE INDEX IF NOT EXISTS idx_lead_stage ON lead(lead_stage);
CREATE INDEX IF NOT EXISTS idx_platform_api_log_platform ON platform_api_log(platform);

-- RULE DB-6: JSONB for flexible config/metadata. Typed columns for queryable data.
--   OK:    metadata JSONB DEFAULT '{}'
--   OK:    status VARCHAR(20) DEFAULT 'active'
--   NOT OK: storing serialized JSON as TEXT and then parsing in app

-- RULE DB-7: VARCHAR lengths must be intentional — not everything is VARCHAR(255)
--   Names/titles: VARCHAR(200)
--   URLs: VARCHAR(500)
--   Slugs/keys: VARCHAR(100)
--   Long text/content: TEXT
--   Short codes/enums: VARCHAR(20-50)
```

### Table Naming Conventions

| Pattern | Meaning | Example |
|---------|---------|---------|
| `ref_*` | Reference / lookup table, rarely changes | `ref_social_platform` |
| `platform_*` | Per-platform integration data | `platform_integration_config` |
| `market_*` | Market research module | `market_competitor` |
| `affiliate_*` | Affiliate program | `affiliate_partner` |
| `social_*` | Social intelligence | `social_platform_analytics` |
| `ai_*` | AI governance | `ai_governance_log` |
| `bot_*` | Customer service bot | `bot_session` |

### Connection (pg Pool)

```typescript
// ALWAYS import pool from the shared lib — never create a new Pool inline
import { pool } from '@/lib/db';

// ALWAYS release client after use
const client = await pool.connect();
try {
  const result = await client.query('SELECT $1 AS val', [input]);
  return result.rows;
} finally {
  client.release(); // NEVER skip this — connection leak
}
```

### Current DB Facts (2026-09-16)

- **Host:** `127.0.0.1:5437` · **DB:** `sohamyoga` · **User:** `sohamyoga`
- **27+ platform tables** · **221 registered modules** · **36 ref_social_platform rows**
- **Backup:** daily · **TLS:** required in production

---

## API Standard

> Full detail: [`docs/standards/API_STANDARD.md`](docs/standards/API_STANDARD.md)

### Route Structure

```
/api/admin/[module]/route.ts          → list (GET) + create (POST)
/api/admin/[module]/[id]/route.ts     → get/update/delete single
/api/admin/[module]/seed/route.ts     → GET: create tables + seed data
/api/admin/[module]/[action]/route.ts → specific operations

/api/customer/[module]/route.ts       → customer-facing (auth-gated)
/api/bot/[action]/route.ts            → public bot endpoints (session-token gated)
/api/[public]/route.ts                → truly public (rate-limited)
```

### Response Format (always consistent)

```typescript
// Success list
return NextResponse.json({ items: [], total: 0, page: 1 });

// Success single
return NextResponse.json({ item: {}, message: 'Created' }, { status: 201 });

// Error
return NextResponse.json({ error: 'Descriptive message' }, { status: 400 });

// NEVER return raw DB rows directly — always map to typed response objects
// NEVER return stack traces or internal error details to clients
```

### HTTP Status Codes

| Code | When |
|------|------|
| 200 | GET success, PATCH success |
| 201 | POST create success |
| 400 | Bad request — missing/invalid input |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate key) |
| 422 | Validation failed |
| 500 | Unexpected server error (log internally, return generic message) |

### Every API Route Must

- [ ] Import `pool` from `@/lib/db`
- [ ] Use parameterized queries
- [ ] Sanitize input with `sanitizeInput()`
- [ ] Return `NextResponse.json()` with explicit status
- [ ] Handle errors with try/catch — never let uncaught exceptions propagate
- [ ] Log high-risk operations to `security_audit_log`
- [ ] Not expose internal stack traces

### Ollama Call Pattern (AI routes)

```typescript
// Standard Ollama call — always with timeout and graceful fallback
async function callOllama(prompt: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s timeout
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2', prompt, stream: false }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return '[AI unavailable]';
    const data = await res.json();
    return data.response ?? '[No response]';
  } catch {
    return '[AI unavailable — Ollama may be down]';
  }
}
```

---

## Frontend Standard

> Full detail: [`docs/standards/FRONTEND_STANDARD.md`](docs/standards/FRONTEND_STANDARD.md)

### File Rules

```typescript
// RULE FE-1: All interactive pages MUST have 'use client' at the top
'use client';

// RULE FE-2: Server components (no 'use client') may NOT use useState/useEffect
// RULE FE-3: API calls from client components MUST use fetch() with error handling
// RULE FE-4: NO external UI component libraries (no shadcn, MUI, Chakra, Ant Design)
//            Tailwind CSS ONLY for styling
// RULE FE-5: NO inline styles (style={{}}) — use Tailwind classes
// RULE FE-6: TypeScript strict mode — no `any` type anywhere
//            If a type is unknown, define it: interface MyType { ... }
// RULE FE-7: Every page file exports a single default function named [Module]Page
```

### Admin Page Structure (mandatory)

Every admin page MUST follow this pattern:

```typescript
'use client';
import { useEffect, useState } from 'react';

interface DataItem { id: number; /* typed fields */ }

export default function MyModulePage() {
  const [items, setItems] = useState<DataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetch('/api/admin/my-module')
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setItems(d.items);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  const TABS = ['Overview', 'Detail', 'Settings'];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Module Name</h1>
      {/* Tab nav */}
      <div className="flex gap-2 border-b">
        {TABS.map(t => (
          <button key={t}
            onClick={() => setActiveTab(t.toLowerCase())}
            className={`px-4 py-2 text-sm font-medium ${activeTab === t.toLowerCase()
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>
      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab items={items} />}
    </div>
  );
}
```

### Navigation Rules

- Every new admin page MUST have a nav link added to `src/app/admin/layout.tsx`
- Every new customer page MUST have a nav link added to `src/app/customer/layout.tsx`
- Nav format: `{ href: '/admin/[route]', label: '[Emoji] [Name]', icon: <span>...</span>, requiredRoles: ['Admin'] }`
- Group related links under divider sections: `{ href: 'divider', label: 'Section Name', ... }`

### KPI Bar Pattern (all dashboards)

```typescript
// Every dashboard tab must open with a KPI bar
const KPI_ITEMS = [
  { label: 'Total', value: items.length, color: 'blue' },
  { label: 'Active', value: items.filter(i => i.status === 'active').length, color: 'green' },
];
// Render as: flex row, each item a card with colored number + label
```

---

## AI / Model Standard

> Full detail: [`docs/standards/AI_MODEL_STANDARD.md`](docs/standards/AI_MODEL_STANDARD.md)

### Model Selection

| Task | Model | Why |
|------|-------|-----|
| Content generation, adaptation | `llama3.2` (Ollama local) | Privacy-first, no data egress, free |
| Embeddings / semantic search | `nomic-embed-text` (Ollama) | 768-dim, fast, local |
| Complex reasoning / analysis | `llama3.2` or `llama3.1` | Configurable per task |
| Cloud fallback | OpenAI GPT-4 / Claude | Only when explicitly configured + API key set |

**Policy: Local Ollama FIRST. Cloud LLMs only with explicit env var + user opt-in.**

### Prompt Engineering Rules

```
RULE AI-1: Every prompt MUST include a role definition
           "You are a [role]. Your task is to [specific task]."

RULE AI-2: Output format MUST be specified in every prompt
           "Return ONLY valid JSON: {field: value}" or "Return ONLY the text, no preamble."

RULE AI-3: Character/token limits MUST be specified for content generation
           "Write exactly 280 characters for Twitter" — never let model decide length.

RULE AI-4: Prompts MUST NOT contain PII — use anonymized data
RULE AI-5: Prompts MUST be logged (input_summary, NOT full prompt if it contains user data)
RULE AI-6: Every AI call MUST have a 30-second timeout with graceful fallback
RULE AI-7: AI output MUST be sanitized before display (sanitizeInput())
RULE AI-8: Confidence scores MUST be logged to ai_governance_log
```

### Output Evaluation

Every AI output that influences a business decision MUST be evaluated on:

| Dimension | Threshold | Action if Below |
|-----------|-----------|-----------------|
| Confidence | ≥ 0.70 | Flag for human review |
| Fairness | ≥ 0.75 | Block + log bias_flag |
| Explainability | ≥ 0.60 | Add to human review queue |
| Relevance | Pass/Fail | Retry with improved prompt |
| Hallucination | 0 in 7 days | Alert if > 5/week per model |

### Latency SLOs

| Percentile | Target | Alert if Exceeded |
|------------|--------|-------------------|
| p50 | < 2,000ms | Yellow |
| p95 | < 8,000ms | Orange |
| p99 | < 15,000ms | Red — escalate |

### AI Governance (mandatory logging)

Every AI call MUST log to `ai_governance_log`:
```typescript
await pool.query(`
  INSERT INTO ai_governance_log
    (module_name, operation_type, model_used, input_summary, output_summary,
     decision_made, confidence_score, fairness_score, explainability_score)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
  [moduleName, opType, 'llama3.2', inputSummary, outputSummary,
   decision, confidence, fairness, explainability]
);
```

### Responsible AI Checklist (before any AI feature ships)

- [ ] **Transparency** — UI indicates when content is AI-generated
- [ ] **Human Override** — every AI decision can be overridden by a human
- [ ] **Privacy** — PII not sent to model, input logged as sanitized summary only
- [ ] **Fairness** — output checked for demographic/cultural bias before display
- [ ] **Accountability** — full audit trail in ai_governance_log
- [ ] **Safety** — output sanitized, max length enforced, injection-resistant
- [ ] **Explainability** — "Why did AI generate this?" must be answerable
- [ ] **Ethical** — no dark patterns, no manipulative content generation

---

## Cache Standard

> Full detail: [`docs/standards/CACHE_STANDARD.md`](docs/standards/CACHE_STANDARD.md)

### What to Cache

| Data Type | Cache Strategy | TTL | Location |
|-----------|---------------|-----|----------|
| Ollama responses (same prompt) | In-memory hash map (app-level) | None (permanent until restart) | `ai-orchestrator/app/main.py` |
| Platform rate limit state | `platform_rate_limit_snapshot` table | Hourly snapshot | PostgreSQL |
| Platform health status | `platform_health_check` table | 5-min snapshot | PostgreSQL |
| Static platform metadata | `PLATFORM_REGISTRY` TypeScript const | Build-time | `@sohamyoga/shared-social-platforms` |
| Module registry | In-memory at page load | Per-request | Next.js fetch cache |
| API responses (Next.js) | `fetch(url, { cache: 'no-store' })` | No cache for admin data | Client |

### Cache Invalidation Rules

```typescript
// RULE CACHE-1: Admin dashboard data → always fresh (no-store)
fetch('/api/admin/dashboard', { cache: 'no-store' })

// RULE CACHE-2: Public static data → revalidate every hour
fetch('/api/platform-list', { next: { revalidate: 3600 } })

// RULE CACHE-3: Ollama cache — only cache EXACT same provider+model+prompt combo
//               Cache key = SHA256(provider + model + prompt)
//               Invalidate via POST /cache/clear

// RULE CACHE-4: Rate limit cache — read from DB, never from memory
//               Platform rate limits change per API call — always DB truth

// RULE CACHE-5: Session data — stored in cookie-based sessions, not DB cache
//               Session expiry: 24h idle, 7d absolute max
```

### DB Query Performance Rules

```typescript
// RULE PERF-1: LIMIT all list queries — never SELECT * without LIMIT
await pool.query('SELECT * FROM platform_api_log ORDER BY created_at DESC LIMIT $1', [200]);

// RULE PERF-2: Use COUNT(*) queries separately — don't fetch rows just to count
const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM lead WHERE stage=$1', [stage]);

// RULE PERF-3: Paginate large datasets
const { page = 1, limit = 50 } = params;
const offset = (page - 1) * limit;
await pool.query('SELECT ... LIMIT $1 OFFSET $2', [limit, offset]);

// RULE PERF-4: Use transactions for multi-table writes
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO a ...', [...]);
  await client.query('INSERT INTO b ...', [...]);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally { client.release(); }
```

---

## Testing Standard

### Requirements (every PR)

- [ ] `npx tsc --noEmit` → **0 errors** (TypeScript strict)
- [ ] `npm test` → **all tests pass** (currently: 4,346/4,346)
- [ ] New feature → new test file in `src/__tests__/[domain]/[Feature].test.ts`
- [ ] Test coverage per feature: positive case + negative case + boundary case + e2e case
- [ ] Python: `uv run pytest` → all pass · New agent code → `tests/test_agents.py`

### Test File Template

```typescript
// src/__tests__/domain/MyFeature.test.ts
import { describe, it, expect, beforeEach } from 'vitest'; // or jest

describe('MyFeature', () => {
  describe('positive cases', () => {
    it('creates item with valid input', async () => { ... });
  });
  describe('negative cases', () => {
    it('rejects missing required fields', async () => { ... });
    it('rejects SQL injection attempt', async () => { ... });
  });
  describe('boundary cases', () => {
    it('handles max-length input', async () => { ... });
    it('handles empty array input', async () => { ... });
  });
  describe('e2e flow', () => {
    it('full user journey from create to publish', async () => { ... });
  });
});
```

### Test Evidence (saved per push)

Test results MUST be saved to `docs/testing/YYYY-MM-DD_[description].txt` and committed.  
See: `docs/testing/2026-09-16_test-run-results.txt` for example.

---

## Versioning & Release Standard

### Semantic Versioning

```
MAJOR.MINOR.PATCH — e.g. 2.1.0
│     │     └── Bug fixes, security patches — no API changes
│     └──────── New features, backward-compatible
└────────────── Breaking changes, major architectural shifts
```

Current version: **2.0.0** (platform integration suite)

### Commit Message Format

```
type(scope): short description

Body (optional — explain WHY not WHAT)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types: `feat` | `fix` | `docs` | `refactor` | `test` | `chore` | `security` | `perf`

### Git Rules

- `main` branch is always deployable
- No force-push to `main`
- No `--no-verify` to skip hooks
- No secrets in commits (pre-commit hook checks)
- Every push = TypeScript check + full test run + docs currency check

---

## Observability Standard

### What Must Be Logged

| Event | Log Table | Severity |
|-------|-----------|----------|
| Every platform API call | `platform_api_log` | Info |
| Platform health check | `platform_health_check` | Info |
| Rate limit snapshot | `platform_rate_limit_snapshot` | Info |
| Incoming webhook | `platform_webhook_event` | Info |
| Failed operation → retry | `platform_retry_queue` | Warning |
| Security event (login, key view, export) | `security_audit_log` | High |
| AI governance event | `ai_governance_log` | Info/Warning |
| Workflow execution | `platform_workflow_run` | Info |
| Agent run (LangChain) | `agent_run` (SQLite) | Info |

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API rate limit consumed | > 80% | > 95% |
| Platform health failures | 2 consecutive | 5 consecutive |
| Retry queue depth | > 10 pending | > 50 pending |
| OAuth token expiry | < 7 days | < 1 day |
| Test failure rate | Any failure | — |
| AI confidence score | < 0.70 | < 0.50 |
| Ollama latency p95 | > 8s | > 15s |

---

## AI Governance Standard

Applies to every AI feature: content generation, sentiment analysis, classification, recommendation, scheduling.

### Five Mandatory AI Governance Dimensions

**1. Explainable AI (XAI)**
- Every AI decision has a traceable input → model → output chain
- `ai_governance_log` records input_summary, output_summary, confidence_score
- "Explain Decision" feature available for every AI-generated item
- XAI Dashboard at `/admin/ai-governance` Tab 2

**2. Responsible AI (ResAI)**
- Transparency: UI labels AI-generated content with "✨ AI-generated"
- Privacy: PII never leaves the server (Ollama is local)
- Human override: every AI decision reversible within the platform
- ResAI compliance report generated quarterly

**3. Accountable AI**
- Complete audit chain: who triggered AI → what model → what decision → what action
- Human review queue: low-confidence or flagged decisions routed to human
- Override log: every human_override recorded with reason

**4. Fairness AI**
- Content generation checked for demographic stereotypes before display
- Fairness score logged per generation; threshold: ≥ 0.75
- Quarterly bias audit via Ollama self-assessment

**5. Ethical AI**
- EU AI Act alignment: human agency preserved, transparent, accountable
- No dark patterns in AI-generated marketing content
- No manipulative sentiment engineering
- Ethical AI report: `/admin/ai-governance` Tab 7

---

## GitHub Push Checklist

Before every `git push origin main`, verify:

### Tier 1 (mandatory, every push)

```
[ ] TypeScript: npx tsc --noEmit → 0 errors
[ ] Tests: npm test → all pass (currently 4,346/4,346)
[ ] Test results saved to docs/testing/YYYY-MM-DD_*.txt
[ ] No secrets staged: grep -r "sk-\|xoxb-\|ghp_\|AIza" --include="*.ts" src/
[ ] README.md reflects current module count, platform count, feature count
[ ] New pages have nav links in admin/customer layout
[ ] New DB tables use IF NOT EXISTS + ON CONFLICT DO NOTHING in seed
[ ] New API routes follow Response Format standard above
[ ] No `any` types introduced (npx tsc --strict)
[ ] Commit message follows type(scope): format
```

### Tier 2 (full audit, when explicitly requested)

Run the 18-phase engineering audit per `docs/standards/ENGINEERING_AUDIT_PHASES.md`.  
Output: `ENGINEERING_READINESS_SCORECARD.md` + `TOP_10_P0_P1_ACTIONS.md`.

---

## Architecture Reference

| Document | Contents |
|----------|----------|
| `docs/architecture/c4-level1-system-context.md` | C4 Level 1 — all external actors |
| `docs/architecture/c4-level2-containers.md` | C4 Level 2 — deployable units |
| `docs/architecture/c4-level3-components-social.md` | C4 Level 3 — social module |
| `docs/architecture/c4-level3-components-workflow.md` | C4 Level 3 — workflow engine |
| `docs/architecture/c4-level3-components-monitoring.md` | C4 Level 3 — monitoring |
| `docs/architecture/hld-high-level-design.md` | HLD — principles, data flows |
| `docs/architecture/lld-social-publishing.md` | LLD — sequence diagrams, state machine |
| `docs/architecture/lld-workflow-engine.md` | LLD — workflow execution flow |
| `docs/architecture/integration-architecture.md` | 36-platform integration map |
| `docs/architecture/process-flow-affiliate.md` | Affiliate lifecycle flow |
| `docs/architecture/cron-job-registry.md` | All 104 cron jobs documented |

---

*This document is the single source of truth for engineering standards on this project.  
Update it when standards change — a standard not written here is not enforced.*
