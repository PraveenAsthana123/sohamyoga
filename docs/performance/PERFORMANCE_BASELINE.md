# Performance Baseline — Phase 9

Verified 2026-09-08 via live measurement (curl timing, `docker stats`, DB query timing). No
synthetic load was generated — these are single-request measurements against the live local
deployment, not a load test. See [SCALABILITY_PLAN.md](SCALABILITY_PLAN.md) for what would be needed
to say anything about concurrency.

## Real, measured latencies

| Endpoint | Latency (single request) | Note |
|---|---|---|
| sohamyoga-frontend `/` (via nginx) | 6-16ms (post-fix; was 502/timeout before the nginx fix below) | |
| sohamyoga-frontend `/api/health` (direct, bypassing nginx) | 5-13ms across 5 samples | |
| SohamYoga.Web `/api/health` | 20ms | Includes a real DB connectivity check |
| market-research-portal `/login` | 180ms | First real page render after the Phase 1 rebuild |
| Postgres `SELECT count(*) FROM module_registry` | 6.2ms | Simple query, small table |

## 🔴 A third live incident found during this phase: nginx serving 502 on the public entrypoint

**Finding PERF-01 (High, now fixed):** `curl` to nginx's exposed port (8085, the actual public
entrypoint for sohamyoga-frontend) returned **HTTP 502** during initial measurement, while the
frontend container itself responded correctly on its own port. Root cause, confirmed by direct
investigation: nginx's `upstream frontend { server frontend:3010; }` block resolves the container
hostname **once, at nginx's own startup** — the frontend container restarted 2026-09-07 (a day after
nginx last started, 2026-09-03) and got a new Docker-internal IP, which nginx never re-resolved. No
`resolver` directive existed to force periodic re-resolution.

**Fixed live**: restarted nginx (immediate recovery, verified 200 OK), then applied the structural
fix — added `resolver 127.0.0.11 valid=10s;` (Docker's embedded DNS) and converted both
`proxy_pass` targets to variable-based dynamic resolution (`set $frontend_upstream frontend:3010;
proxy_pass http://$frontend_upstream;`), removing the static `upstream {}` blocks that caused the
one-time-only resolution. Verified: config reloads clean, site now responds in 6-16ms, and this
exact failure mode cannot recur on a future independent frontend/backend restart.

**Discovery note:** the container's bind-mounted config view was itself stale after the file edit —
`docker exec ... nginx -s reload` alone did not pick up the change (110 vs. 112 lines mismatch
persisted); a full `docker restart` was required to force the mount to reflect current content. This
is itself a minor operational quirk worth remembering for any future nginx.conf edit on this host.

## Container resource footprint (live, idle/light-load — not stress-tested)

| Container | CPU | Memory |
|---|---|---|
| sohamyoga-frontend | ~0% | 43 MB |
| sohamyoga-backend (.NET) | ~0.06% | 40 MB |
| sohamyoga-postgres | ~0% | 92 MB |
| sohamyoga-nginx | ~0% | 2 MB |
| sohamyoga-cron | ~0.12% | 32 MB |
| voiceagent-postgres | ~0% | 17 MB |
| Other self-hosted infra found running (Postiz, Mautic, ActivePieces, ContextForge) | 0.4-11% | 5-372 MB each |

All figures are extremely light — consistent with a local dev/single-operator deployment carrying
no real production traffic. None of this indicates anything about production scale; see
[SCALABILITY_PLAN.md](SCALABILITY_PLAN.md).

## What this document does NOT contain

No load test was run (no k6/Locust/Artillery/JMeter found installed or configured in this repo — a
real, stated gap). No token-usage/cost data for Ollama/OpenAI/Claude calls was measured this pass
(see [Phase 10 AI maturity](../ai/AI_AGENT_INVENTORY.md) for what AI-specific metrics exist). No N+1
query analysis was performed — would require query logging under real traffic, not available here.
