# Bottleneck Register — Phase 9

Verified 2026-09-08. Real findings only — no synthetic bottleneck claims without evidence.

| ID | Bottleneck | Evidence | Severity (at current scale) | Severity (at 100+ users) |
|---|---|---|---|---|
| PERF-01 | nginx stale-DNS 502 on container restart (found live, fixed this session) | See PERFORMANCE_BASELINE.md | Was High (total outage of the public entrypoint) | N/A — now structurally fixed |
| PERF-02 | Postgres pool `max: 10` per portal, not stress-tested | `postgres.ts` in sohamyoga-frontend/market-research-portal | Low (1 user) | Medium-High — plausible real constraint, unverified |
| PERF-03 | In-memory, single-process rate limiter (market-research-portal) | `rate-limit.ts`, self-documented limitation | None (1 process today) | Medium — won't function correctly across multiple instances |
| PERF-04 | No caching layer anywhere in the repo | Confirmed absent in every `docker-compose.yml` | None today | Medium-High at scale — every request hits Postgres directly |
| PERF-05 | `node-cron` in-process scheduling — would double-execute jobs if a portal ever ran multiple instances | Code pattern confirmed in sohamyoga-frontend, market-research-portal | None (1 instance each today) | Medium — real risk only at horizontal-scale tier |
| PERF-06 | No load-testing tooling installed/configured anywhere in the repo | Repo-wide search, confirmed absent | N/A | This is a testing-capability gap, not a bottleneck itself — but it means none of the above can be *confirmed* as bottlenecks vs. structural risks until real load data exists |

## Priority

At current real scale (1 user, light local traffic), **none of these are urgent** — this register
exists to have the list ready, not to trigger premature work. If real user growth becomes concrete,
PERF-02 (connection pool sizing) and PERF-04 (no cache layer) are the two most likely to actually
bite first, based on structural reasoning (direct-to-DB architecture, small pool size) rather than
measurement.
