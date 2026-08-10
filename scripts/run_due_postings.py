#!/usr/bin/env python3
"""Content posting scheduler · publishes draft postings whose scheduled_for is due.

Per docs/PENDING_PLAN.md T2.4 + operator's earlier "schedule of campaign
daily, weekly, monthly" extended to job/blog content publishing.

Reads draft content_postings where `scheduled_for <= NOW()` and POSTs
`/postings/{id}/publish` against the same in-process FastAPI app the
schedule executor uses (no HTTP server required · cron-safe).

Per-tenant iteration via X-Tenant-ID header (§41.3 federated).
Per §38.3 audit row via posting's operation_log append (handled by
backend service).

Install cron:
  */30 * * * * /path/to/venv/bin/python scripts/run_due_postings.py \\
      > jobs/logs/posting-scheduler-$(date +%Y%m%d).log 2>&1
"""
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


def _list_tenants_with_due_postings() -> list[str]:
    """Discover all tenants with at least one due draft posting."""
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "SELECT DISTINCT tenant_id FROM content_postings "
                "WHERE status = 'draft' AND scheduled_for IS NOT NULL "
                "AND scheduled_for <= NOW()",
            )
            tenants = [row[0] for row in cur.fetchall() if row[0]]
        return tenants or ["default"]
    except Exception as e:
        print(f"  (tenant discovery warn: {type(e).__name__}: {e})")
        return ["default"]


def main() -> int:
    print(f"Content posting scheduler · {datetime.now(timezone.utc).isoformat()}\n")
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

    tenants = _list_tenants_with_due_postings()
    print(f"  1. tenants with due postings · {len(tenants)} ({', '.join(tenants[:5])})")

    settings = get_settings()
    all_due_ids: list[tuple[int, str]] = []  # (posting_id, tenant)
    for t in tenants:
        with psycopg2.connect(settings.database_url) as c, c.cursor() as cur:
            cur.execute(
                "SELECT id FROM content_postings "
                "WHERE tenant_id = %s AND status = 'draft' "
                "AND scheduled_for IS NOT NULL "
                "AND scheduled_for <= NOW() "
                "ORDER BY scheduled_for",
                (t,),
            )
            for row in cur.fetchall():
                all_due_ids.append((row[0], t))

    print(f"  2. total due postings across tenants · n={len(all_due_ids)}")
    if not all_due_ids:
        print("  → nothing to do")
        return 0

    success = failed = 0
    for pid, tenant in all_due_ids:
        # Publish via API · uses the posting's own .platforms list when body omits it
        r = client.post(
            f"/api/v1/content-ops/postings/{pid}/publish",
            json={},
            headers={"X-Tenant-ID": tenant},
        )
        if r.status_code == 200:
            d = r.json()
            success += 1
            print(f"  ▶ tenant={tenant:<15} posting {pid:>4} · "
                  f"runs={d.get('runs_created', 0)} · "
                  f"platforms={[run['platform'] for run in d.get('runs', [])]}")
        else:
            failed += 1
            print(f"  ✗ tenant={tenant:<15} posting {pid:>4} · "
                  f"publish failed http={r.status_code}")

    print(f"\n  Summary: {success} published · {failed} failed "
          f"of {len(all_due_ids)} due across {len(tenants)} tenants")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
