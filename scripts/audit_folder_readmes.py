#!/usr/bin/env python3
"""§58 + §63 audit · verify every ai-agents/<tool>/ has README + DEEP_DIVE + install.sh.

Per global §58 (folder-README standard) + §63 (two-file convention).

Walks ai-agents/<tool>/ (skipping _shared/). For each tool, verifies:
- README.md present + ≥ 200 bytes
- deep/docs/DEEP_DIVE.md present + ≥ 500 bytes (substantive)
- deep/scripts/install.sh present + executable
- §-references present in DEEP_DIVE.md (≥ 3 §-cites)

Reports per-tool pass/fail + grand summary. Exit 1 if any tool is incomplete.
"""
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
AI_AGENTS = REPO / "ai-agents"

# Files/dirs to skip
SKIP = {"_shared", "README.md", ".gitkeep"}

MIN_README_BYTES = 200
MIN_DEEP_DIVE_BYTES = 500
MIN_SEC_REFS = 3


def audit_tool(tool_dir: Path) -> dict:
    """Audit one tool folder. Returns {readme, deep_dive, install, sec_refs, pass}."""
    readme = tool_dir / "README.md"
    deep_dive = tool_dir / "deep" / "docs" / "DEEP_DIVE.md"
    install = tool_dir / "deep" / "scripts" / "install.sh"

    r_ok = readme.exists() and readme.stat().st_size >= MIN_README_BYTES
    d_ok = deep_dive.exists() and deep_dive.stat().st_size >= MIN_DEEP_DIVE_BYTES
    i_ok = install.exists() and os.access(install, os.X_OK)

    # Count § references in deep dive
    sec_refs = 0
    if deep_dive.exists():
        content = deep_dive.read_text(errors="replace")
        sec_refs = len(re.findall(r"§\d+", content))
    s_ok = sec_refs >= MIN_SEC_REFS

    return {
        "tool": tool_dir.name,
        "readme": r_ok,
        "deep_dive": d_ok,
        "install": i_ok,
        "sec_refs": sec_refs,
        "sec_ok": s_ok,
        "pass": r_ok and d_ok and i_ok and s_ok,
    }


def main() -> int:
    if not AI_AGENTS.exists():
        print(f"  ✗ {AI_AGENTS} not found")
        return 1

    tools = sorted(
        d for d in AI_AGENTS.iterdir()
        if d.is_dir() and d.name not in SKIP
    )

    print(f"§58 + §63 folder-README audit · {len(tools)} tools\n")
    print(f"  {'Tool':<25} | README | DEEP_DIVE | install.sh | §-refs | Pass")
    print(f"  {'-'*25} | {'-'*6} | {'-'*9} | {'-'*10} | {'-'*6} | ----")

    passes = 0
    fails = 0
    fail_details = []

    for d in tools:
        r = audit_tool(d)
        r_mark = "✓" if r["readme"] else "✗"
        d_mark = "✓" if r["deep_dive"] else "✗"
        i_mark = "✓" if r["install"] else "✗"
        s_mark = f"{r['sec_refs']:>2}" + (" ✓" if r["sec_ok"] else " ✗")
        verdict = "PASS" if r["pass"] else "FAIL"
        if r["pass"]:
            passes += 1
        else:
            fails += 1
            missing = []
            if not r["readme"]: missing.append("README")
            if not r["deep_dive"]: missing.append("DEEP_DIVE")
            if not r["install"]: missing.append("install.sh")
            if not r["sec_ok"]: missing.append(f"§-refs ({r['sec_refs']}<{MIN_SEC_REFS})")
            fail_details.append(f"  - {r['tool']}: missing {', '.join(missing)}")
        print(f"  {r['tool'][:25]:<25} | {r_mark:^6} | {d_mark:^9} | {i_mark:^10} | {s_mark:<6} | {verdict}")

    print(f"\n  Summary: {passes} pass · {fails} fail · {len(tools)} total ({passes*100//len(tools)}%)")
    if fail_details:
        print("\n  Failures:")
        for line in fail_details:
            print(line)
    print(f"\n  Reference: global §58 (folder-README standard) + §63 (two-file convention)")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
