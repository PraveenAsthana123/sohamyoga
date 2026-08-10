#!/usr/bin/env python3
"""§64.22 audit · verify each dept's HOLY_RECOMMENDATION.md covers all 3 classical flavors.

Per global §64.22 + docs/RECOMMENDER_FLAVORS_PER_DEPT.md.

Checks:
1. HOLY_RECOMMENDATION.md exists in each dept's business-layer/
2. Each file mentions all 3 flavors (item-based · content-based · hybrid)
3. Honors ITEM_NA set per RECOMMENDER_FLAVORS_PER_DEPT.md

Walks BOTH:
- global-ai-org/departments/  (operator-scaffolded · per §63)
- Canonical 21-dept list (per RECOMMENDER_FLAVORS_PER_DEPT.md)
  — reports each dept as MISSING if no folder yet, else audits the file.

Exit 0 = all canonical depts have file + pass · 1 = otherwise.
"""
import re
import sys
from pathlib import Path

# Canonical 21 depts per RECOMMENDER_FLAVORS_PER_DEPT.md
CANONICAL_DEPTS = [
    (1, "product-management"),
    (3, "sales-distribution"),
    (4, "underwriting"),
    (5, "policy-admin"),
    (6, "billing"),
    (7, "claims"),
    (8, "siu-fraud"),
    (9, "customer-service"),
    (10, "actuarial"),
    (11, "reinsurance"),
    (12, "compliance"),
    (13, "legal"),
    (14, "finance"),
    (15, "erm"),
    (16, "hr"),
    (17, "procurement"),
    (18, "analytics"),
    (19, "it"),
    (20, "cyber"),
    (21, "partner"),
    (22, "product-innovation"),
]

# Depts where item-based is N/A per RECOMMENDER_FLAVORS_PER_DEPT.md
ITEM_NA = {8, 12, 13, 20, 22}

REPO = Path(__file__).resolve().parent.parent
DEPTS_ROOT = REPO / "global-ai-org" / "departments"


def find_dept_path(did: int, slug: str) -> Path | None:
    """Find dept folder · accept multiple naming conventions."""
    if not DEPTS_ROOT.exists():
        return None
    candidates = [
        DEPTS_ROOT / slug,
        DEPTS_ROOT / f"{did:02d}-{slug}",
        DEPTS_ROOT / f"{did}-{slug}",
    ]
    for c in candidates:
        if c.exists():
            return c
    # Fuzzy: any folder starting with did
    for d in DEPTS_ROOT.iterdir():
        if d.is_dir() and re.match(f"^0?{did}[-_]", d.name):
            return d
        if d.is_dir() and slug in d.name.lower():
            return d
    return None


def audit_file(path: Path) -> dict:
    if not path or not path.exists():
        return {"present": False, "flavors": {}}
    content = path.read_text().lower()
    return {
        "present": True,
        "flavors": {
            "item-based": any(t in content for t in ["item-based", "collaborative filter", "item-item", "matrix factorization", "two-tower", " als "]),
            "content-based": any(t in content for t in ["content-based", "tf-idf", "sentence-transformer", "embedding sim", "clip embed"]),
            "hybrid": any(t in content for t in ["hybrid", "ensemble rerank", "lightgbm rank", "xgb rerank", "blended"]),
        },
    }


def main() -> int:
    print(f"§64.22 audit · {len(CANONICAL_DEPTS)} canonical depts\n")
    print(f"  {'Dept':<35} | {'File':<6} | {'Item':<5} | {'Cont':<5} | {'Hyb':<4} | Pass")
    print(f"  {'-'*35} | {'-'*6} | {'-'*5} | {'-'*5} | {'-'*4} | ----")

    passes = 0
    fails = 0
    missing = 0
    for did, slug in CANONICAL_DEPTS:
        item_required = did not in ITEM_NA
        dept_dir = find_dept_path(did, slug)
        label = f"{did} {slug}"
        if dept_dir is None:
            missing += 1
            print(f"  {label[:35]:<35} | {'no-dir':<6} | {'?':<5} | {'?':<5} | {'?':<4} | MISS")
            continue
        path = dept_dir / "business-layer" / "HOLY_RECOMMENDATION.md"
        r = audit_file(path)
        if not r["present"]:
            missing += 1
            print(f"  {label[:35]:<35} | {'✗':<6} | {'?':<5} | {'?':<5} | {'?':<4} | MISS")
            continue
        f = r["flavors"]
        i_mark = "✓" if f["item-based"] else ("n/a" if not item_required else "✗")
        c_mark = "✓" if f["content-based"] else "✗"
        h_mark = "✓" if f["hybrid"] else "✗"
        ok = (f["content-based"] and f["hybrid"] and (f["item-based"] or not item_required))
        if ok:
            passes += 1
        else:
            fails += 1
        print(f"  {label[:35]:<35} | {'✓':<6} | {i_mark:<5} | {c_mark:<5} | {h_mark:<4} | {'PASS' if ok else 'FAIL'}")

    print(f"\n  Summary: {passes} pass · {fails} fail · {missing} missing")
    print(f"  Reference: docs/RECOMMENDER_FLAVORS_PER_DEPT.md")
    print(f"  Target: 21/21 PASS (with 5 ITEM_NA per canonical list)")
    return 0 if (fails == 0 and missing == 0) else 1


if __name__ == "__main__":
    sys.exit(main())
