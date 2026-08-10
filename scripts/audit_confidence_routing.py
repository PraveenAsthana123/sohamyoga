#!/usr/bin/env python3
"""Confidence-score routing audit · T7.9 · Tier 7 governance gate #1.

Per docs/PENDING_PLAN.md T7.9. Verifies the autonomous_agent's measure
step now produces a confidence (0..1) and routes to one of 4 tiers per
the registry threshold table:

  95-100% → auto_execute
  85-95%  → agent_review
  70-85%  → human_approval
  < 70%   → manual_processing

10 assertions:
  1. ROUTING_THRESHOLDS has 4 entries
  2. _route_by_confidence(0.97) → auto_execute
  3. _route_by_confidence(0.90) → agent_review
  4. _route_by_confidence(0.78) → human_approval
  5. _route_by_confidence(0.45) → manual_processing
  6. _route_by_confidence(None) → None (skip · §57.7)
  7. _compute_confidence with sparse data → low score
  8. _compute_confidence with single-cohort + good outcome → high score
  9. Live agent run · measure decision has confidence + routing fields
  10. Live agent run · routing matches threshold tier
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


def main() -> int:
    print("Confidence-routing audit · T7.9 + governance gate #1\n")
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

    try:
        from marketing_campaigns import autonomous_agent as aa
    except ImportError as e:
        print(f"  ✗ FATAL · {e}")
        return 1

    # ── 1-6. ROUTING_THRESHOLDS · _route_by_confidence ──
    assert_("1. ROUTING_THRESHOLDS has 4 entries",
            len(aa.ROUTING_THRESHOLDS) == 4,
            f"got {len(aa.ROUTING_THRESHOLDS)}")

    cases = [
        (0.97, "auto_execute",      "2. 97% → auto_execute"),
        (0.90, "agent_review",      "3. 90% → agent_review"),
        (0.78, "human_approval",    "4. 78% → human_approval"),
        (0.45, "manual_processing", "5. 45% → manual_processing"),
        (None, None,                "6. None → None (skip per §57.7)"),
    ]
    for conf, expected, label in cases:
        got = aa._route_by_confidence(conf)
        assert_(label, got == expected, f"got {got}")

    # ── 7. Sparse data · low confidence ──────────────
    class FakeMetrics:
        total_runs = 1
        consent_gate_rate = 0.0
        avg_outcome_score = 0.0
        by_status = {}
        cohort_distribution = {"unknown": 1}

    c_sparse = aa._compute_confidence(FakeMetrics(), {})
    assert_(f"7. sparse data → confidence < 0.5",
            c_sparse < 0.5, f"got {c_sparse:.3f}")

    # ── 8. Single-cohort + good outcome · higher ─────
    class GoodMetrics:
        total_runs = 50
        consent_gate_rate = 1.0
        avg_outcome_score = 0.8
        by_status = {"converted": 30}
        cohort_distribution = {"gold": 50}

    c_good = aa._compute_confidence(GoodMetrics(), {})
    assert_(f"8. 50 runs + single cohort + 0.8 outcome → ≥ 0.7",
            c_good >= 0.7, f"got {c_good:.3f}")

    # ── 9-10. Live agent run with confidence + routing ──
    try:
        from main import create_app
        from fastapi.testclient import TestClient
        client = TestClient(create_app())

        r = client.post("/api/v1/marketing-campaigns/autonomous/run", json={
            "description": f"T7.9 confidence routing test {uuid.uuid4().hex[:6]}",
            "target_metric": "conversion_rate",
            "target_value": 0.99,  # high so it doesn't halt early
            "max_iterations": 1,
            "allowed_channels": ["survey"],
            "initial_segment": "gold",
        })
        if r.status_code == 200:
            d = r.json()
            measure_decision = next(
                (dec for dec in d.get("decisions", []) if dec.get("action") == "measure"),
                None,
            )
            has_fields = (
                measure_decision is not None
                and measure_decision.get("confidence") is not None
                and measure_decision.get("routing") is not None
            )
            assert_("9. measure decision has confidence + routing",
                    has_fields,
                    f"got {measure_decision and {k: measure_decision.get(k) for k in ['confidence', 'routing']}}")

            if has_fields:
                conf = measure_decision["confidence"]
                routing = measure_decision["routing"]
                expected_routing = aa._route_by_confidence(conf)
                assert_(f"10. routing matches threshold ({conf:.2f} → {routing})",
                        routing == expected_routing,
                        f"expected={expected_routing}")
            else:
                assert_("10. routing matches threshold", False, "no measure decision")
        else:
            assert_("9-10. live agent run", False, f"http={r.status_code}")

        # Cleanup
        from marketing_campaigns.autonomous_agent import cleanup_agent_campaigns
        cleanup_agent_campaigns()

    except Exception as e:
        assert_("9-10. live agent run", False,
                f"{type(e).__name__}: {e}")

    print(f"\n  Summary: {10 - fails}/10 pass · {fails} fail")
    print(f"  Reference: §57.7 + §80 + T7.9 + Tier 7 governance gate #1")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
