#!/usr/bin/env python3
"""Campaign schedule executor · cron-friendly.

Per operator 2026-06-08: "schedule of campaign daily, weekly, monthly"

Reads /api/v1/content-ops/schedules/due via in-process TestClient (no
HTTP server required) · for each due schedule, POSTs /execute against
the associated marketing_campaign · updates next_run_at + last_run_at.

Install via cron every 15 min:
  */15 * * * * /path/to/venv/bin/python scripts/run_due_schedules.py \\
                > jobs/logs/scheduler-$(date +%Y%m%d).log 2>&1

Per §38.3 (audit per execution) · §47.4 (correlation_id) · §70 (cron
pattern) · §82.7 (last_run_status surface for drift detection).
"""
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("INSUR_SKIP_MIGRATIONS", "1")
logging.disable(logging.CRITICAL)


def _next_run_after(schedule, now):
    """Compute the next next_run_at after the just-fired one.

    Calendar-correct monthly math: rolls year on December → January.
    Preserves day_of_month from the original schedule when present.
    """
    cadence = schedule["cadence"]
    if cadence == "once":
        return None  # one-shot · disable after first run
    if cadence == "daily":
        return now + timedelta(days=1)
    if cadence == "weekly":
        return now + timedelta(days=7)
    if cadence == "monthly":
        dom = schedule.get("day_of_month")
        tod = schedule.get("time_of_day_utc") or "09:00"
        hh, mm = (int(x) for x in tod.split(":"))
        year = now.year + (1 if now.month == 12 else 0)
        month = 1 if now.month == 12 else now.month + 1
        if dom == 0:
            # Last day of next month · resolves per-month (Feb→28, Apr→30, etc.)
            if month == 12:
                day = 31
            else:
                next_month_start = datetime(
                    year + (1 if month == 12 else 0),
                    1 if month == 12 else month + 1, 1, tzinfo=timezone.utc,
                )
                day = (next_month_start - timedelta(days=1)).day
        else:
            # Clamp 1-28 (schema enforces) · None → day 1
            day = min(int(dom or 1), 28)
        return datetime(year, month, day, hh, mm, tzinfo=timezone.utc)
    return None


def _list_tenant_ids() -> list[str]:
    """Discover all tenants with at least one schedule.

    Empty list → fall back to 'default' so single-tenant deployments
    still work without explicit tenant rows.
    """
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT tenant_id FROM campaign_schedules "
                "WHERE enabled = TRUE "
                "AND next_run_at IS NOT NULL AND next_run_at <= NOW()",
            )
            tenants = [row[0] for row in cur.fetchall() if row[0]]
        return tenants or ["default"]
    except Exception as e:
        print(f"  (tenant discovery warn: {type(e).__name__}: {e})")
        return ["default"]


def main() -> int:
    print(f"Schedule executor · {datetime.now(timezone.utc).isoformat()}\n")
    print(f"  {'Step':<55} | Result")
    print(f"  {'-' * 55} | ------")

    try:
        from main import create_app
        from fastapi.testclient import TestClient
        from core.config import get_settings
        import psycopg2
    except ImportError as e:
        print(f"  ✗ FATAL: {e}")
        return 1

    app = create_app()
    client = TestClient(app)

    # 1. Discover all tenants with due schedules · iterate per-tenant
    tenants = _list_tenant_ids()
    print(f"  1. tenants with due schedules · {len(tenants)} ({', '.join(tenants[:5])}{'…' if len(tenants) > 5 else ''})")

    all_due = []
    for t in tenants:
        r = client.get(
            "/api/v1/content-ops/schedules/due",
            headers={"X-Tenant-ID": t},
        )
        if r.status_code != 200:
            print(f"  ✗ /schedules/due failed for tenant '{t}': {r.status_code}")
            continue
        for sched in r.json():
            sched["_tenant_id"] = t
            all_due.append(sched)

    print(f"  2. total due schedules across tenants · n={len(all_due)}")
    if not all_due:
        print("  → nothing to do")
        return 0

    # 3. For each due · execute the associated campaign + update schedule
    success = 0
    failed = 0
    now = datetime.now(timezone.utc)
    settings = get_settings()

    for sched in all_due:
        sid = sched["id"]
        cid = sched["campaign_id"]
        tenant = sched.get("_tenant_id", "default")
        # Execute with tenant header propagated · per §41.3 multi-tenant scoping
        r = client.post(
            f"/api/v1/marketing-campaigns/{cid}/execute",
            json={},
            headers={"X-Tenant-ID": tenant},
        )
        ok = r.status_code == 200
        runs_created = r.json().get("runs_created", 0) if ok else 0

        # Update schedule: last_run + next_run
        next_run = _next_run_after(sched, now)
        status = "ok" if ok else "failed"
        try:
            with psycopg2.connect(settings.database_url) as c, c.cursor() as cur:
                cur.execute(
                    """
                    UPDATE campaign_schedules
                    SET last_run_at = NOW(),
                        last_run_status = %s,
                        run_count = run_count + 1,
                        next_run_at = %s,
                        enabled = CASE WHEN %s IS NULL THEN FALSE ELSE enabled END
                    WHERE id = %s
                    """,
                    (status, next_run, next_run, sid),
                )
                c.commit()
        except Exception as e:
            print(f"  ✗ UPDATE failed for schedule {sid}: {e}")
            failed += 1
            continue

        if ok:
            success += 1
            print(f"  ▶ tenant={tenant:<15} sched {sid:>4} · campaign {cid:>4} · cadence={sched['cadence']:<7}"
                  f" runs={runs_created} · next={next_run.isoformat() if next_run else 'DISABLED'}")
        else:
            failed += 1
            print(f"  ✗ tenant={tenant:<15} sched {sid:>4} · campaign {cid:>4} · execute failed (http={r.status_code})")

    print(f"\n  Summary: {success} executed · {failed} failed of {len(all_due)} due across {len(tenants)} tenants")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
