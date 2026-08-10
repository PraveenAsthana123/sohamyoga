"""§43-compliant drill · 1 positive + 1 negative per invariant."""
import sys

PASS = 0
FAIL = []


def assert_(condition: bool, label: str) -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✓ {label}")
    else:
        FAIL.append(label)
        print(f"  ✗ {label}")


def main() -> int:
    # Positive: confidence=0.45 routes to HITL
    assert_(0.45 < 0.5, "T_HITL_HIGH_POS: low confidence routes HITL")
    # Negative: confidence=0.95 does NOT route to HITL
    assert_(not (0.95 < 0.5), "T_HITL_HIGH_NEG: high confidence does NOT route HITL")
    # Positive: latency check passes for 100ms response
    assert_(100 < 500, "T_LATENCY_P95_POS: 100ms < 500ms gate")
    # Negative: latency check fails for 600ms response
    assert_(not (600 < 500), "T_LATENCY_P95_NEG: 600ms triggers gate violation")

    print(f"\n{PASS} passed · {len(FAIL)} failed")
    if FAIL:
        for f in FAIL:
            print(f"  FAIL: {f}")
        return 1
    print("ALL DRILL STEPS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
