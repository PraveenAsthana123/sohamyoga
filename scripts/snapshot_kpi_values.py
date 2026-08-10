#!/usr/bin/env python3
"""KPI values snapshot · T5.8 · hourly cron.

Per docs/PENDING_PLAN.md T5.8. Computes all 15 wired KPIs every hour
and persists to `kpi_snapshots` (migration 059) for trend analysis.

Cron: `0 * * * * /path/.../python scripts/snapshot_kpi_values.py`

Per §82.7 drift detection · this enables per-KPI trend lines in the
AdminAuditPage chart equivalent (operator-readable history of every KPI's
movement over time).
"""
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("INSUR_SKIP_MIGRATIONS", "1")
logging.disable(logging.CRITICAL)


def main() -> int:
    print(f"KPI snapshot · {datetime.now(timezone.utc).isoformat()}\n")
    print(f"  {'Step':<55} | Result")
    print(f"  {'-' * 55} | ------")

    try:
        from core.config import get_settings
        from marketing_kpis import computer
        import psycopg2
    except ImportError as e:
        print(f"  ✗ FATAL · {e}")
        return 1

    values = computer.compute_all()
    n_computed = sum(1 for v in values.values() if v is not None)
    print(f"  1. computed {n_computed}/{len(values)} KPIs")

    try:
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "INSERT INTO kpi_snapshots (values, kpi_count, tenant_id) "
                "VALUES (%s::jsonb, %s, 'default') RETURNING id",
                (json.dumps(values, default=str), n_computed),
            )
            snap_id = cur.fetchone()[0]
            c.commit()

            # Stats
            cur.execute(
                "SELECT COUNT(*) FROM kpi_snapshots WHERE tenant_id = 'default'",
            )
            total_snapshots = cur.fetchone()[0]

        print(f"  2. persisted snapshot · id={snap_id}")
        print(f"  3. total snapshots in DB                              | {total_snapshots}")
        print(f"  Reference: §82.7 + T5.8")
        return 0
    except Exception as e:
        print(f"  ✗ FATAL · {type(e).__name__}: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
