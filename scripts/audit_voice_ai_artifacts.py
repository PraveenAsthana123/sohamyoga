#!/usr/bin/env python3
"""Audit voice AI E2E demo artifact completeness · §90 L15 + §92.

Checks:
- backend/voice_ai/ has 4 mandatory modules
- backend/migrations/052_voice_ai_end_to_end.sql exists
- frontend/src/pages/VoiceAIDemoPage.jsx exists + >5 KB
- docs/use-cases/voice-ai-end-to-end/HOLY_DEMO_STORY.md exists + >10 KB
- DEMO_STORY contains all 14 mandatory sections

Exit 0 if all pass · 1 otherwise.
"""
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

BACKEND_FILES = [
    "backend/voice_ai/__init__.py",
    "backend/voice_ai/schemas.py",
    "backend/voice_ai/services.py",
    "backend/voice_ai/router.py",
    "backend/voice_ai/campaign_schemas.py",
    "backend/voice_ai/campaign_services.py",
    "backend/voice_ai/e2e_services.py",
]

# Optional frontend files (operator may not always ship FE)
FRONTEND_PAGES = [
    "frontend/src/pages/VoiceAIDemoPage.jsx",
    "frontend/src/pages/VoiceAICampaignPage.jsx",
    "frontend/src/pages/VoiceAIE2EPage.jsx",
]

MIGRATION = "backend/migrations/052_voice_ai_end_to_end.sql"
FRONTEND = "frontend/src/pages/VoiceAIDemoPage.jsx"  # legacy single check kept for shape
DEMO_STORY = "docs/use-cases/voice-ai-end-to-end/HOLY_DEMO_STORY.md"

DEMO_STORY_SECTIONS = [
    "## 1. Persona",
    "## 2. Problem · Pain",
    "## 3. AS-IS",
    "## 4. TO-BE",
    "## 5. Stakeholder",
    "## 6. End-to-end solution",
    "## 7. Data flow",
    "## 8. Monitoring + scoring",
    "## 9. Pitch",
    "## 10. Demo script",
    "## 11. Success criteria",
    "## 12. Common gotchas",
    "## 13. Related artifacts",
    "## 14. Composes with",
]


def main() -> int:
    print("Voice AI E2E artifact audit · §90 L15 + §92\n")
    print(f"  {'Check':<50} | Result")
    print(f"  {'-' * 50} | -------")

    fails = 0

    # Backend files
    for f in BACKEND_FILES:
        target = REPO / f
        ok = target.exists() and target.stat().st_size > 100
        print(f"  {f:<50} | {'✓ PASS' if ok else '✗ FAIL'}")
        if not ok:
            fails += 1

    # Migration
    target = REPO / MIGRATION
    ok = target.exists() and target.stat().st_size > 500
    print(f"  {MIGRATION:<50} | {'✓ PASS' if ok else '✗ FAIL'}")
    if not ok:
        fails += 1

    # Frontend (3 pages: demo · campaign · e2e)
    for fp in FRONTEND_PAGES:
        target = REPO / fp
        ok = target.exists() and target.stat().st_size > 5000
        print(f"  {fp:<50} | {'✓ PASS' if ok else '✗ FAIL'}")
        if not ok:
            fails += 1

    # Demo story
    target = REPO / DEMO_STORY
    if target.exists():
        content = target.read_text()
        section_misses = []
        for sec in DEMO_STORY_SECTIONS:
            if sec not in content:
                section_misses.append(sec)
        ok = len(section_misses) == 0 and target.stat().st_size > 10000
        print(f"  {DEMO_STORY:<50} | {'✓ PASS' if ok else '✗ FAIL'}")
        if section_misses:
            print(f"\n  Missing sections in DEMO_STORY:")
            for s in section_misses:
                print(f"    - {s}")
            fails += len(section_misses)
        if target.stat().st_size <= 10000:
            print(f"  DEMO_STORY too small: {target.stat().st_size} bytes (need > 10000)")
    else:
        print(f"  {DEMO_STORY:<50} | ✗ FAIL (missing)")
        fails += 1

    total_checks = len(BACKEND_FILES) + 1 + len(FRONTEND_PAGES) + 1  # backend + migration + frontends + demo_story
    passes = total_checks - fails if fails <= total_checks else 0
    print(f"\n  Summary: {passes} / {total_checks} pass · {fails} fail")
    print(f"  Reference: §90 L15 voice AI E2E · §92 ai-agents/ mandatory")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
