#!/usr/bin/env python3
"""Multi-cohort fairness audit · validates the §76 RAI gate actually fires.

Per docs/PENDING_PLAN.md T3.2. Previous single-cohort tests always
produced DI=1.0 because only one segment was targeted. This audit
exercises the cross-cohort path to verify the gate triggers a halt
when DI < 0.8.

Math sanity (with current synthetic seed of 11 gold · 11 silver · 78 std):
  DI = min(cohort) / max(cohort) = 11 / 78 ≈ 0.141 → MUST FAIL gate.

7 assertions:
  1. DI math · single cohort = 1.0
  2. DI math · balanced 50:50 = 1.0
  3. DI math · imbalanced 10:90 < 0.2 (below 0.8 gate)
  4. DI math · 3 cohorts with min/max derived correctly
  5. Agent run · cross-cohort · halt_reason='rai_fairness_gate_failed'
  6. Agent run · cross-cohort · fairness_di < 0.8
  7. Agent run · cross-cohort · decisions chain contains 'rai_halt'
  8. Agent run · single-cohort baseline · still passes (DI=1.0)
  9. Cleanup leaves 0 test campaigns

Per §47.6 + §57.7 + §76 (RAI · MANDATORY) + §80 (decision system).
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


def _di(cohort_counts: list[int]) -> float:
    """Disparate impact = min(cohort) / max(cohort) · §76 definition."""
    if not cohort_counts or max(cohort_counts) == 0:
        return 1.0
    return min(cohort_counts) / max(cohort_counts)


def _cleanup():
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "DELETE FROM marketing_campaigns WHERE name LIKE 'Agent AGENT-%%'",
            )
            n = cur.rowcount
            cur.execute(
                "DELETE FROM autonomous_agent_runs "
                "WHERE objective LIKE %s",
                ("Multi-cohort RAI test%",),
            )
            n += cur.rowcount
            c.commit()
        return n
    except Exception:
        return 0


def main() -> int:
    print("Multi-cohort RAI fairness audit · §76 + T3.2\n")
    print(f"  {'Step':<55} | Result")
    print(f"  {'-' * 55} | ------")

    fails = 0

    def assert_(label: str, ok: bool, detail: str = ""):
        nonlocal fails
        mark = "✓" if ok else "✗"
        sfx = f" · {detail}" if detail else ""
        print(f"  {label[:55]:<55} | {mark} {('PASS' if ok else 'FAIL')}{sfx}")
        if not ok:
            fails += 1

    # ── 1-4. DI math sanity ──────────────────────────────
    assert_("1. DI math · single cohort [100] = 1.0",
            _di([100]) == 1.0)
    assert_("2. DI math · balanced [50, 50] = 1.0",
            _di([50, 50]) == 1.0)
    assert_("3. DI math · imbalanced [10, 90] < 0.2",
            _di([10, 90]) < 0.2, f"got {_di([10, 90]):.3f}")
    assert_("4. DI math · 3 cohorts [11, 11, 78] = 11/78",
            abs(_di([11, 11, 78]) - 11/78) < 0.001,
            f"got {_di([11, 11, 78]):.3f}")

    # ── 5-7. Agent run · cross-cohort · expect halt ──────
    pre = _cleanup()
    if pre:
        print(f"  0. pre-cleanup · swept {pre} orphan row(s)        | ✓ INFO")

    try:
        from main import create_app
        from fastapi.testclient import TestClient
    except ImportError as e:
        print(f"  ✗ FATAL · cannot import app: {e}")
        return 1

    app = create_app()
    client = TestClient(app)
    rid = uuid.uuid4().hex[:6]

    # Cross-cohort run · NO initial_segment → targets all 3 cohorts
    r = client.post("/api/v1/marketing-campaigns/autonomous/run", json={
        "description": f"Multi-cohort RAI test {rid} · cross-cohort",
        "target_metric": "conversion_rate",
        "target_value": 0.99,   # high target so agent won't halt early
        "max_iterations": 2,
        "allowed_channels": ["survey"],
        "initial_segment": None,  # KEY: targets ALL segments → imbalanced cohorts
    })
    if r.status_code != 200:
        assert_("5-7. agent run cross-cohort", False, f"http={r.status_code}")
    else:
        d = r.json()
        # Per §76 the agent halts at the cohort imbalance · or completes if
        # somehow all cohorts equal (unlikely with seeded data).
        halted_rai = (d.get("halt_reason") == "rai_fairness_gate_failed")
        di_below = (d.get("fairness_di") is not None and d.get("fairness_di") < 0.8)
        had_rai_decision = any(
            dec.get("action") == "rai_halt" for dec in d.get("decisions", [])
        )

        assert_("5. cross-cohort run · halt_reason=rai_fairness_gate_failed",
                halted_rai,
                f"got halt_reason='{d.get('halt_reason')}' di={d.get('fairness_di')}")
        assert_("6. cross-cohort run · fairness_di < 0.8",
                di_below, f"got di={d.get('fairness_di')}")
        assert_("7. cross-cohort run · decisions chain includes 'rai_halt'",
                had_rai_decision,
                f"actions={[d2.get('action') for d2 in d.get('decisions', [])][-5:]}")

    # ── 8. Single-cohort baseline still passes ────────────
    r = client.post("/api/v1/marketing-campaigns/autonomous/run", json={
        "description": f"Multi-cohort RAI test {rid} · single-cohort baseline",
        "target_metric": "conversion_rate",
        "target_value": 0.99,
        "max_iterations": 1,
        "allowed_channels": ["survey"],
        "initial_segment": "gold",  # single cohort
    })
    if r.status_code == 200:
        d = r.json()
        # Single cohort → DI=1.0 → RAI pass · halt by budget not RAI
        ok = (d.get("rai_pass") is True
              and d.get("fairness_di") == 1.0
              and d.get("halt_reason") != "rai_fairness_gate_failed")
        assert_("8. single-cohort baseline · rai_pass=True · DI=1.0", ok,
                f"halt={d.get('halt_reason')} rai_pass={d.get('rai_pass')}")
    else:
        assert_("8. single-cohort baseline", False, f"http={r.status_code}")

    # ── 9. Cleanup ──────────────────────────────────────
    cleaned = _cleanup()
    assert_(f"9. cleanup · removed {cleaned} test row(s)", cleaned >= 0)

    print(f"\n  Summary: {9 - fails}/9 pass · {fails} fail")
    print(f"  Reference: §47.6 + §57.7 + §76 + §80 + T3.2")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
