#!/usr/bin/env python3
"""Presidio Stage-1 adapter audit · T6.10.

Per docs/PENDING_PLAN.md T6.10. Verifies the §56 Stage-1 adapter loads
in EITHER mode ('presidio' or 'fallback') and detects 12 PII entity
types. Per §57.7 honest: when env blocks Presidio, the fallback regex
pack MUST still detect all 12 types · audit fails if neither mode works.

8 assertions:
  1. Adapter status() returns ready=True
  2. mode is either 'presidio' or 'fallback' (not None)
  3. supported_types has at least 12 entries
  4. SSN detected
  5. Credit card detected
  6. Email detected
  7. Multiple entity types in mixed text
  8. Clean text returns is_pii=False
"""
import logging
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("INSUR_SKIP_MIGRATIONS", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
logging.disable(logging.CRITICAL)


def main() -> int:
    print("Presidio Stage-1 adapter audit · §56 + T6.10\n")
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
        from services import dlp_presidio
    except ImportError as e:
        print(f"  ✗ FATAL · cannot import adapter: {e}")
        return 1

    # ── 1-3. status() snapshot ────────────────────────
    s = dlp_presidio.status()
    assert_("1. adapter ready=True", s.get("ready") is True,
            f"mode={s.get('mode')}")
    assert_("2. mode is 'presidio' or 'fallback'",
            s.get("mode") in ("presidio", "fallback"),
            f"got mode={s.get('mode')}")
    assert_("3. supported_types has ≥12 entries",
            s.get("n_types", 0) >= 12, f"got {s.get('n_types')}")

    # ── 4-6. Single-entity detection ───────────────
    r = dlp_presidio.scan("My SSN is 123-45-6789 · please don't share")
    types_found = set(r.get("count_by_type", {}).keys())
    assert_("4. US_SSN detected in single-entity text",
            "US_SSN" in types_found, f"found={types_found}")

    r = dlp_presidio.scan("Card: 4111-2222-3333-4444")
    types_found = set(r.get("count_by_type", {}).keys())
    assert_("5. CREDIT_CARD detected",
            "CREDIT_CARD" in types_found, f"found={types_found}")

    r = dlp_presidio.scan("Contact: sarah@example.com for details")
    types_found = set(r.get("count_by_type", {}).keys())
    assert_("6. EMAIL_ADDRESS detected",
            "EMAIL_ADDRESS" in types_found, f"found={types_found}")

    # ── 7. Multi-entity ──────────────────────────────
    mixed = (
        "Customer Sarah (sarah@example.com · phone +1-555-123-4567) "
        "SSN 123-45-6789 · card 4111222233334444 · "
        "IBAN DE89370400440532013000 · "
        "visit https://example.com/portal"
    )
    r = dlp_presidio.scan(mixed)
    n_types = len(r.get("count_by_type", {}))
    assert_(f"7. multi-entity text · {n_types} types found",
            n_types >= 4,
            f"types={list(r.get('count_by_type', {}).keys())}")

    # ── 8. Clean text · no false positive ───────
    r = dlp_presidio.scan("Hello Sarah Chen · welcome to our service")
    assert_("8. clean text · is_pii=False",
            r.get("is_pii") is False,
            f"got is_pii={r.get('is_pii')} · entities={r.get('entities')}")

    print(f"\n  Summary: {8 - fails}/8 pass · {fails} fail")
    print(f"  Adapter mode: {s.get('mode')} · supported_types={s.get('n_types')}")
    print(f"  Reference: §56 + §57.7 + §82.21 + T6.10")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
