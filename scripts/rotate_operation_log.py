#!/usr/bin/env python3
"""Operation log rotation · §38.3 retention compliance · T3.3.

Per docs/PENDING_PLAN.md T3.3. Both `content_postings.operation_log`
and `autonomous_agent_runs.decisions` are JSONB arrays that grow
unboundedly as operators edit/agents iterate. This rotates entries
older than 90 days into the `operation_log_archive` table (migration 059)
and trims the live column.

Per §38.3 retention: full history preserved in archive · live column
keeps recent entries for operator-readable workflow context.

Cron: nightly · `0 3 * * * /path/.../python scripts/rotate_operation_log.py`
"""
import json
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


RETENTION_DAYS = int(os.environ.get("INSUR_OPLOG_RETENTION_DAYS", "90"))


def main() -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    print(f"Operation log rotation · cutoff={cutoff.isoformat()} (retention={RETENTION_DAYS}d)\n")
    print(f"  {'Step':<55} | Result")
    print(f"  {'-' * 55} | ------")

    try:
        from core.config import get_settings
        import psycopg2
        import psycopg2.extras
        settings = get_settings()
    except ImportError as e:
        print(f"  ✗ FATAL · {e}")
        return 1

    rotated_postings = 0
    rotated_agent_runs = 0
    archived_entries = 0

    try:
        with psycopg2.connect(settings.database_url) as c, \
             c.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # ── content_postings.operation_log ──────────
            cur.execute(
                "SELECT id, posting_ref, operation_log, tenant_id "
                "FROM content_postings WHERE jsonb_array_length(operation_log) > 0",
            )
            postings = cur.fetchall()
            print(f"  scan content_postings · {len(postings)} rows with non-empty logs")

            for row in postings:
                entries = row["operation_log"] or []
                old_entries = []
                new_entries = []
                for e in entries:
                    ts_str = e.get("timestamp")
                    if not ts_str:
                        new_entries.append(e)
                        continue
                    try:
                        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                    except Exception:
                        new_entries.append(e)
                        continue
                    if ts < cutoff:
                        old_entries.append(e)
                    else:
                        new_entries.append(e)

                if not old_entries:
                    continue

                # Archive
                tss = [
                    e.get("timestamp") for e in old_entries
                    if e.get("timestamp")
                ]
                oldest = min(tss) if tss else None
                newest = max(tss) if tss else None
                cur.execute(
                    """
                    INSERT INTO operation_log_archive
                    (source_table, source_id, source_ref, entries, entry_count,
                     oldest_entry_at, newest_entry_at, tenant_id)
                    VALUES ('content_postings', %s, %s, %s::jsonb, %s, %s, %s, %s)
                    """,
                    (row["id"], row["posting_ref"],
                     json.dumps(old_entries), len(old_entries),
                     oldest, newest, row["tenant_id"]),
                )
                # Trim live column
                cur.execute(
                    "UPDATE content_postings SET operation_log = %s::jsonb "
                    "WHERE id = %s",
                    (json.dumps(new_entries), row["id"]),
                )
                rotated_postings += 1
                archived_entries += len(old_entries)

            # ── autonomous_agent_runs.decisions ──────
            cur.execute(
                "SELECT id, run_ref, decisions, tenant_id "
                "FROM autonomous_agent_runs "
                "WHERE jsonb_array_length(decisions) > 0",
            )
            runs = cur.fetchall()
            print(f"  scan autonomous_agent_runs · {len(runs)} rows with non-empty decisions")

            for row in runs:
                entries = row["decisions"] or []
                old_entries = []
                new_entries = []
                for e in entries:
                    ts_str = e.get("timestamp")
                    if not ts_str:
                        new_entries.append(e)
                        continue
                    try:
                        ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                    except Exception:
                        new_entries.append(e)
                        continue
                    if ts < cutoff:
                        old_entries.append(e)
                    else:
                        new_entries.append(e)

                if not old_entries:
                    continue

                tss = [e.get("timestamp") for e in old_entries if e.get("timestamp")]
                oldest = min(tss) if tss else None
                newest = max(tss) if tss else None
                cur.execute(
                    """
                    INSERT INTO operation_log_archive
                    (source_table, source_id, source_ref, entries, entry_count,
                     oldest_entry_at, newest_entry_at, tenant_id)
                    VALUES ('autonomous_agent_runs', %s, %s, %s::jsonb, %s, %s, %s, %s)
                    """,
                    (row["id"], row["run_ref"],
                     json.dumps(old_entries), len(old_entries),
                     oldest, newest, row["tenant_id"]),
                )
                cur.execute(
                    "UPDATE autonomous_agent_runs SET decisions = %s::jsonb "
                    "WHERE id = %s",
                    (json.dumps(new_entries), row["id"]),
                )
                rotated_agent_runs += 1
                archived_entries += len(old_entries)

            c.commit()

            # ── Summary stats ───────────────
            cur.execute("SELECT COUNT(*) AS n FROM operation_log_archive")
            total_archive = cur.fetchone()["n"]

        print(f"\n  rotated content_postings rows                          | {rotated_postings}")
        print(f"  rotated autonomous_agent_runs rows                     | {rotated_agent_runs}")
        print(f"  archived entries this run                              | {archived_entries}")
        print(f"  total archive table size                               | {total_archive}")
        print(f"  Reference: §38.3 + T3.3 retention={RETENTION_DAYS}d")
        return 0
    except Exception as e:
        print(f"  ✗ FATAL · {type(e).__name__}: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
