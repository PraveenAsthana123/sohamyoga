# SohamYoga deep-audit evidence — 2026-08-08

This file contains deterministic observations for local Ollama code review. It is not itself a model-generated conclusion.

## Inventory

- 35 domain directories, 26 SQL schema files, 67 admin pages, 7 customer pages, 13 Next.js API routes, and 121 Jest suites.
- Domains without their own SQL schema file: banner, booking, campaign, community, coupon, documents, features, hr, membership, pose, scheduling, and teaching. Some concepts may be represented in shared schemas, but per-module schema ownership is absent.
- 74 production UI source files contain mock/demo/sample/placeholder markers; 14 source files contain TODO/FIXME/not-implemented/coming-soon markers.
- Only three API route families have explicit `requireAdmin` usage: marketing tenants, marketing automation, and AI models.

## Build and tests

- Jest: 121/121 suites passed; 4,229/4,229 tests passed.
- Production `next build`: failed at `src/app/admin/carousel/page.tsx:276`. A mixed boolean/number settings object is cast to `Record<string, boolean>`; `autoplayDelay` is numeric.
- There is no project Playwright/Puppeteer dependency or configured browser test suite. Existing Jest tests are predominantly domain-model tests.

## UI/browser evidence

- Development server returned HTTP 200 for 15 representative routes: `/`, `/admin`, carousel, marketing command, social setup, analytics, ecommerce, enterprise, pricing, notifications, workflows, health, integrations, students, and yoga.
- Headless Chrome captured zero console/page errors on those 15 initial page loads.
- This does not cover all 67 admin routes, dynamic routes, forms, authentication, clicks, responsive layouts, or cross-browser behavior.

## Database evidence

- Live PostgreSQL: 274 tables, 70 views, 274 primary keys, 274 foreign keys, 78 table names beginning with the current broad `ref_` count, and 26 recorded migrations.
- No business table lacks a primary key. PostgreSQL reports no unvalidated constraints.
- Product/service/org/tax/price/discount/transaction-related table-name scan found organization, product master/variant/image, pricing plan/rules/history, orders/order items, invoices, payments, loyalty/wallet/reward transactions, and an MCP backing service.
- Ecommerce embeds tax class, HSN, tax amount, discount amount, and coupon fields. There is no dedicated tax jurisdiction/rate/rule master table discovered, and no clearly dedicated discount master table in the migrated schema.
- The requirement that every module independently own primary master, reference, transaction, product/service, organization, tax, price, and discount tables is not met and may cause unnecessary duplication if implemented literally. These should normally be shared tenant-scoped platform masters referenced by modules.

## API and integration evidence

- `POST /api/config/credentials` has an explicit TODO for Keycloak admin verification and can write submitted secrets to OpenBao using the server root token without implemented caller authorization.
- `POST /api/social/setup` also has an explicit TODO for admin verification and can write provider credentials to OpenBao without implemented caller authorization.
- `POST /api/ai/agent` accepts goals without authentication. Empty goals correctly return 400; a valid goal returned 503 because the agent gateway at port 8091 was offline.
- AI health returned 200 with 39 installed Ollama models. AI monitoring returned 200 in `degraded` mode because the gateway was offline.
- Social provider setup metadata exists for Reddit, YouTube, Facebook, Instagram, LinkedIn, TikTok, Pinterest and others. This proves configuration scaffolding, not completed OAuth callbacks or successful provider publishing.

## Cron, observability, errors and self-healing

- PostgreSQL and the TypeScript cron container were running; the agent gateway on `127.0.0.1:8091` was not running.
- Recent cron logs repeatedly report schema/code mismatches: notification dispatch queries missing `recipient_id`; leaderboard refresh writes missing `student_id` and legacy period/XP columns.
- Ollama watchdog returned healthy, measured GPU/RAM/disk/queue state, and unloaded an idle model. Job events, model calls, retries, dead-lettering, leases and watchdog components exist in the agentic platform.
- Monitoring is degraded while the gateway is offline, so queue/tracing metrics are unavailable to the web dashboard.

## Load baseline

- k6 against the Next.js development server: 10 VUs for 15 seconds, 698 requests, 46.16 requests/second, 0% HTTP failure, average 216 ms, p95 340 ms, maximum 630 ms.
- Routes exercised: `/`, `/admin`, `/admin/marketing-command`, `/api/ai/health`.
- This is not a production load test: no production build, writes, authentication, database-heavy flows, uploads, social APIs, soak duration, spike test, or capacity breakpoint was tested.

## Review instructions

Review only the evidence above. Separate confirmed defects, coverage gaps, architectural recommendations, and tests still required. Do not claim that every module or integration works. Do not edit files.
