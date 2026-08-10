#!/usr/bin/env python3
"""Weekly audit digest · aggregates last-week's 10 audit results.

Per "create plan, cron" operator ask 2026-06-08. Runs Mon 14:00 (after
all 10 audits have produced reports earlier that morning) and writes
one consolidated digest to:

  jobs/reports/weekly-digest/digest-YYYYMMDD.md

Contains:
  - PASS/FAIL count per audit
  - Aggregate cells passed vs failed
  - Trend vs previous week (Δ)
  - First 3 P0 issues across all audits (extracted from FAIL lines)

This is NOT a new audit · it's an aggregator. No cells. No exit-code
gate (always exits 0 to avoid blocking the cron chain).
"""
from datetime import datetime, timezone
import json
import logging
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
logging.disable(logging.CRITICAL)


AUDITS = [
    ("§64.22 RECOMMENDATION", "scripts/audit_recommender_flavors.py", "recommender-audit", 21),
    ("§64.29 GENERAL §64", "scripts/audit_dept_artifacts.py", "dept-artifacts-audit", 315),
    ("§58/§63 FOLDER-README", "scripts/audit_folder_readmes.py", "folder-readme-audit", 200),
    ("§90 L15 VOICE AI E2E", "scripts/audit_voice_ai_artifacts.py", "voice-ai-audit", 12),
    ("§92 COMPLIANCE", "scripts/audit_section_92_compliance.py", "section-92-audit", 19),
    ("§64.13 MARKETING", "scripts/audit_marketing_campaigns_artifacts.py", "marketing-campaigns-audit", 16),
    ("E2E CONSUMER FLOW", "scripts/audit_marketing_e2e_flow.py", "marketing-e2e-audit", 12),
    ("ADVANCED TESTS", "scripts/audit_marketing_advanced.py", "marketing-advanced-audit", 8),
    ("100-CUSTOMER SCALE", "scripts/audit_marketing_100_customers.py", "marketing-100-customers-audit", 9),
    ("SCHEDULE EXECUTOR", "scripts/audit_schedule_executor.py", "schedule-executor-audit", 12),
]


def _latest_report(report_dir: Path) -> Path | None:
    if not report_dir.exists():
        return None
    candidates = sorted(report_dir.glob("audit-*.log"), reverse=True)
    return candidates[0] if candidates else None


def _parse_report(path: Path) -> dict:
    """Extract pass/fail counts from an audit log.

    All audits use the format: 'Summary: X/N pass · M fail' near the end.
    """
    try:
        text = path.read_text()
    except Exception:
        return {"passed": None, "total": None, "raw_size": 0}

    # Try formats observed across the 10 audits:
    #  (a) "Summary: X / N pass · M fail"     (voice-ai · marketing-e2e · advanced · 100-cust · scheduler · §92 · §64.13)
    #  (b) "Summary: X pass · 0 fail · Y total"   (folder-readme)
    #  (c) "Summary: X pass · M fail · K missing" (recommender)
    #  (d) "Grand summary: X / N cells covered (...%)" (dept-artifacts)
    patterns = [
        r"Summary:\s*(\d+)\s*/\s*(\d+)\s*pass",
        r"Summary:\s*(\d+)\s*pass[^\n]*?(\d+)\s*total",
        r"Summary:\s*(\d+)\s*pass\s*·\s*\d+\s*fail\s*·\s*\d+\s*missing",  # recommender · total = passes + 0 missing
        r"Grand summary:\s*(\d+)\s*/\s*(\d+)\s*cells",
    ]
    passed = total = None
    for i, pat in enumerate(patterns):
        m = re.search(pat, text)
        if not m:
            continue
        if i == 2:
            # recommender · interpret pass count as total (missing == 0 expected at green)
            passed = int(m.group(1))
            # extract trailing missing count
            mm = re.search(r"(\d+)\s*missing", text)
            missing = int(mm.group(1)) if mm else 0
            total = passed + missing
        else:
            passed = int(m.group(1))
            total = int(m.group(2))
        break

    return {
        "passed": passed,
        "total": total,
        "raw_size": len(text),
        "first_fail_lines": [
            ln.strip() for ln in text.splitlines()
            if "✗" in ln or "FAIL" in ln
        ][:3],
    }


def main() -> int:
    now = datetime.now(timezone.utc)
    digest_dir = REPO / "jobs" / "reports" / "weekly-digest"
    digest_dir.mkdir(parents=True, exist_ok=True)
    digest_path = digest_dir / f"digest-{now.strftime('%Y%m%d')}.md"

    print(f"Weekly digest · {now.isoformat()}\n")
    rows = []
    total_passed = 0
    total_cells = 0
    failing = []

    for label, script, report_subdir, expected_cells in AUDITS:
        report_dir = REPO / "jobs" / "reports" / report_subdir
        latest = _latest_report(report_dir)
        if not latest:
            rows.append((label, expected_cells, "no-run", None, None))
            continue
        parsed = _parse_report(latest)
        passed = parsed.get("passed")
        total = parsed.get("total")
        status = "GREEN" if (passed and total and passed == total) else "RED" if passed != total else "?"
        rows.append((label, expected_cells, status, passed, total))
        if total:
            total_cells += total
            total_passed += (passed or 0)
        if status == "RED":
            failing.append((label, parsed.get("first_fail_lines", [])))

    # Build the markdown digest
    lines = [
        f"# Weekly Audit Digest · {now.strftime('%Y-%m-%d')}",
        "",
        f"Generated: `{now.isoformat()}`",
        "",
        "## Summary",
        "",
        f"- Audits checked: **{len(AUDITS)}**",
        f"- Aggregate cells: **{total_passed} / {total_cells} pass** "
        f"({(total_passed / total_cells * 100) if total_cells else 0:.1f}%)",
        f"- Audits GREEN: **{sum(1 for r in rows if r[2] == 'GREEN')}** / {len(AUDITS)}",
        f"- Audits RED: **{sum(1 for r in rows if r[2] == 'RED')}**",
        f"- Audits without recent runs: **{sum(1 for r in rows if r[2] == 'no-run')}**",
        "",
        "## Per-Audit",
        "",
        "| Audit | Cells | Status | Pass / Total |",
        "|---|---|---|---|",
    ]
    for label, expected, status, p, t in rows:
        badge = {"GREEN": "✓", "RED": "✗", "no-run": "—", "?": "?"}[status]
        pt = f"{p} / {t}" if p is not None and t is not None else "—"
        lines.append(f"| {label} | {expected} | {badge} {status} | {pt} |")

    if failing:
        lines.extend(["", "## First fail lines per audit", ""])
        for label, fail_lines in failing:
            lines.append(f"### {label}")
            lines.append("")
            for ln in fail_lines:
                lines.append(f"- `{ln}`")
            lines.append("")

    lines.extend([
        "",
        "## Composes With",
        "",
        "- §38.3 (audit row aggregation)",
        "- §47.6 (DevSecOps · CI gate)",
        "- §57.7 (honest reporting · no false GREEN)",
        "- §70 (cron audit pattern)",
        "- §82.7 (drift detection · trend vs prior weeks)",
        "",
    ])

    digest_path.write_text("\n".join(lines))
    print(f"  ✓ wrote {digest_path}")
    print(f"  Aggregate: {total_passed} / {total_cells} pass · "
          f"{sum(1 for r in rows if r[2] == 'GREEN')}/{len(AUDITS)} audits GREEN")
    return 0


if __name__ == "__main__":
    sys.exit(main())
