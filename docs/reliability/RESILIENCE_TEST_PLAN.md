# Resilience Test Plan — Phase 8

Verified 2026-09-08. Proposed drills, with 2 already effectively run (unplanned, but real) during
this audit.

## Drills already run (unplanned, real, during this audit)

| Drill | What happened | Result |
|---|---|---|
| Backend-process-death recovery | Found ai-orchestrator-platform's backend already dead 4+ days; restarted it, verified `/health` recovered from refused/502 to a correct 401 | **Passed after fix** — confirms the app recovers cleanly once the process restarts; the gap was purely in restart automation, not application state corruption |
| Broken-build recovery | Found market-research-portal serving 500s from a corrupted build; rebuilt, restarted, verified `/login` and `/api/voice-ai` returned correct status codes | **Passed after fix** — confirms a clean rebuild fully recovers the app, no residual corruption |

Both drills are evidence that the *applications themselves* are resilient to a clean
restart/rebuild — the gap was entirely in **automated detection and restart policy**, not in
in-app state management or data corruption risk.

## Proposed drills (not yet run — safe, low-risk, recommended)

| Drill | Method | Safety | Value |
|---|---|---|---|
| Kill `sohamyoga-postgres` container for 60s, observe app behavior | `docker stop`/`docker start` on a non-critical time window | Low risk — no data loss, container restart is clean | Confirms the 5s connection-timeout + reconnect behavior claimed in RELIABILITY_DESIGN.md actually works, not just configured |
| Stop Ollama daemon, exercise an AI-dependent feature | `systemctl stop ollama` briefly | Low risk | Confirms the circuit breaker actually opens and fails closed under real conditions, not just in code review |
| Send SIGTERM to `sohamyoga-backend` (.NET) and observe whether nginx/frontend degrade gracefully | `docker kill -s TERM` | Low-medium — brief real downtime for the .NET backend | Confirms whether the same "silent death" pattern found in ai-orchestrator-platform also affects the Docker-managed services (Docker's own `restart: unless-stopped` policy in `docker-compose.yml` differs from systemd's `Restart=on-failure` and may not have the same gap — worth confirming, not assuming) |
| Simulate two overlapping cron ticks on `SelfHealJob` | Manually trigger the job twice in quick succession | Low risk (already designed to be race-safe per Phase 1 finding) | Empirically confirms the `FOR UPDATE SKIP LOCKED` protection under real concurrency, not just code review |
| Restart the OpenBao vault mid-session and observe provider behavior | Already effectively done once this session (Phase 1 fix) — repeat deliberately | Low risk | Confirms the `no_key` fail-closed behavior is consistent, not a one-time observation |

## Not proposed (out of scope / not safe for this audit)

Load/chaos testing at scale (simulating 1,000+ concurrent users, deliberately corrupting a database,
killing a container mid-write to test partial-transaction recovery) is not proposed here — these
carry real risk to the one existing dataset (even with the Phase 4 backup in place, minimizing
avoidable risk is still the right default) and are better scoped as a deliberate, separately-approved
exercise once real production traffic exists to justify the investment, not a documentation-audit
action.
