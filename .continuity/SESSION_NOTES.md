# Session Notes

## Goals
- Route every non-interactive terminal request through a durable local Ollama director.
- Maintain a story-driven quality matrix covering UI, API, accessibility, roles, data and every registered model.

## Blockers
- Live Facebook publishing is blocked until the owner supplies the Meta app secret, completes Facebook Page OAuth, grants the required permissions, and completes any required Meta app review.
- Postiz reports a Temporal worker connection failure because no Temporal service is configured; the web UI and orchestrator are reachable, but background publishing must not be considered production-ready until this is resolved.

## Key Decisions
- Playwright/Chrome CDP and axe are the deterministic test authority; Stagehand/CUA is a bounded, optional local-Ollama enhancement.
- The quality self-healer may restart known services and queue repair review, but may not silently rewrite or publish code.
- The assistant now uses the existing `/api/ai/health` probe and the chat endpoint will return a clear 503 when Ollama is unavailable.
- Plain `oll "request"` now persists a request, creates a multi-job plan, runs specialist workers, monitors and retries, verifies results, synthesizes a grounded response, and prints it in the terminal. `oll chat` remains the explicit direct-chat path.
- Terminal execution and the minute cron worker share `/tmp/oll_worker.lock` to prevent concurrent GPU model thrashing.
- Periodic warm-up cron jobs were removed because they evicted active role models; role models load on demand.
- Social publishing infrastructure runs on custom loopback ports (Postiz 15080/15081 and OpenBao 18200), with a minute credential-sync timer and secrets excluded from source control.
- Social MCP operations require an authenticated administrator; protected publish/schedule/retry calls require a matching, unexpired, one-time database approval rather than accepting an arbitrary client-provided identifier.
- Operational social screens must not present generated examples as real accounts, followers, approvals, or publications; remaining generated tenant matrices carry a prominent SYNTHETIC DEMO DATA label.

## Verification
- Unified Chrome quality run: 12 tests, 7 passed and 5 failed; the failures remain visible in the Quality Center.
- Stagehand V3 local Chrome smoke passed manually with the Ollama-compatible gateway configured; AI action was intentionally skipped.
- End-to-end request 2506 completed 3/3 planned jobs with zero failures, 6 lifecycle events, 4 tracked model calls, and a final terminal response.
- Focused queue/events/watchdog regression suite: 19 tests passed.
- Meta runtime check: OpenBao 200, Postiz 307, portal 200, callback redirect 307; Facebook credentials remain intentionally reported as missing.
- Social API authorization checks: `/api/social/meta-health`, `/api/social/setup`, and `/api/mcp/social` each return 401 without an authenticated admin session.
- TypeScript has pre-existing repository errors, but the focused compiler output contains no errors in the changed social pages, Meta routes, admin-auth helper, or MCP registry.
