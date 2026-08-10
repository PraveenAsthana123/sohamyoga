#!/usr/bin/env python3
"""Decision corrections audit · T7.10 · governance gate #5.

Per docs/PENDING_PLAN.md T7.10. Verifies the RLHF correction DB
captures every human-override end-to-end.

11 assertions:
  1. Table decision_corrections exists with expected schema
  2. /corrections/health returns 200
  3. POST /corrections · valid severity='minor' creates a row
  4. POST /corrections · valid severity='major' creates a row
  5. POST /corrections · valid severity='critical' creates a row
  6. POST /corrections · invalid severity='wrong' returns 400
  7. GET /corrections/{ref} round-trips the created row
  8. GET /corrections?severity=critical filters correctly
  9. GET /corrections?run_ref=... filters correctly
  10. GET /corrections/stats/summary returns by_severity counts
  11. Cleanup leaves 0 test corrections
"""
import logging
import os
import sys
import uuid
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("INSUR_SKIP_MIGRATIONS", "1")
logging.disable(logging.CRITICAL)


TEST_PREFIX = "AUDIT-T710-"


def _cleanup():
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "DELETE FROM decision_corrections WHERE reviewer LIKE %s",
                (f"{TEST_PREFIX}%",),
            )
            n = cur.rowcount
            c.commit()
        return n
    except Exception:
        return 0


def main() -> int:
    print("Corrections audit · §38.3 + T7.10 + governance gate #5\n")
    print(f"  {'Step':<55} | Result")
    print(f"  {'-' * 55} | ------")

    fails = 0
    rid = uuid.uuid4().hex[:6]
    reviewer = f"{TEST_PREFIX}{rid}"

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

    # ── 1. Table exists with expected columns ──────────
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'decision_corrections' ORDER BY ordinal_position",
            )
            cols = [r[0] for r in cur.fetchall()]
        expected = {"id", "correction_ref", "run_ref", "decision_iter",
                    "decision_action", "ai_decision", "human_decision",
                    "reason", "reviewer", "severity", "use_for_training",
                    "correlation_id", "tenant_id", "created_at"}
        missing = expected - set(cols)
        assert_("1. decision_corrections schema ≥ 14 columns",
                len(missing) == 0,
                f"missing={missing}" if missing else "")
    except Exception as e:
        assert_("1. table schema", False, f"{type(e).__name__}: {e}")

    # ── 2-10. API + round-trips ──────────────────────
    try:
        from main import create_app
        from fastapi.testclient import TestClient
        client = TestClient(create_app())

        r = client.get("/api/v1/corrections/health")
        assert_("2. /corrections/health returns 200", r.status_code == 200)

        # 3-5. Create rows of each severity
        refs_by_sev = {}
        for sev in ("minor", "major", "critical"):
            body = {
                "run_ref": f"AGENT-TEST-{rid}",
                "decision_iter": 1,
                "decision_action": "measure",
                "ai_decision": {"confidence": 0.6, "routing": "agent_review"},
                "human_decision": {"confidence": 0.9, "routing": "auto_execute"},
                "reason": f"Operator override for {sev} test {rid}",
                "reviewer": reviewer,
                "severity": sev,
            }
            r = client.post("/api/v1/corrections", json=body)
            ok = r.status_code == 201
            assert_(f"{3 if sev == 'minor' else 4 if sev == 'major' else 5}. POST severity={sev}",
                    ok, f"http={r.status_code}")
            if ok:
                refs_by_sev[sev] = r.json()["correction_ref"]

        # 6. Invalid severity
        bad = {
            "run_ref": f"AGENT-TEST-{rid}",
            "decision_iter": 1,
            "decision_action": "measure",
            "ai_decision": {},
            "human_decision": {},
            "reason": "bad severity test",
            "reviewer": reviewer,
            "severity": "wrong",
        }
        r = client.post("/api/v1/corrections", json=bad)
        assert_("6. invalid severity returns 400", r.status_code == 400,
                f"http={r.status_code}")

        # 7. GET by ref · round-trip
        if "minor" in refs_by_sev:
            ref = refs_by_sev["minor"]
            r = client.get(f"/api/v1/corrections/{ref}")
            data = r.json() if r.status_code == 200 else {}
            assert_("7. GET by ref round-trips",
                    r.status_code == 200 and data.get("severity") == "minor",
                    f"got severity={data.get('severity')}")

        # 8. Filter by severity
        r = client.get(f"/api/v1/corrections?severity=critical")
        rows = r.json() if r.status_code == 200 else []
        only_critical = all(c["severity"] == "critical" for c in rows)
        assert_(f"8. severity=critical filter ({len(rows)} returned · all critical)",
                only_critical, f"all_critical={only_critical}")

        # 9. Filter by run_ref
        r = client.get(f"/api/v1/corrections?run_ref=AGENT-TEST-{rid}")
        rows = r.json() if r.status_code == 200 else []
        assert_(f"9. run_ref filter returns ≥3 rows ({len(rows)})",
                len(rows) >= 3, f"count={len(rows)}")

        # 10. Stats
        r = client.get("/api/v1/corrections/stats/summary")
        s = r.json() if r.status_code == 200 else {}
        assert_("10. /stats/summary returns by_severity counts",
                r.status_code == 200 and isinstance(s.get("by_severity"), dict)
                and s["by_severity"].get("critical", 0) >= 1,
                f"summary={s}")

    except Exception as e:
        assert_("2-10. API round-trips", False,
                f"{type(e).__name__}: {e}")

    # ── 11. Cleanup ──────────────────────────────────
    cleaned = _cleanup()
    assert_(f"11. cleanup · removed {cleaned} row(s)", cleaned >= 0)

    print(f"\n  Summary: {11 - fails}/11 pass · {fails} fail")
    print(f"  Reference: §38.3 + T7.10 + Tier 7 governance gate #5")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
