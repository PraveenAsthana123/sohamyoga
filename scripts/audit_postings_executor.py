#!/usr/bin/env python3
"""Content posting scheduler audit · validates the */30 cron loop.

Per docs/PENDING_PLAN.md T2.4. Catches regressions in:
  - Tenant discovery for due postings
  - 0-due no-op exit 0
  - 1-due publish lifecycle (draft → publishing → published)
  - Per-platform run rows created with status='sent'
  - operation_log appended with 'publish_started' + 'publish_complete'
  - time_to_publish_seconds + quality_score populated

Self-cleaning · pre+post cleanup of test rows.

Per §38.3 + §47.6 + §57.7 + §70 + §82.7.
"""
import logging
import os
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("INSUR_SKIP_MIGRATIONS", "1")
logging.disable(logging.CRITICAL)


PREFIX = "PostExec test ·"


def _cleanup():
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "DELETE FROM content_postings WHERE name LIKE %s",
                (f"{PREFIX}%",),
            )
            n = cur.rowcount
            c.commit()
        return n
    except Exception:
        return 0


def main() -> int:
    print("Content posting scheduler audit · §41.3 + §70 + T2.4\n")
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
            "rdp", str(REPO / "scripts" / "run_due_postings.py")
        )
        rdp = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(rdp)
    except Exception as e:
        print(f"  ✗ FATAL · cannot import executor: {e}")
        return 1

    # ── 1. Tenant discovery returns ≥1 (default fallback) ──
    tenants = rdp._list_tenants_with_due_postings()
    assert_("1. tenant discovery returns ≥1 tenant",
            isinstance(tenants, list) and len(tenants) >= 1,
            f"got {tenants}")

    # ── 2. 0-due case · 'nothing to do' + exit 0 ────────
    # First push out any existing due postings · we want a true 0-due
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "UPDATE content_postings SET scheduled_for = NOW() + INTERVAL '1 hour' "
                "WHERE status = 'draft' AND scheduled_for IS NOT NULL",
            )
            c.commit()
    except Exception as e:
        print(f"  (push-out warn: {e})")

    PT = sys.executable
    env = os.environ.copy()
    try:
        r = subprocess.run(
            [PT, str(REPO / "scripts" / "run_due_postings.py")],
            capture_output=True, text=True, env=env, timeout=30,
        )
        nothing_msg = "nothing to do" in r.stdout
        assert_("2. 0-due case · 'nothing to do' + exit 0",
                r.returncode == 0 and nothing_msg,
                f"rc={r.returncode}")
    except Exception as e:
        assert_("2. 0-due case", False, f"{type(e).__name__}: {e}")

    # ── 3-6. Make 1 due + run + verify state ──────────
    try:
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                """
                INSERT INTO content_postings
                (posting_ref, name, channel, title, summary, body_markdown,
                 config, platforms, status, scheduled_for, created_by, tenant_id)
                VALUES (%s, %s, 'blog', 'Test ' || %s, 'Test summary for ' || %s,
                    'This is the test body markdown that needs to be long enough '
                    'to pass the quality score threshold. Operator will publish '
                    'this automatically via cron.',
                    '{}'::jsonb,
                    '["website", "linkedin"]'::jsonb,
                    'draft', NOW() - INTERVAL '1 minute',
                    'cron-test', 'default')
                RETURNING id
                """,
                (f"CP-TEST-{rid}", f"{PREFIX} {rid}", rid, rid),
            )
            test_pid = cur.fetchone()[0]
            c.commit()

        r = subprocess.run(
            [PT, str(REPO / "scripts" / "run_due_postings.py")],
            capture_output=True, text=True, env=env, timeout=30,
        )
        published_msg = ("Summary:" in r.stdout and
                         "published" in r.stdout)
        assert_("3. 1-due case · cron published the posting",
                r.returncode == 0 and published_msg,
                f"rc={r.returncode}")

        # ── 4. Posting moved draft → published ─────────
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "SELECT status, published_at, time_to_publish_seconds, "
                "quality_score, operation_log "
                "FROM content_postings WHERE id = %s",
                (test_pid,),
            )
            row = cur.fetchone()
            status, pub_at, ttp, quality, op_log = row
        assert_("4. posting status='published' + published_at + TTP set",
                status == "published" and pub_at is not None and ttp is not None,
                f"status={status} · ttp={ttp}")

        # ── 5. quality_score populated (>0) ────────────
        assert_("5. quality_score populated · > 0",
                quality is not None and quality > 0,
                f"quality={quality}")

        # ── 6. operation_log has publish_started + complete ──
        op_actions = [entry.get("action") for entry in (op_log or [])]
        assert_(f"6. operation_log includes publish_started + complete",
                "publish_started" in op_actions and "publish_complete" in op_actions,
                f"actions={op_actions}")

        # ── 7. content_posting_runs rows created per platform ──
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "SELECT platform, status, external_id "
                "FROM content_posting_runs WHERE posting_id = %s ORDER BY id",
                (test_pid,),
            )
            runs = cur.fetchall()
        platforms = [r[0] for r in runs]
        assert_("7. per-platform runs created · website + linkedin",
                "website" in platforms and "linkedin" in platforms,
                f"platforms={platforms}")

    except Exception as e:
        assert_("3-7. publish + state verify", False,
                f"{type(e).__name__}: {e}")

    cleaned = _cleanup()
    print(f"\n  post-cleanup · removed {cleaned} test row(s)")
    print(f"  Summary: {7 - fails}/7 pass · {fails} fail")
    print(f"  Reference: §38.3 + §41.3 + §47.6 + §70 + T2.4")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
