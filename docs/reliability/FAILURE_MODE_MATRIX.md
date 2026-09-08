# Failure Mode Matrix — Phase 8

Verified 2026-09-08. Real failure scenarios — 2 of these actually happened during this audit and
were fixed live; the rest are constructed from verified code behavior, not hypothetical guessing.

| Scenario | What actually happens (verified) | Detected by? | Recovery |
|---|---|---|---|
| **Backend process receives clean SIGTERM** (e.g. a host reboot, a manual `systemctl stop`, an OOM-adjacent soft kill) | With `Restart=on-failure`: process stays dead indefinitely, dependent services (frontend, tunnel) keep running and serving a broken app | **Nothing — this audit found it manually, 4 days after the fact** | Manual restart (as done in Phase 1) or fix the restart policy (`Restart=always`, also done) |
| **Ollama unreachable** | Circuit breaker opens; dependent AI features fail closed with a clear error, not a crash or hang | Health-check endpoints report it; no alerting beyond that | Automatic — circuit breaker half-opens on a timer, per standard breaker pattern (not independently re-verified this pass) |
| **Postgres unreachable** | Pool throws after 5s; SohamYoga.Web's `/api/health` correctly flips to Unhealthy | `/api/health` endpoint, if polled | Automatic reconnect on pool recovery (standard `pg`/EF Core pool behavior, not independently re-verified) |
| **Auth backend (SohamYoga.Web) unreachable** | sohamyoga-frontend explicitly returns 503, not a silent allow or crash | Caller sees 503 | Manual — no auto-retry-with-backoff confirmed on this specific path |
| **Secrets vault (OpenBao) restarts** | **Confirmed real**: all stored secrets are lost (ephemeral -dev mode) — providers report `no_key`, not a crash | Provider health-check endpoints | Manual — secrets must be re-provisioned; no automated re-seed exists |
| **A scheduled cron job's host process dies** (market-research-portal, before this session's fix) | Jobs simply stop running — no error, no alert, just silence; discovered only via `job_run` staleness | **Nothing automated — this audit found it manually via a stale `job_run` timestamp** | Fixed this session: persistent systemd unit with `Restart=always` |
| **A `.next` production build is incomplete/corrupted** (market-research-portal, before this session's fix) | App serves live HTTP 500s on every request touching the broken route | **Nothing automated — no health check catches "build is broken," only "process is running"** | Fixed this session: rebuild + restart |
| **Two cron ticks overlap on the same job** | market-research-portal's `SelfHealJob` uses `FOR UPDATE SKIP LOCKED` — confirmed race-safe by a real self-caught-and-fixed bug (Phase 1 finding) | N/A — designed to be safe by construction | N/A |
| **A DB migration/schema change goes wrong** | No rollback path exists for 4 of 6 portals (Phase 4, DB-04) | Nothing automated | Manual hand-fix or restore from the backup taken this session (Phase 4) |
| **Rate-limit-worthy abuse of an unrated-limited endpoint** (e.g. voice-agent-platform's call-placement route) | No throttling — request proceeds normally regardless of volume | Nothing | Manual (see SECURITY_RISK_REGISTER SEC-06) |

## Pattern across all rows above

**The common thread: every failure mode that "just happened" during this audit (2 of 10 rows) was
caught by manual investigation, not automated detection.** Every automated detection that does exist
(health checks, circuit breakers, race-safe job claims) works correctly when tested, but nothing
watches the watchers — see [Phase 11 Observability](../observability/OBSERVABILITY_ARCHITECTURE.md)
for the direct consequence of this gap.
