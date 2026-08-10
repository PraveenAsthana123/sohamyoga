#!/usr/bin/env python3
"""Attribution math audit · verify model invariants · T5.9.

Per docs/PENDING_PLAN.md T5.9. Checks 5 invariants that MUST hold for
every attribution model:

  1. last_touch · ONLY the final touchpoint receives credit (1 campaign)
  2. first_touch · ONLY the first touchpoint receives credit (1 campaign)
  3. linear · equal split (n campaigns each get total/n)
  4. time_decay · weights sum to total (no leak)
  5. position_based · 40% first + 40% last + 20% middle (single-touch=100%)

Plus integration tests:
  6. All 5 models conserve total_attributed (no model loses or fabricates revenue)
  7. compare() endpoint returns 5 results
  8. Each model returns same n_journeys count
  9. cohort_distribution has at least 1 entry per journey

Per §47.6 + §57.7 + §75 + §76 + T5.9.
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
    print("Attribution math audit · §75 + §76 + T5.9\n")
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
        from attribution import services as attr_svc
    except ImportError as e:
        print(f"  ✗ FATAL · {e}")
        return 1

    # ── 1-5. Per-model math invariants ──────────────────
    # Synthetic 3-touchpoint journey · total_value=300
    tp = [
        {"campaign_id": 1, "channel": "email",  "outcome_score": 0.5,
         "created_at": None, "completed_at": None},
        {"campaign_id": 2, "channel": "survey", "outcome_score": 0.6,
         "created_at": None, "completed_at": None},
        {"campaign_id": 3, "channel": "form",   "outcome_score": 1.0,
         "created_at": None, "completed_at": None},
    ]
    total = 300.0

    # 1. last_touch
    r = attr_svc._attr_last_touch(tp, total)
    assert_("1. last_touch · only campaign 3 credited",
            list(r.keys()) == [3] and abs(r[3] - 300) < 0.01,
            f"got {r}")

    # 2. first_touch
    r = attr_svc._attr_first_touch(tp, total)
    assert_("2. first_touch · only campaign 1 credited",
            list(r.keys()) == [1] and abs(r[1] - 300) < 0.01,
            f"got {r}")

    # 3. linear
    r = attr_svc._attr_linear(tp, total)
    assert_("3. linear · each gets 100",
            len(r) == 3 and all(abs(v - 100) < 0.01 for v in r.values()),
            f"got {r}")

    # 4. time_decay · NULL conv_at falls back to linear · split equally
    r = attr_svc._attr_time_decay(tp, total, conv_at=None)
    assert_("4. time_decay (NULL conv_at fallback to linear)",
            len(r) == 3 and abs(sum(r.values()) - total) < 0.01,
            f"got sum={sum(r.values()):.2f}")

    # 5. position_based · 40+20+40
    r = attr_svc._attr_position_based(tp, total)
    expected = {1: 120, 2: 60, 3: 120}
    ok = all(abs(r.get(k, 0) - v) < 0.01 for k, v in expected.items())
    assert_("5. position_based · 40/20/40 split",
            ok, f"got {r}")

    # ── 6. Total conservation across models ─────────
    for model_name in ["last_touch", "first_touch", "linear",
                         "time_decay", "position_based"]:
        fn = attr_svc.ATTRIBUTION_MODELS[model_name]
        if model_name == "time_decay":
            r = fn(tp, total, conv_at=None)
        else:
            r = fn(tp, total)
        sum_r = sum(r.values())
        assert_(f"6. {model_name} conserves total ({total})",
                abs(sum_r - total) < 0.01, f"got {sum_r:.2f}")

    # ── 7. compare() returns 5 results ────────────────
    try:
        d = attr_svc.compare_models()
        assert_("7. compare_models returns 5 model results",
                len(d.get("models", [])) == 5 and len(d.get("results", {})) == 5,
                f"models={d.get('models')}")

        # ── 8. Consistent n_journeys across models ──────
        n_set = {r["n_journeys"] for r in d["results"].values()}
        assert_("8. all 5 models report same n_journeys",
                len(n_set) <= 1, f"distinct n_journeys: {n_set}")

        # ── 9. Cohort distribution sums correctly ───────
        first_model = next(iter(d["results"].values()))
        cohort_sum = sum(first_model.get("journey_cohort_distribution", {}).values())
        assert_("9. cohort_distribution sums to n_journeys",
                cohort_sum == first_model.get("n_journeys", 0),
                f"sum={cohort_sum} · n_journeys={first_model.get('n_journeys')}")
    except Exception as e:
        assert_(f"7-9. compare_models failed", False, f"{type(e).__name__}: {e}")

    print(f"\n  Summary: {15 - fails}/15 pass · {fails} fail")
    print(f"  Reference: §47.6 + §57.7 + §75 + §76 + T5.9")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
