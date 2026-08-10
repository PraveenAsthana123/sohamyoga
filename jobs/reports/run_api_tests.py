#!/usr/bin/env python3
"""SohamYoga API test matrix — public catalog GETs + negative slugs + auth gates + POSTs.

Targets the docker-compose stack: nginx :8085 (public) and backend :5070 (direct).
Writes JSON + Markdown reports under jobs/reports/api_test_<TS>.{json,md}.
Exit 0 if all expected codes match; 1 otherwise.
"""
from __future__ import annotations

import datetime as dt
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

NGINX = "http://localhost:8085"
BACKEND = "http://localhost:5070"
ROOT = Path("/mnt/deepa/sohamyoga")
OUT_DIR = ROOT / "jobs" / "reports"
TS = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def probe(label: str, expect: int, url: str, *, method: str = "GET", body: dict | None = None) -> dict:
    headers = {"Accept": "application/json"}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            code = resp.status
            payload = resp.read(2048)
    except urllib.error.HTTPError as e:
        code = e.code
        payload = e.read(2048) if hasattr(e, "read") else b""
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        code = 0
        payload = f"ERR: {e}".encode()
    ms = round((time.perf_counter() - t0) * 1000, 1)
    excerpt = payload[:160].decode("utf-8", errors="replace").replace("\n", " ").replace("|", "\\|")
    is_json = payload[:1] in (b"{", b"[")
    return {
        "label": label,
        "url": url,
        "method": method,
        "expect": expect,
        "actual": code,
        "ok": code == expect,
        "json": is_json,
        "ms": ms,
        "excerpt": excerpt,
    }


def main() -> int:
    results: list[dict] = []

    # 1. Health & infra
    results += [
        probe("health-direct", 200, f"{BACKEND}/api/health"),
        probe("health-via-nginx", 200, f"{NGINX}/api/health"),
        probe("nginx-root", 200, f"{NGINX}/"),
    ]

    # 2. Public catalog GETs
    catalog = [
        ("home", "/api/home"),
        ("home-settings", "/api/home/settings"),
        ("blog-list", "/api/blog"),
        ("blog-recent", "/api/blog/recent"),
        ("blog-categories", "/api/blog/categories"),
        ("casestudies", "/api/casestudies"),
        ("industries", "/api/industries"),
        ("industry-banking", "/api/industries/banking-finance"),
        ("industry-oil-gas", "/api/industries/oil-gas"),
        ("services", "/api/services"),
        ("services-featured", "/api/services/featured"),
        ("service-sharepoint", "/api/services/sharepoint"),
        ("service-machine-learning", "/api/services/machine-learning"),
        ("testimonials", "/api/testimonials"),
        ("team", "/api/team"),
        ("videos", "/api/videos"),
        ("jobs", "/api/jobs"),
        ("jobs-departments", "/api/jobs/departments"),
    ]
    results += [probe(label, 200, f"{NGINX}{path}") for label, path in catalog]

    # 3. Negative: bogus slug → 404
    negatives = [
        ("industry-404", "/api/industries/totally-not-a-thing"),
        ("service-404", "/api/services/totally-not-a-thing"),
        ("blog-404", "/api/blog/totally-not-a-thing"),
        ("job-404", "/api/jobs/slug/totally-not-a-thing"),
    ]
    results += [probe(label, 404, f"{NGINX}{path}") for label, path in negatives]

    # 4. Auth gates: no cookie → 401
    auth = [
        ("admin-me-no-auth", 401, "/api/auth/me"),
        ("customer-me-no-auth", 401, "/api/customer/auth/me"),
        ("admin-dashboard-no-auth", 401, "/api/admin/dashboard"),
        ("live-chat-sessions-no-auth", 401, "/api/live-chat/sessions"),
    ]
    results += [probe(label, expect, f"{NGINX}{path}") for label, expect, path in auth]

    # 5. POST: write endpoints (these should succeed or return a structured error)
    results += [
        probe(
            "newsletter-subscribe",
            200,
            f"{NGINX}/api/newsletter/subscribe",
            method="POST",
            body={"email": f"smoke-{TS.lower()}@example.com", "name": "SohamYoga API Smoke"},
        ),
        probe(
            "contact-submit",
            201,
            f"{NGINX}/api/contact",
            method="POST",
            body={
                "name": "SohamYoga Smoke",
                "email": "smoke@example.com",
                "subject": "API smoke test",
                "message": "Automated smoke from run_api_tests.py — ignore.",
            },
        ),
    ]

    # 6. Error-envelope shape check on a known 404 (per global §6.2)
    res_404 = next((r for r in results if r["label"] == "industry-404"), None)
    if res_404 and res_404["actual"] == 404 and res_404["json"]:
        try:
            payload = json.loads(res_404["excerpt"][:300] + "}" if not res_404["excerpt"].endswith("}") else res_404["excerpt"])
        except Exception:
            payload = None
        envelope_ok = isinstance(payload, dict) and {"detail", "error_code"} <= set(payload)
        results.append(
            {
                "label": "error-envelope",
                "url": res_404["url"],
                "method": "GET",
                "expect": "{detail,error_code}",
                "actual": "ok" if envelope_ok else "missing",
                "ok": envelope_ok,
                "json": True,
                "ms": 0,
                "excerpt": res_404["excerpt"][:200],
            }
        )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = OUT_DIR / f"api_test_{TS}.json"
    md_path = OUT_DIR / f"api_test_{TS}.md"

    total = len(results)
    passed = sum(1 for r in results if r["ok"])
    failed = total - passed

    json_path.write_text(json.dumps({"ts": TS, "total": total, "pass": passed, "fail": failed, "results": results}, indent=2))

    lines = [
        "# API Test Report",
        "",
        f"**Run:** {TS}  ",
        f"**Total:** {total}  **Pass:** {passed}  **Fail:** {failed}",
        "",
        "| Label | Method | URL | Expect | Actual | OK | JSON | ms | Excerpt |",
        "|---|---|---|---:|---:|:---:|:---:|---:|---|",
    ]
    for r in results:
        ok_mark = "✓" if r["ok"] else "✗"
        json_mark = "✓" if r["json"] else "·"
        url_display = r["url"].replace("|", "\\|")
        excerpt_display = (r["excerpt"][:90] or "").replace("|", "\\|")
        lines.append(
            f"| {r['label']} | {r.get('method', 'GET')} | `{url_display}` | "
            f"{r['expect']} | {r['actual']} | {ok_mark} | {json_mark} | {r['ms']} | {excerpt_display} |"
        )
    md_path.write_text("\n".join(lines) + "\n")

    print(f"json: {json_path}")
    print(f"md  : {md_path}")
    print(f"summary: total={total} pass={passed} fail={failed}")
    if failed:
        print("\nFAILS:")
        for r in results:
            if not r["ok"]:
                print(f"  {r['label']:30s} {r['method']:5s} expect={r['expect']} actual={r['actual']} url={r['url']}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
