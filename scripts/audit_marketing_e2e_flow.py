#!/usr/bin/env python3
"""End-to-end consumer flow test for marketing campaigns.

Per "fix all" iteration that surfaced silent route-registration bugs.
Exercises the FULL consumer path · not just route reachability:

  1. POST   /api/v1/marketing-campaigns                  create test campaign
  2. POST   /api/v1/marketing-campaigns/{id}/execute     apply gates → runs
  3. GET    /public/{kind}/{ref}/{cust}/preview          consumer sees content
  4. POST   /public/{kind}/{ref}/{cust}/respond|submit   consumer answers
  5. GET    /marketing-campaigns/{id}/metrics            verify outcome update
  6. Cleanup: PATCH campaign to status='complete' (idempotent)

Tests BOTH survey + form channels.

Per §47.6 + §57.7 · honest test of the trust contract, not just imports.

Exit 0 if all 12 assertions pass · 1 otherwise.

Environment expected:
  BEV_POSTGRES_HOST, BEV_POSTGRES_PORT, BEV_POSTGRES_USER,
  BEV_POSTGRES_PASSWORD, BEV_POSTGRES_DB (see setup.sh)
"""
import json
import logging
import os
import sys
import time
import uuid
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
# Both paths needed: REPO so `from backend.x` resolves, REPO/backend so `from main` resolves.
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("INSUR_SKIP_MIGRATIONS", "1")
logging.disable(logging.CRITICAL)


TEST_CAMPAIGN_PREFIX = "E2E test ·"


def _cleanup_test_campaigns():
    """Defensive · delete any leaked E2E test campaigns from prior runs.

    Both at start (in case crash left orphans) and end (normal teardown).
    CASCADE drops marketing_campaign_runs rows too.
    """
    try:
        from core.config import get_settings
        import psycopg2
        settings = get_settings()
        with psycopg2.connect(settings.database_url) as c, c.cursor() as cur:
            cur.execute(
                "DELETE FROM marketing_campaigns WHERE name LIKE %s",
                (f"{TEST_CAMPAIGN_PREFIX}%",),
            )
            deleted = cur.rowcount
            c.commit()
        return deleted
    except Exception as e:
        print(f"  (cleanup warn: {type(e).__name__}: {e})")
        return 0


def main() -> int:
    print("Marketing campaigns · end-to-end consumer flow\n")
    print(f"  {'Step':<55} | Result")
    print(f"  {'-' * 55} | ------")

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

    # Pre-cleanup · sweep any orphans from prior runs (defensive)
    pre = _cleanup_test_campaigns()
    if pre > 0:
        print(f"  0. pre-cleanup · swept {pre} orphan(s) from prior run     | ✓ INFO")

    fails = 0
    test_run_id = uuid.uuid4().hex[:6]
    # T3.4 · per-step latency capture · [{step_id, label, latency_ms, passed}]
    latencies = []
    _step_start = [time.perf_counter()]  # mutable holder so we can reset between steps

    def step(label: str, ok: bool, detail: str = ""):
        nonlocal fails
        mark = "✓" if ok else "✗"
        suffix = f" · {detail}" if detail else ""
        print(f"  {label[:55]:<55} | {mark} {('PASS' if ok else 'FAIL')}{suffix}")
        if not ok:
            fails += 1
        # T3.4 · capture latency since last step start
        lat_ms = (time.perf_counter() - _step_start[0]) * 1000
        # Extract step_id (first token before space, e.g. "1.S")
        step_id = label.split(" ", 1)[0] if " " in label else label[:5]
        latencies.append({
            "step_id": step_id,
            "label": label,
            "latency_ms": round(lat_ms, 2),
            "passed": ok,
        })
        _step_start[0] = time.perf_counter()

    # ── SURVEY FLOW ────────────────────────────────────────────────
    # 1. Create test survey campaign
    body = {
        "name": f"E2E test · survey · {test_run_id}",
        "channel": "survey",
        "product_pitch": "E2E flow test",
        "call_to_action": "Share feedback",
        "config": {
            "questions": [
                {"id": "nps", "text": "Score?", "type": "nps"},
                {"id": "reason", "text": "Why?", "type": "text"},
            ],
        },
        "require_consent": False,  # don't gate on consent for test
    }
    r = client.post("/api/v1/marketing-campaigns", json=body)
    step("1.S create survey campaign", r.status_code == 201, f"http={r.status_code}")
    if r.status_code != 201:
        return _summary(fails, test_run_id, latencies)
    campaign_survey = r.json()
    cid_s = campaign_survey["id"]
    ref_s = campaign_survey["campaign_ref"]

    # 2. Execute (creates pending runs)
    r = client.post(f"/api/v1/marketing-campaigns/{cid_s}/execute", json={})
    ok = r.status_code == 200 and r.json().get("runs_created", 0) > 0
    runs_created_s = r.json().get("runs_created", 0) if r.status_code == 200 else 0
    step(f"2.S execute · runs_created={runs_created_s}", ok)
    if runs_created_s == 0:
        return _summary(fails, test_run_id, latencies)

    # Pick the first run's customer_id
    runs = client.get(f"/api/v1/marketing-campaigns/{cid_s}/runs").json()
    cust_id_s = runs[0]["customer_id"]

    # 3. GET preview
    r = client.get(
        f"/api/v1/marketing-campaigns/public/survey/{ref_s}/{cust_id_s}/preview",
    )
    ok = r.status_code == 200 and r.json().get("kind") == "survey"
    step("3.S consumer GET preview", ok, f"http={r.status_code}")

    # 4. POST respond
    answers = {"nps": 9, "reason": "Loved the demo"}
    r = client.post(
        f"/api/v1/marketing-campaigns/public/survey/{ref_s}/{cust_id_s}/respond",
        json={"responses": answers},
    )
    ok = r.status_code == 200 and r.json().get("outcome_score") == 0.85
    step("4.S consumer POST respond · outcome=0.85", ok, f"http={r.status_code}")

    # 5. Verify status moved to 'responded'
    r = client.get(f"/api/v1/marketing-campaigns/{cid_s}/runs")
    statuses = [run["status"] for run in r.json()]
    ok = any(s == "responded" for s in statuses)
    step("5.S verify status transitioned to 'responded'", ok,
          f"statuses={statuses[:3]}")

    # 6. Anti-replay · second POST should 404 (run no longer pending)
    r = client.post(
        f"/api/v1/marketing-campaigns/public/survey/{ref_s}/{cust_id_s}/respond",
        json={"responses": {"nps": 5}},
    )
    step("6.S anti-replay · second submit returns 404",
          r.status_code == 404, f"http={r.status_code}")

    # ── FORM FLOW ──────────────────────────────────────────────────
    body = {
        "name": f"E2E test · form · {test_run_id}",
        "channel": "form",
        "product_pitch": "E2E flow test",
        "call_to_action": "Submit lead",
        "config": {
            "fields": [
                {"id": "name",  "label": "Name",  "type": "text",  "required": True},
                {"id": "email", "label": "Email", "type": "email", "required": True},
            ],
            "success_message": "Thanks · agent will reach out.",
        },
        "require_consent": False,
    }
    r = client.post("/api/v1/marketing-campaigns", json=body)
    step("1.F create form campaign", r.status_code == 201, f"http={r.status_code}")
    if r.status_code != 201:
        return _summary(fails, test_run_id, latencies)
    campaign_form = r.json()
    cid_f = campaign_form["id"]
    ref_f = campaign_form["campaign_ref"]

    r = client.post(f"/api/v1/marketing-campaigns/{cid_f}/execute", json={})
    runs_created_f = r.json().get("runs_created", 0) if r.status_code == 200 else 0
    step(f"2.F execute · runs_created={runs_created_f}", runs_created_f > 0)
    if runs_created_f == 0:
        return _summary(fails, test_run_id, latencies)

    runs = client.get(f"/api/v1/marketing-campaigns/{cid_f}/runs").json()
    cust_id_f = runs[0]["customer_id"]

    # DLP rejection · SSN-shape in form data
    r = client.post(
        f"/api/v1/marketing-campaigns/public/form/{ref_f}/{cust_id_f}/submit",
        json={"responses": {"name": "Test", "email": "ssn-123-45-6789"}},
    )
    step("3.F DLP gate · SSN-shape returns 400",
          r.status_code == 400 and "DLP" in r.json().get("detail", {}).get("error_code", ""),
          f"http={r.status_code}")

    # Valid submission
    r = client.post(
        f"/api/v1/marketing-campaigns/public/form/{ref_f}/{cust_id_f}/submit",
        json={"responses": {"name": "Test User", "email": "test@example.com"}},
    )
    ok = r.status_code == 200 and r.json().get("outcome_score") == 1.0
    step("4.F valid form submission · outcome=1.0", ok, f"http={r.status_code}")

    # Verify status moved to 'converted'
    r = client.get(f"/api/v1/marketing-campaigns/{cid_f}/runs")
    statuses = [run["status"] for run in r.json()]
    ok = any(s == "converted" for s in statuses)
    step("5.F verify status transitioned to 'converted'", ok)

    # Verify metrics aggregate correctly
    r = client.get(f"/api/v1/marketing-campaigns/{cid_f}/metrics")
    metrics = r.json() if r.status_code == 200 else {}
    has_converted = metrics.get("by_status", {}).get("converted", 0) > 0
    step("6.F metrics aggregate shows converted",
          has_converted, f"by_status={metrics.get('by_status', {})}")

    return _summary(fails, test_run_id, latencies)


def _persist_latencies(run_ref: str, latencies: list[dict]) -> None:
    """T3.4 · persist per-step latency to e2e_step_latencies (migration 060)."""
    if not latencies:
        return
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            for entry in latencies:
                cur.execute(
                    "INSERT INTO e2e_step_latencies "
                    "(audit_kind, run_ref, step_id, step_label, latency_ms, passed) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    ("marketing-e2e-flow", run_ref,
                     entry["step_id"], entry["label"],
                     entry["latency_ms"], entry["passed"]),
                )
            c.commit()
        total_ms = sum(e["latency_ms"] for e in latencies)
        print(f"  ↳ T3.4 persisted {len(latencies)} step latencies · total {total_ms:.1f}ms")
    except Exception as e:
        # Honest per §57.7: latency persistence is best-effort · don't fail audit
        print(f"  (T3.4 latency persist warn: {type(e).__name__}: {e})")


def _summary(fails: int, run_ref: str = "unknown",
              latencies: list[dict] | None = None) -> int:
    # T3.4 · persist per-step latencies (including on early-exit)
    if latencies:
        _persist_latencies(run_ref, latencies)
    # Post-cleanup · delete test campaigns we created (prevents weekly cron leak)
    post = _cleanup_test_campaigns()
    print(f"\n  post-cleanup · removed {post} test campaign(s)")
    print(f"  Summary: {12 - fails}/12 pass · {fails} fail")
    print(f"  Reference: §47.6 + §57.7 + §64.13 + §82.21 (DLP gate) + T3.4 latency capture")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
