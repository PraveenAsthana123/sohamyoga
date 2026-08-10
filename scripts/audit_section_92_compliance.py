#!/usr/bin/env python3
"""§92 compliance audit · meta-audit that checks every project mandate.

Per global §92 (ai-agents/ mandatory per project).

For the current project (cwd), verifies all §92-mandatory components exist:

1. ai-agents/ tree (50 tool folders + _shared/)
2. setup.sh at repo root (executable)
3. 9 helper scripts in scripts/
4. .github/workflows/audits.yml
5. backend audit router (FastAPI route at /api/v1/insur/audit/*)
6. Frontend AdminAuditPage.jsx
7. 4 audit scripts (recommender + dept-artifacts + folder-readmes + voice-ai)

Exit 0 if all present · 1 otherwise.

Reference: ~/.claude/policies/ai-agents-mandatory.md
"""
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

REQUIRED = [
    # (path, kind, min_size_bytes, description)
    ("ai-agents",                                "dir",    None, "§92.2 · 50-tool catalog tree"),
    ("ai-agents/README.md",                      "file",  500,   "§92 master index"),
    ("ai-agents/_shared/policies",               "dir",    None, "§92 cross-cutting policies"),
    ("ai-agents/_shared/catalogs",               "dir",    None, "§92 cross-cutting catalogs"),
    ("ai-agents/_shared/scripts",                "dir",    None, "§92 cross-cutting scripts"),

    ("setup.sh",                                 "exec",  200,   "§92.3 · single CLI entry"),

    ("scripts/setup_ai_agent_stack.sh",          "exec",  200,   "Universal installer (48-tool)"),
    ("scripts/generate_use_case_stubs.py",       "exec",  500,   "§90 use-case generator"),
    ("scripts/generate_raf_stubs.py",            "exec",  500,   "RAF scenario generator"),
    ("scripts/audit_use_case_stubs.py",          "exec",  500,   "Use-case stub audit"),
    ("scripts/audit_recommender_flavors.py",     "exec",  500,   "§64.22 audit"),
    ("scripts/audit_dept_artifacts.py",          "exec",  500,   "§64.29 audit"),
    ("scripts/audit_folder_readmes.py",          "exec",  500,   "§58/§63 audit"),
    ("scripts/audit_voice_ai_artifacts.py",      "exec",  500,   "§90 L15 audit"),
    ("scripts/scaffold_recommendation_files.py", "exec",  500,   "§64.22 scaffolder"),
    ("scripts/scaffold_dept_artifacts.py",       "exec",  500,   "§64.29 scaffolder"),

    (".github/workflows/audits.yml",             "file",  200,   "§92.5 · CI gate"),

    ("backend/routers/audit.py",                 "file",  500,   "§92.6 · audit API"),
    ("frontend/src/pages/AdminAuditPage.jsx",    "file", 2000,   "§92.6 · operator UI"),
]


def check_one(rel: str, kind: str, min_size, desc: str) -> tuple[bool, str]:
    p = REPO / rel
    if not p.exists():
        return False, "missing"
    if kind == "dir":
        return p.is_dir(), "ok" if p.is_dir() else "not-a-dir"
    if kind == "file":
        if not p.is_file():
            return False, "not-a-file"
        size = p.stat().st_size
        if min_size is not None and size < min_size:
            return False, f"too small ({size}<{min_size})"
        return True, f"{size} B"
    if kind == "exec":
        if not p.is_file():
            return False, "not-a-file"
        if not os.access(p, os.X_OK):
            return False, "not-executable"
        size = p.stat().st_size
        if min_size is not None and size < min_size:
            return False, f"too small ({size}<{min_size})"
        return True, f"{size} B · exec"
    return False, f"unknown kind: {kind}"


def main() -> int:
    print(f"§92 compliance audit · {REPO.name}\n")
    print(f"  {'Path':<48} | Kind | Status      | Description")
    print(f"  {'-' * 48} | ---- | ----------- | ------------------")

    passes = 0
    fails = 0
    fail_paths = []

    for rel, kind, min_size, desc in REQUIRED:
        ok, status = check_one(rel, kind, min_size, desc)
        mark = "✓" if ok else "✗"
        print(f"  {rel[:48]:<48} | {kind:<4} | {mark} {status:<10} | {desc}")
        if ok:
            passes += 1
        else:
            fails += 1
            fail_paths.append(f"{rel} ({status})")

    print(f"\n  Summary: {passes}/{len(REQUIRED)} pass · {fails} fail "
          f"({passes * 100 // len(REQUIRED)}%)")
    if fail_paths:
        print("\n  Failures (must remediate per §92):")
        for line in fail_paths:
            print(f"    - {line}")
    print("\n  Reference: §92 ai-agents/ mandatory · "
          "~/.claude/policies/ai-agents-mandatory.md")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
