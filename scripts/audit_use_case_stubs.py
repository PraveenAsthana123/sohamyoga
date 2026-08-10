#!/usr/bin/env python3
"""audit_use_case_stubs.py — walk docs/use-cases/ and report TODO completion % per stub.

Per global §90.9 definition of done. Writes:
  - jobs/reports/use-case-audit-latest.json
  - jobs/reports/use-case-audit-latest.md
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
USE_CASES_ROOT = REPO / "docs" / "use-cases"
REPORT_DIR = REPO / "jobs" / "reports"


def todo_count(text: str) -> int:
    return len(re.findall(r"\bTODO\b", text))


def line_count(text: str) -> int:
    return len(text.splitlines())


def audit_stub(stub_dir: Path) -> dict:
    files = {
        "use-case.md": stub_dir / "use-case.md",
        "data-quality-checklist.md": stub_dir / "data-quality-checklist.md",
        "analysis-checklist.md": stub_dir / "analysis-checklist.md",
        "responsible-ai-checklist.md": stub_dir / "responsible-ai-checklist.md",
        "pipeline-checklist.md": stub_dir / "pipeline-checklist.md",
        "evaluation-metrics.json": stub_dir / "evaluation-metrics.json",
        "testing-coverage.json": stub_dir / "testing-coverage.json",
        "README.md": stub_dir / "README.md",
    }
    per_file = {}
    total_todo = 0
    total_lines = 0
    files_present = 0
    for name, path in files.items():
        if not path.exists():
            per_file[name] = {"present": False, "todo": None, "lines": None}
            continue
        files_present += 1
        text = path.read_text(errors="replace")
        t = todo_count(text)
        l = line_count(text)
        per_file[name] = {"present": True, "todo": t, "lines": l}
        total_todo += t
        total_lines += l

    completion_pct = round(100.0 * (1 - min(1.0, total_todo / max(1, total_lines * 0.10))), 1)

    # 22 subsection check via use-case.md header presence
    uc_text = (stub_dir / "use-case.md").read_text(errors="replace") if (stub_dir / "use-case.md").exists() else ""
    section_headers = [
        "## 1. Use case",
        "## 2. Architecture",
        "## 3. Data source",
        "## 4. Planning",
        "## 5. Hyperparameter tuning",
        "## 6. Noise handling",
        "## 7. Job scheduling",
        "## 8. Top 1%",
        "## 9. Composing",
        "## 10. Insurance-domain",
        "## G1.", "## G2.", "## G3.", "## G4.", "## G5.", "## G6.",
        "## G7.", "## G8.", "## G9.", "## G10.", "## G11.", "## G12.",
    ]
    headers_present = sum(1 for h in section_headers if h in uc_text)

    return {
        "stub_id": stub_dir.name,
        "files_present": files_present,
        "files_total": len(files),
        "total_todo": total_todo,
        "total_lines": total_lines,
        "completion_pct": completion_pct,
        "headers_22_present": headers_present,
        "headers_22_total": len(section_headers),
        "per_file": per_file,
    }


def main() -> int:
    if not USE_CASES_ROOT.exists():
        print(f"ERROR: {USE_CASES_ROOT} not found", file=sys.stderr)
        return 2

    stubs = sorted([d for d in USE_CASES_ROOT.iterdir() if d.is_dir()])
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    rows = [audit_stub(d) for d in stubs]

    summary = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_stubs": len(rows),
        "fully_present": sum(1 for r in rows if r["files_present"] == r["files_total"]),
        "avg_completion_pct": round(sum(r["completion_pct"] for r in rows) / max(1, len(rows)), 1),
        "total_todo_count": sum(r["total_todo"] for r in rows),
        "total_lines": sum(r["total_lines"] for r in rows),
        "stubs_with_22_headers": sum(1 for r in rows if r["headers_22_present"] == r["headers_22_total"]),
    }

    # JSON
    json_out = REPORT_DIR / "use-case-audit-latest.json"
    json_out.write_text(json.dumps({"summary": summary, "stubs": rows}, indent=2))

    # Markdown
    md = []
    md.append("# Use-Case Stub Audit · §90.9 Definition-of-Done\n")
    md.append(f"> Generated {summary['generated_at']}\n\n")
    md.append("## Summary\n\n")
    md.append("| Metric | Value |\n|---|---|\n")
    for k, v in summary.items():
        md.append(f"| {k} | {v} |\n")
    md.append("\n## Per-stub completion\n\n")
    md.append("| Stub | Files | TODOs | Lines | Completion % | 22 headers |\n|---|---|---|---|---|---|\n")
    for r in sorted(rows, key=lambda x: -x["total_todo"]):
        md.append(
            f"| {r['stub_id']} | {r['files_present']}/{r['files_total']} | {r['total_todo']} | "
            f"{r['total_lines']} | {r['completion_pct']:.1f}% | {r['headers_22_present']}/{r['headers_22_total']} |\n"
        )
    md_out = REPORT_DIR / "use-case-audit-latest.md"
    md_out.write_text("".join(md))

    print(f"✓ wrote {json_out}")
    print(f"✓ wrote {md_out}")
    print(f"\nSummary:")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
