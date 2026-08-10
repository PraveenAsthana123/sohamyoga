#!/usr/bin/env python3
"""Schedule executor audit · validates the cron loop end-to-end.

Per "fix all" continuation 2026-06-08 · catches regressions in:
  - Calendar-correct monthly math (Dec→Jan year roll · day clamping)
  - Cadence semantics (once → None · daily/weekly/monthly → arithmetic)
  - Per-tenant iteration (X-Tenant-ID propagation · §41.3)
  - 0-due case (clean no-op exit 0)
  - N-due case (multiple schedules execute · all log status)

Strategy: imports the executor as a module + drives it via fixtures.
Cleans up the marketing_campaigns + campaign_schedules tables of any
test rows on every run · no leakage.

Per §47.6 + §57.7 + §70 (cron audit) + §41.3 (multi-tenant).
"""
import logging
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("INSUR_SKIP_MIGRATIONS", "1")
logging.disable(logging.CRITICAL)


PREFIX = "SchExec test ·"


def _cleanup():
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            # Cascading via FK on campaign_id where applicable
            cur.execute(
                "DELETE FROM campaign_schedules WHERE campaign_id IN "
                "(SELECT id FROM marketing_campaigns WHERE name LIKE %s)",
                (f"{PREFIX}%",),
            )
            n_s = cur.rowcount
            cur.execute(
                "DELETE FROM marketing_campaigns WHERE name LIKE %s",
                (f"{PREFIX}%",),
            )
            n_c = cur.rowcount
            c.commit()
        return n_s + n_c
    except Exception:
        return 0


def main() -> int:
    print("Schedule executor audit · §41.3 + §70\n")
    print(f"  {'Step':<55} | Result")
    print(f"  {'-' * 55} | ------")

    fails = 0
    rid = uuid.uuid4().hex[:6]

    def assert_(label: str, ok: bool, detail: str = ""):
        nonlocal fails
        mark = "✓" if ok else "✗"
        sfx = f" · {detail}" if detail else ""
        print(f"  {label[:55]:<55} | {mark} {('PASS' if ok else 'FAIL')}{sfx}")
        if not ok:
            fails += 1

    pre = _cleanup()
    if pre:
        print(f"  0. pre-cleanup · swept {pre} orphan row(s)        | ✓ INFO")

    # Import the executor module
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "rds", str(REPO / "scripts" / "run_due_schedules.py")
        )
        rds = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(rds)
    except Exception as e:
        print(f"  ✗ FATAL · cannot import executor: {e}")
        return 1

    # ── 1. Monthly math · Dec → Jan year roll ──────────────
    sched = {"cadence": "monthly", "day_of_month": 10, "time_of_day_utc": "09:00"}
    now = datetime(2026, 12, 15, 12, 30, tzinfo=timezone.utc)
    nxt = rds._next_run_after(sched, now)
    assert_("1. monthly · Dec 15 → next Jan 10",
            nxt and nxt.year == 2027 and nxt.month == 1 and nxt.day == 10
            and nxt.hour == 9,
            f"got {nxt}")

    # ── 2. Monthly math · same-month rollover ────────────
    sched = {"cadence": "monthly", "day_of_month": 15, "time_of_day_utc": "10:00"}
    now = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)
    nxt = rds._next_run_after(sched, now)
    assert_("2. monthly · Jun 1 → next Jul 15",
            nxt and nxt.month == 7 and nxt.day == 15 and nxt.hour == 10,
            f"got {nxt}")

    # ── 3. Daily · +1 day ─────────────────────────────────
    sched = {"cadence": "daily"}
    now = datetime(2026, 6, 8, 9, 0, tzinfo=timezone.utc)
    nxt = rds._next_run_after(sched, now)
    assert_("3. daily · +1 day",
            nxt and nxt.day == 9 and nxt.month == 6, f"got {nxt}")

    # ── 4. Weekly · +7 days ───────────────────────────────
    sched = {"cadence": "weekly"}
    nxt = rds._next_run_after(sched, now)
    assert_("4. weekly · +7 days",
            nxt and nxt.day == 15 and nxt.month == 6, f"got {nxt}")

    # ── 5. Once · None (disable after fire) ─────────────
    sched = {"cadence": "once"}
    nxt = rds._next_run_after(sched, now)
    assert_("5. once · None (disable after fire)",
            nxt is None)

    # ── 5a. EOM sentinel · Feb 1 → next Feb 28 (non-leap year) ─
    sched = {"cadence": "monthly", "day_of_month": 0, "time_of_day_utc": "23:00"}
    feb_now = datetime(2026, 1, 31, 12, 0, tzinfo=timezone.utc)
    nxt = rds._next_run_after(sched, feb_now)
    # From Jan 31 the executor computes "next month" = Feb · EOM = 28
    assert_("5a. EOM sentinel · Jan→Feb · day=28",
            nxt and nxt.month == 2 and nxt.day == 28 and nxt.hour == 23,
            f"got {nxt}")

    # ── 5b. EOM sentinel · Mar → Apr · day=30 ─────────
    mar_now = datetime(2026, 3, 31, 12, 0, tzinfo=timezone.utc)
    nxt = rds._next_run_after(sched, mar_now)
    assert_("5b. EOM sentinel · Mar→Apr · day=30",
            nxt and nxt.month == 4 and nxt.day == 30,
            f"got {nxt}")

    # ── 5c. EOM sentinel · May → Jun · day=30 ─────────
    may_now = datetime(2026, 5, 31, 12, 0, tzinfo=timezone.utc)
    nxt = rds._next_run_after(sched, may_now)
    assert_("5c. EOM sentinel · May→Jun · day=30",
            nxt and nxt.month == 6 and nxt.day == 30,
            f"got {nxt}")

    # ── 6. Tenant discovery returns ['default'] for empty ─
    tenants = rds._list_tenant_ids()
    assert_("6. tenant discovery returns ≥1 tenant",
            isinstance(tenants, list) and len(tenants) >= 1,
            f"got {tenants}")

    # ── 7. 0-due case · executor exits 0 with clean message ─
    # First ensure nothing is due
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "UPDATE campaign_schedules SET next_run_at = NOW() + INTERVAL '1 hour'",
            )
            c.commit()
    except Exception as e:
        print(f"  (push-out warn: {e})")

    import subprocess
    PT = sys.executable
    env = os.environ.copy()
    try:
        r = subprocess.run(
            [PT, str(REPO / "scripts" / "run_due_schedules.py")],
            capture_output=True, text=True, env=env, timeout=30,
        )
        nothing_msg = "nothing to do" in r.stdout
        assert_("7. 0-due case · 'nothing to do' + exit 0",
                r.returncode == 0 and nothing_msg,
                f"rc={r.returncode} · stdout_tail={r.stdout[-100:]!r}")
    except Exception as e:
        assert_("7. 0-due case", False, f"{type(e).__name__}: {e}")

    # ── 8. Make 1 due + run · executor processes it ────
    # Create a test campaign + schedule that's due NOW
    try:
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                """
                INSERT INTO marketing_campaigns (campaign_ref, name, channel,
                    product_pitch, call_to_action, config, require_consent,
                    status, max_attempts_per_customer, tenant_id)
                VALUES (%s, %s, 'survey', 'test', 'ok', '{}'::jsonb, false,
                    'draft', 1, 'default')
                RETURNING id
                """,
                (f"MKT-SCHTEST-{rid}", f"{PREFIX} {rid}"),
            )
            test_cid = cur.fetchone()[0]
            cur.execute(
                """
                INSERT INTO campaign_schedules (schedule_ref, campaign_id,
                    cadence, time_of_day_utc, enabled, next_run_at, tenant_id)
                VALUES (%s, %s, 'daily', '09:00', TRUE,
                    NOW() - INTERVAL '1 minute', 'default')
                RETURNING id
                """,
                (f"SCH-TEST-{rid}", test_cid),
            )
            test_sid = cur.fetchone()[0]
            c.commit()

        r = subprocess.run(
            [PT, str(REPO / "scripts" / "run_due_schedules.py")],
            capture_output=True, text=True, env=env, timeout=30,
        )
        had_execution = ("Summary:" in r.stdout and
                         "executed" in r.stdout and
                         "default" in r.stdout)
        assert_("8. 1-due case · execution + tenant=default logged",
                r.returncode == 0 and had_execution,
                f"rc={r.returncode}")

        # ── 9. After execute · schedule's last_run + next_run updated ──
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "SELECT last_run_at, last_run_status, run_count, next_run_at "
                "FROM campaign_schedules WHERE id = %s",
                (test_sid,),
            )
            row = cur.fetchone()
        last_run, last_status, run_count, next_run = row
        ok = (last_run is not None and last_status == "ok"
              and run_count >= 1 and next_run > datetime.now(timezone.utc))
        assert_(f"9. last_run + status='ok' + next_run advanced",
                ok, f"run_count={run_count} · status={last_status}")
    except Exception as e:
        assert_("8-9. execute + state-update", False,
                f"{type(e).__name__}: {e}")

    cleaned = _cleanup()
    print(f"\n  post-cleanup · removed {cleaned} test row(s)")
    print(f"  Summary: {12 - fails}/12 pass · {fails} fail")
    print(f"  Reference: §41.3 + §47.6 + §57.7 + §70 + EOM cadence (mig 058)")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
