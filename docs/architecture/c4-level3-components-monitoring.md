# C4 Level 3 — Components: Platform Monitoring & Debugging

**Verified:** 2026-09-15 — grounded in `src/cron/jobs/PlatformHealthCheckJob.ts` (read directly:
table DDL, `HEALTH_ENDPOINTS` map with 13 known API endpoints), `src/cron/jobs/ApiLogCleanupJob.ts`
(retention policy), `src/cron/CronRegistry.ts` (schedules), route inspection of
`/api/admin/platform-monitoring/`.

## Component Diagram

```mermaid
graph TB
    Admin([Admin / Developer]):::actor

    subgraph "Next.js Frontend — Monitoring Components"
        PMH[Platform Monitoring Hub\n/admin/platform-monitoring\n8-tab observability UI\nHealth · Rate limits · Logs\nWebhooks · Retry queue\nDebug · Scenarios · Credentials]:::component
        DEBUG[Platform Debug Console\n/admin/platform-monitoring/debug/[platform]\nPer-platform deep-dive\nLive API test calls\nLog tail]:::component
        APICAT[API Catalog\n/admin/platform-api-catalog\nDocumented API endpoints\nper platform]:::component
    end

    subgraph "Monitoring Cron Jobs"
        PHCJ[PlatformHealthCheckJob\nSchedule: */5 * * * *\nHEAD request to 13 known API endpoints\nAll 36 platforms in ref_social_platform\nInserts platform_health_check row per platform\nPrunes to last 1000 rows per platform\ntimeoutMs: 120_000]:::job
        RLSJ[RateLimitSnapshotJob\nSchedule: 0 * * * * (hourly)\nSnapshots rate limit state\nfor all 36 platforms\nReal Facebook/Instagram headers when creds set\nSynthetic otherwise\nPrunes to last 168 rows per platform]:::job
        RQJ[RetryQueueJob\nSchedule: */15 * * * *\nProcesses platform_retry_queue items\nwhere next_retry_at is due\nExponential backoff\nMax attempts exhaustion\ntimeoutMs: 60_000]:::job
        ALCJ[ApiLogCleanupJob\nSchedule: 0 3 * * * (daily 3am)\nDeletes platform_api_log rows >30 days\nDeletes platform_health_check rows >7 days\nDeletes processed platform_webhook_event >30 days\nDeletes completed platform_retry_queue >30 days]:::job
        AQMJ[ApiQuotaMonitorJob\nSchedule: 0 */4 * * * (every 4h)\nAggregates today API call counts\ninto platform_api_quota\nFires social_alert_event at 85% daily quota]:::job
    end

    subgraph "PostgreSQL Tables — Monitoring"
        PAL[platform_api_log\nBIGSERIAL id\nPer-API-call log\nplatform · endpoint · method\nhttp_status · latency_ms · error_msg\ntenant_id · created_at]:::table
        PHC[platform_health_check\nSERIAL id\nplatform · status\nlatency_ms · http_status\nerror_message · api_endpoint_checked\nchecked_at TIMESTAMPTZ\nRetained: last 1000 per platform]:::table
        PRLS[platform_rate_limit_snapshot\nHourly snapshots\nrequests_remaining · reset_at\nRetained: last 168 per platform]:::table
        PWE[platform_webhook_event\nIncoming webhook events\nplatform · event_type · payload\nprocessed BOOLEAN\nReceived webhook signature verified]:::table
        PRQ[platform_retry_queue\nFailed operation queue\noperation_type · payload\nattempts · max_attempts\nnext_retry_at · status\nExponential backoff state]:::table
        PAQ[platform_api_quota\nDaily quota aggregation\nplatform · call_count\nquota_limit · alert_fired]:::table
    end

    subgraph "Known Health-Check Endpoints (13 real URLs)"
        EP1[facebook: graph.facebook.com/v18.0/]:::endpoint
        EP2[instagram: graph.instagram.com/v18.0/]:::endpoint
        EP3[twitter/x_twitter: api.twitter.com/2/tweets]:::endpoint
        EP4[linkedin: api.linkedin.com/v2/]:::endpoint
        EP5[youtube: googleapis.com/youtube/v3/]:::endpoint
        EP6[github: api.github.com/]:::endpoint
        EP7[gitlab: gitlab.com/api/v4/]:::endpoint
        EP8[pinterest: api.pinterest.com/v5/]:::endpoint
        EP9[reddit: reddit.com/api/v1/]:::endpoint
        EP10[discord: discord.com/api/v10/]:::endpoint
        EP11[tiktok: open.tiktokapis.com/v2/]:::endpoint
        EP12[medium: api.medium.com/v1/]:::endpoint
    end

    Admin --> PMH
    Admin --> DEBUG
    Admin --> APICAT
    PMH --> PHC
    PMH --> PRLS
    PMH --> PAL
    PMH --> PWE
    PMH --> PRQ
    DEBUG --> PAL
    PHCJ --> PHC
    PHCJ --> EP1
    PHCJ --> EP2
    PHCJ --> EP3
    PHCJ --> EP4
    PHCJ --> EP5
    PHCJ --> EP6
    RLSJ --> PRLS
    RQJ --> PRQ
    ALCJ --> PAL
    ALCJ --> PHC
    ALCJ --> PWE
    ALCJ --> PRQ
    AQMJ --> PAQ

    classDef actor fill:#d4e6f1,stroke:#2c5282,color:#1a1a1a
    classDef component fill:#1e40af,color:#ffffff,stroke:#1e3a8a
    classDef job fill:#f3e5f5,stroke:#7c3aed,color:#1a1a1a
    classDef table fill:#d4edda,stroke:#155724,color:#1a1a1a
    classDef endpoint fill:#fff8e1,stroke:#f57f17,color:#1a1a1a
```

## Health Check Logic (verified from `PlatformHealthCheckJob.ts`)

For each of the 36 platforms in `ref_social_platform`:

1. If the platform has a known API endpoint in `HEALTH_ENDPOINTS` (13 platforms): attempt a HEAD
   request with a 5-second timeout
2. If the HEAD returns 2xx/3xx/4xx (auth-gated but reachable): status = `healthy`
3. If network error or 5xx: status = `degraded` or `down`
4. If no known endpoint: status = `unknown`
5. Insert one `platform_health_check` row per platform
6. Prune old rows: `DELETE WHERE platform = $1 ORDER BY id ASC` keeping last 1000

## Retry Queue Backoff Strategy

From `RetryQueueJob.ts` (CronRegistry description: "exponential backoff, marks exhausted after
max_attempts"):

```
attempt 1 → next_retry_at = NOW() + 2 min
attempt 2 → next_retry_at = NOW() + 4 min
attempt 3 → next_retry_at = NOW() + 8 min
attempt N → next_retry_at = NOW() + 2^N min
max_attempts → status = exhausted
```

## Log Retention Policy (from `ApiLogCleanupJob.ts`)

| Table | Retention |
|---|---|
| `platform_api_log` | 30 days |
| `platform_health_check` | 7 days |
| `platform_webhook_event` (processed=true) | 30 days |
| `platform_retry_queue` (completed/exhausted) | 30 days |
| `platform_rate_limit_snapshot` | Last 168 rows per platform (~1 week of hourly snapshots) |

## Monitoring Coverage Gap (honest finding)

The `PlatformHealthCheckJob` pings API endpoints regardless of whether credentials are configured.
A `healthy` status means the external API is reachable — not that this tenant's account is
authenticated and functional. Authentication-level health is separate and requires actual API calls
with tenant credentials, which would consume quota. This distinction is noted in the job's own
description: "HEAD request to known API endpoints."
