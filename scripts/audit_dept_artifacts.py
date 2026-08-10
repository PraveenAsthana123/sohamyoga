#!/usr/bin/env python3
"""§64.29 audit · verify every dept has all mandatory business-layer/HOLY_*.md files.

Per global §64.29 (and §64.33/.35/.38 extensions) — every dept MUST have:

Mandatory MD files (per §64.29 + later §64 amendments):
- HOLY_DEMO_STORY.md           (§64.2)
- HOLY_ASIS_ASSESSMENT.md       (§64.3)
- HOLY_DT_STRATEGY.md           (§64.4)
- HOLY_CONTACT_CENTER.md        (§64.5)
- HOLY_INCIDENT_MGMT.md         (§64.6)
- HOLY_MEETING_COMMS.md         (§64.14)
- HOLY_PROCESS_MGMT.md          (§64.15)
- HOLY_DATA_MGMT.md             (§64.17)
- HOLY_RECOMMENDATION.md        (§64.22)
- HOLY_ANOMALY.md               (§64.23)
- HOLY_FRAUD.md                 (§64.23)
- HOLY_CONTACTS.md              (§64.25)
- HOLY_FLOW.md                  (§64.27)
- HOLY_SIMULATION.md            (§64.34)
- HOLY_SECURITY.md              (§64.32)

Walks canonical 21-dept list. Exit 0 if all present · 1 if any missing.
"""
import sys
from pathlib import Path

REQUIRED_FILES = [
    "HOLY_DEMO_STORY.md",
    "HOLY_ASIS_ASSESSMENT.md",
    "HOLY_DT_STRATEGY.md",
    "HOLY_CONTACT_CENTER.md",
    "HOLY_INCIDENT_MGMT.md",
    "HOLY_MEETING_COMMS.md",
    "HOLY_PROCESS_MGMT.md",
    "HOLY_DATA_MGMT.md",
    "HOLY_RECOMMENDATION.md",
    "HOLY_ANOMALY.md",
    "HOLY_FRAUD.md",
    "HOLY_CONTACTS.md",
    "HOLY_FLOW.md",
    "HOLY_SIMULATION.md",
    "HOLY_SECURITY.md",
]

CANONICAL_DEPTS = [
    (1, "product-management"), (3, "sales-distribution"), (4, "underwriting"),
    (5, "policy-admin"), (6, "billing"), (7, "claims"), (8, "siu-fraud"),
    (9, "customer-service"), (10, "actuarial"), (11, "reinsurance"),
    (12, "compliance"), (13, "legal"), (14, "finance"), (15, "erm"),
    (16, "hr"), (17, "procurement"), (18, "analytics"), (19, "it"),
    (20, "cyber"), (21, "partner"), (22, "product-innovation"),
]

REPO = Path(__file__).resolve().parent.parent
DEPTS_ROOT = REPO / "global-ai-org" / "departments"


def find_dept(did: int, slug: str) -> Path | None:
    candidates = [DEPTS_ROOT / slug, DEPTS_ROOT / f"{did:02d}-{slug}", DEPTS_ROOT / f"{did}-{slug}"]
    return next((c for c in candidates if c.exists()), None)


def main() -> int:
    print(f"§64.29 audit · {len(CANONICAL_DEPTS)} canonical depts × {len(REQUIRED_FILES)} mandatory MD files")
    print(f"  total cells: {len(CANONICAL_DEPTS) * len(REQUIRED_FILES)}\n")
    print(f"  {'Dept':<28} | {'/'.join(f.split('_')[1][:3] for f in REQUIRED_FILES[:10])} | pass / total")
    print(f"  {'-'*28} | {'-'*45} | -----------")

    grand_pass = 0
    grand_total = 0
    grand_missing = 0
    fails_by_file = {f: 0 for f in REQUIRED_FILES}

    for did, slug in CANONICAL_DEPTS:
        dept_dir = find_dept(did, slug)
        if dept_dir is None:
            grand_missing += len(REQUIRED_FILES)
            grand_total += len(REQUIRED_FILES)
            print(f"  {f'{did} {slug}':<28} | (no-dir)                                       | 0 / {len(REQUIRED_FILES)}")
            continue
        bl = dept_dir / "business-layer"
        passes = 0
        symbols = []
        for f in REQUIRED_FILES:
            target = bl / f
            if target.exists() and target.stat().st_size > 100:
                passes += 1
                symbols.append("✓")
            else:
                symbols.append("✗")
                fails_by_file[f] += 1
        grand_pass += passes
        grand_total += len(REQUIRED_FILES)
        # Show first 10 file symbols inline
        sym_str = ''.join(symbols[:15])
        print(f"  {f'{did} {slug}':<28} | {sym_str:<45} | {passes} / {len(REQUIRED_FILES)}")

    print(f"\n  Per-file failure counts:")
    for f, count in sorted(fails_by_file.items(), key=lambda x: -x[1]):
        if count > 0:
            print(f"    {f:<30} · {count} depts missing")

    coverage = (grand_pass / grand_total * 100) if grand_total else 0
    print(f"\n  Grand summary: {grand_pass} / {grand_total} cells covered ({coverage:.1f}%)")
    print(f"  Missing dept dirs: {grand_missing}")
    print(f"  Reference: global CLAUDE.md §64.29")
    return 0 if grand_pass == grand_total else 1


if __name__ == "__main__":
    sys.exit(main())
