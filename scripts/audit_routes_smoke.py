#!/usr/bin/env python3
"""Route reachability smoke · catches silent route-registration regressions.

Per "fix all" iteration that caught 2 silent bugs the audit triad missed:
1. Settings.postgres_dsn attribute mismatch
2. voice_ai_router missing from main.py include_router

Imports main.create_app() via TestClient and verifies a curated set of
critical routes return non-5xx. Exit 1 if any returns ≥500 (server error).
4xx is acceptable (e.g. /campaigns/1 returns 404 with empty DB).

Reference: §47.6 (DevSecOps CI gate) + §57.7 (honest test instead of
trusting that imports worked).
"""
import sys
import os
import logging
from pathlib import Path

# Set up paths · BOTH needed (REPO for `from backend.x`, REPO/backend for `from main`)
REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
os.environ["INSUR_SKIP_MIGRATIONS"] = "1"
logging.disable(logging.CRITICAL)


# Routes that MUST be reachable (404/200 OK · only 5xx is failure)
CRITICAL_ROUTES = [
    "/api/health",
    "/api/v1/voice-ai/health",
    "/api/v1/voice-ai/e2e/voices",
    "/api/v1/voice-ai/e2e/benchmark",
    "/api/v1/voice-ai/e2e/phases",
    "/api/v1/voice-ai/e2e/quality",
    "/api/v1/voice-ai/campaigns",
    "/api/v1/insur/audit/list",
    # marketing campaigns (added 2026-06-08 · §64.13)
    "/api/v1/marketing-campaigns/health",
    "/api/v1/marketing-campaigns/channels",
    "/api/v1/marketing-campaigns",
]


def main() -> int:
    print(f"Route reachability smoke · {len(CRITICAL_ROUTES)} critical routes\n")
    try:
        from main import create_app
        from fastapi.testclient import TestClient
    except ImportError as e:
        print(f"  ✗ FATAL: cannot import app: {e}")
        return 1

    try:
        app = create_app()
        client = TestClient(app)
    except Exception as e:
        print(f"  ✗ FATAL: create_app failed: {e}")
        return 1

    print(f"  {'Route':<48} | Status")
    print(f"  {'-' * 48} | ------")
    fails = 0
    for path in CRITICAL_ROUTES:
        try:
            r = client.get(path)
            ok = r.status_code < 500
            mark = "✓" if ok else "✗"
            print(f"  {path:<48} | {mark} {r.status_code}")
            if not ok:
                fails += 1
        except Exception as e:
            print(f"  {path:<48} | ✗ EXC {type(e).__name__}")
            fails += 1

    passes = len(CRITICAL_ROUTES) - fails
    print(f"\n  Summary: {passes} / {len(CRITICAL_ROUTES)} pass · {fails} fail")
    print(f"  Reference: §47.6 + §57.7 · route reachability via TestClient")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
