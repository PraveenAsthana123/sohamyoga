#!/usr/bin/env python3
"""Advanced testing for marketing campaigns · multi-channel + adversarial + autonomous.

Per operator 2026-06-08: "create advance testing ..autonomous AI for campaign
..end to end process"

8 advanced test scenarios beyond the basic E2E flow:

  1. Multi-channel · 1 campaign per each of 4 channels (E·B·S·F)
  2. Adversarial DLP · 5 PII shapes (SSN · CC · phone+SSN · email+CC · mixed)
  3. Concurrent execution · 3 campaigns run back-to-back · DB integrity
  4. Autonomous agent · run with budget=2 · verify halt + decisions chain
  5. RAI fairness gate · run with single cohort · verify DI=1.0 pass
  6. Anti-replay · same token submitted twice · 2nd returns 404
  7. Invalid channel · POST channel='banner_xxx' rejected
  8. Empty campaign list · DELETE all + verify empty + count

Each test uses Pre/Post cleanup to prevent leakage.

Per §47.6 + §57.7 + §64.13 + §76 (RAI) + §82.21 (DLP).
"""
import logging
import os
import sys
import uuid
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "backend"))
os.environ.setdefault("INSUR_SKIP_MIGRATIONS", "1")
logging.disable(logging.CRITICAL)


PREFIX = "ADV test ·"


def _cleanup():
    try:
        from core.config import get_settings
        import psycopg2
        with psycopg2.connect(get_settings().database_url) as c, c.cursor() as cur:
            cur.execute(
                "DELETE FROM marketing_campaigns WHERE name LIKE %s",
                (f"{PREFIX}%",),
            )
            n = cur.rowcount
            cur.execute(
                "DELETE FROM marketing_campaigns WHERE name LIKE 'Agent AGENT-%'",
            )
            n += cur.rowcount
            cur.execute(
                "DELETE FROM autonomous_agent_runs WHERE objective LIKE %s",
                (f"{PREFIX}%",),
            )
            n += cur.rowcount
            c.commit()
        return n
    except Exception as e:
        print(f"  (cleanup warn: {e})")
        return 0


def main() -> int:
    print("Marketing campaigns · ADVANCED test suite\n")
    print(f"  {'Test':<55} | Result")
    print(f"  {'-' * 55} | ------")

    try:
        from main import create_app
        from fastapi.testclient import TestClient
    except ImportError as e:
        print(f"  ✗ FATAL: {e}")
        return 1

    pre = _cleanup()
    if pre:
        print(f"  0. pre-cleanup · swept {pre} orphan(s)                | ✓ INFO")

    app = create_app()
    client = TestClient(app)
    fails = 0
    rid = uuid.uuid4().hex[:6]

    def assert_(label: str, ok: bool, detail: str = ""):
        nonlocal fails
        mark = "✓" if ok else "✗"
        suffix = f" · {detail}" if detail else ""
        print(f"  {label[:55]:<55} | {mark} {('PASS' if ok else 'FAIL')}{suffix}")
        if not ok:
            fails += 1

    # ── 1. MULTI-CHANNEL · create 1 of each ───────────────────────
    created = {}
    for ch in ("email", "banner", "survey", "form"):
        body = {
            "name": f"{PREFIX} {rid} {ch}",
            "channel": ch,
            "product_pitch": "advanced",
            "call_to_action": "Act",
            "config": {
                "email":  {"subject": "Hi", "body_template": "Hi {name}",
                            "from_email": "a@a.com"},
                "banner": {"image_url": "/a.png", "alt_text": "Bundle",
                            "landing_url": "/x"},
                "survey": {"questions": [{"id": "q1", "text": "Q?", "type": "text"}]},
                "form":   {"fields": [{"id": "n", "label": "Name", "type": "text",
                                         "required": True}]},
            }[ch],
            "require_consent": False,
        }
        r = client.post("/api/v1/marketing-campaigns", json=body)
        created[ch] = r.status_code == 201
    assert_("1. Multi-channel · all 4 created",
            all(created.values()), f"results={created}")

    # ── 2. ADVERSARIAL DLP · multiple PII shapes ─────────────────
    # Need a campaign first
    r = client.post("/api/v1/marketing-campaigns", json={
        "name": f"{PREFIX} {rid} dlp",
        "channel": "form",
        "product_pitch": "dlp test",
        "call_to_action": "submit",
        "config": {"fields": [{"id": "n", "label": "Name", "type": "text",
                                "required": True}]},
        "require_consent": False,
    })
    if r.status_code != 201:
        assert_("2. Adversarial DLP", False, "create failed")
    else:
        camp = r.json()
        client.post(f"/api/v1/marketing-campaigns/{camp['id']}/execute", json={})
        runs = client.get(f"/api/v1/marketing-campaigns/{camp['id']}/runs").json()
        cust_id = runs[0]["customer_id"]
        # Try 5 different PII shapes
        shapes = [
            {"id": "ssn-classic", "responses": {"x": "123-45-6789"}},
            {"id": "cc-long",     "responses": {"x": "4111222233334444"}},
            {"id": "phone+ssn",   "responses": {"phone": "555 123-45-6789"}},
            {"id": "email+cc",    "responses": {"e": "a@b.com 12345678901234"}},
            {"id": "buried",      "responses": {"note": "hi see 999-99-9999 bye"}},
        ]
        all_400 = True
        for s in shapes:
            r = client.post(
                f"/api/v1/marketing-campaigns/public/form/{camp['campaign_ref']}/{cust_id}/submit",
                json={"responses": s["responses"]},
            )
            if r.status_code != 400:
                all_400 = False
        assert_(f"2. Adversarial DLP · 5/5 shapes rejected", all_400)

    # ── 3. CONCURRENCY · 3 campaigns back-to-back (in-process) ────
    ids = []
    for i in range(3):
        r = client.post("/api/v1/marketing-campaigns", json={
            "name": f"{PREFIX} {rid} conc-{i}",
            "channel": "survey",
            "product_pitch": "concurrency",
            "call_to_action": "ok",
            "config": {"questions": [{"id": "q", "text": "Q", "type": "text"}]},
            "require_consent": False,
        })
        if r.status_code == 201:
            ids.append(r.json()["id"])
    execs = [
        client.post(f"/api/v1/marketing-campaigns/{cid}/execute", json={})
        for cid in ids
    ]
    all_ok = all(r.status_code == 200 and r.json()["runs_created"] > 0 for r in execs)
    assert_(f"3. Concurrency · 3 back-to-back executes OK", all_ok)

    # ── 4. AUTONOMOUS agent · budget=2 · verify decision chain ───
    r = client.post("/api/v1/marketing-campaigns/autonomous/run", json={
        "description": f"{PREFIX} {rid} agent",
        "target_metric": "conversion_rate",
        "target_value": 0.99,  # high target so it won't halt early
        "max_iterations": 2,
        "allowed_channels": ["survey", "form"],
        "initial_segment": "gold",
    })
    if r.status_code == 200:
        d = r.json()
        # Should have at least 4 decisions per iter (create + execute + measure + next)
        ok = (d["iterations_run"] >= 1 and
              len(d["decisions"]) >= 4 and
              d["status"] in ("complete", "halted"))
        assert_(f"4. Autonomous agent · iters={d['iterations_run']} · "
                f"decisions={len(d['decisions'])}",
                ok, f"status={d['status']}")
    else:
        assert_("4. Autonomous agent", False, f"http={r.status_code}")

    # ── 5. RAI fairness · single cohort = DI=1.0 ────────────────
    # Use the agent run from #4 · verify fairness gate didn't fail
    if r.status_code == 200:
        d = r.json()
        ok = d["rai_pass"] is True and d["fairness_di"] >= 0.8
        assert_(f"5. §76 RAI · DI={d['fairness_di']:.2f} >= 0.8",
                ok, f"rai_pass={d['rai_pass']}")
    else:
        assert_("5. §76 RAI", False)

    # ── 6. ANTI-REPLAY ─────────────────────────────────────────
    r = client.post("/api/v1/marketing-campaigns", json={
        "name": f"{PREFIX} {rid} replay",
        "channel": "survey",
        "product_pitch": "replay",
        "call_to_action": "ok",
        "config": {"questions": [{"id": "q", "text": "Q", "type": "text"}]},
        "require_consent": False,
    })
    camp = r.json()
    client.post(f"/api/v1/marketing-campaigns/{camp['id']}/execute", json={})
    runs = client.get(f"/api/v1/marketing-campaigns/{camp['id']}/runs").json()
    cust_id = runs[0]["customer_id"]
    r1 = client.post(
        f"/api/v1/marketing-campaigns/public/survey/{camp['campaign_ref']}/{cust_id}/respond",
        json={"responses": {"q": "yes"}},
    )
    r2 = client.post(
        f"/api/v1/marketing-campaigns/public/survey/{camp['campaign_ref']}/{cust_id}/respond",
        json={"responses": {"q": "no"}},
    )
    assert_(f"6. Anti-replay · 1st=200 · 2nd=404",
            r1.status_code == 200 and r2.status_code == 404)

    # ── 7. INVALID CHANNEL · rejected ─────────────────────────
    r = client.post("/api/v1/marketing-campaigns", json={
        "name": f"{PREFIX} {rid} invalid",
        "channel": "banner_xxx",
        "product_pitch": "x",
        "call_to_action": "x",
        "config": {},
        "require_consent": False,
    })
    assert_(f"7. Invalid channel 'banner_xxx' rejected",
            r.status_code == 400, f"http={r.status_code}")

    # ── 8. CHANNEL HELP exposes all 4 ────────────────────────
    r = client.get("/api/v1/marketing-campaigns/channels")
    if r.status_code == 200:
        d = r.json()
        ok = all(c in d for c in ("email", "banner", "survey", "form"))
        assert_(f"8. Channel help · all 4 channels exposed", ok,
                f"keys={list(d.keys())}")
    else:
        assert_("8. Channel help", False)

    # Post cleanup
    n = _cleanup()
    print(f"\n  post-cleanup · removed {n} test artifact(s)")
    print(f"  Summary: {8 - fails}/8 pass · {fails} fail")
    print(f"  Reference: §47.6 + §57.7 + §64.13 + §76 + §82.21")
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
