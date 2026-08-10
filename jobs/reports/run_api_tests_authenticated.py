#!/usr/bin/env python3
"""SohamYoga authenticated API matrix — admin login + per-controller authenticated GETs.

Login first as admin (from .env ADMIN_EMAIL/ADMIN_PASSWORD), then hit every
authenticated endpoint we know about. Also exercises the customer flow:
register a throwaway user → login → /me.

Writes JSON + Markdown under jobs/reports/api_test_auth_<TS>.{json,md}.
"""
from __future__ import annotations

import datetime as dt
import http.cookiejar
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

NGINX = "http://localhost:8085"
ROOT = Path("/mnt/deepa/sohamyoga")
OUT_DIR = ROOT / "jobs" / "reports"
TS = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
ENV_PATH = ROOT / ".env"


def load_admin_credentials() -> tuple[str, str]:
    env: dict[str, str] = {}
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, _, value = line.partition("=")
            env[key.strip()] = value.split("#")[0].strip()
    return env["ADMIN_EMAIL"], env["ADMIN_PASSWORD"]


def make_opener() -> urllib.request.OpenerDirector:
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [("User-Agent", "sohamyoga-api-tester/1.0"), ("Accept", "application/json")]
    return opener


def probe(opener, label: str, expect: int, url: str, *, method: str = "GET", body: dict | None = None) -> dict:
    headers = {}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    t0 = time.perf_counter()
    try:
        with opener.open(req, timeout=10) as resp:
            code = resp.status
            payload = resp.read(2048)
    except urllib.error.HTTPError as e:
        code = e.code
        try:
            payload = e.read(2048)
        except Exception:
            payload = b""
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        code = 0
        payload = f"ERR: {e}".encode()
    ms = round((time.perf_counter() - t0) * 1000, 1)
    excerpt = payload[:160].decode("utf-8", errors="replace").replace("\n", " ").replace("|", "\\|")
    is_json = payload[:1] in (b"{", b"[")
    ok = code in expect if isinstance(expect, (list, tuple, set)) else code == expect
    return {
        "label": label,
        "url": url,
        "method": method,
        "expect": list(expect) if isinstance(expect, (list, tuple, set)) else expect,
        "actual": code,
        "ok": ok,
        "json": is_json,
        "ms": ms,
        "excerpt": excerpt,
    }


def main() -> int:
    admin_email, admin_password = load_admin_credentials()
    results: list[dict] = []

    # ── ADMIN flow ─────────────────────────────────────────────────────
    admin = make_opener()
    results.append(
        probe(admin, "admin-login", 200, f"{NGINX}/api/auth/login", method="POST",
              body={"email": admin_email, "password": admin_password})
    )
    if not results[-1]["ok"]:
        print("admin login failed — skipping admin matrix", file=sys.stderr)
    else:
        results.append(probe(admin, "admin-me", 200, f"{NGINX}/api/auth/me"))

        admin_gets = [
            # Dashboard
            ("admin-dashboard", "/api/admin/dashboard"),
            # Contact (admin)
            ("admin-contact-list", "/api/contact"),
            ("admin-contact-unread-count", "/api/contact/unread-count"),
            # Newsletter (admin)
            ("admin-newsletter-subscribers", "/api/newsletter/subscribers"),
            ("admin-newsletter-count", "/api/newsletter/count"),
            # Live chat (admin)
            ("admin-live-chat-sessions", "/api/live-chat/sessions"),
            ("admin-live-chat-unread", "/api/live-chat/unread-count"),
            # /customer-sessions is [Authorize(Roles="Customer")] — admin must get 403
            # Jobs (admin)
            ("admin-jobs-all", "/api/jobs/admin/all"),
            ("admin-jobs-applications", "/api/jobs/admin/applications"),
            # Team (admin extended — already public GETs but ensure 200)
            ("admin-team-list", "/api/team"),
        ]
        for label, path in admin_gets:
            results.append(probe(admin, label, 200, f"{NGINX}{path}"))

        # Role boundary: admin must NOT be authorized for [Authorize(Roles="Customer")] endpoints
        results.append(probe(admin, "admin-blocked-on-customer-route", 403, f"{NGINX}/api/live-chat/customer-sessions"))

        results.append(probe(admin, "admin-logout", 200, f"{NGINX}/api/auth/logout", method="POST", body={}))
        # After logout, admin-only endpoint MUST 401
        results.append(probe(admin, "admin-me-after-logout", 401, f"{NGINX}/api/auth/me"))

    # ── CUSTOMER flow ─────────────────────────────────────────────────
    customer = make_opener()
    cust_email = f"smoke-{TS.lower()}@example.com"
    cust_password = "Smoke@123456"
    results.append(
        probe(customer, "customer-register", [200, 201, 400], f"{NGINX}/api/customer/auth/register",
              method="POST",
              body={"name": "Smoke Tester", "email": cust_email, "password": cust_password})
    )
    # 400 acceptable if a previous run registered the same email (uniqueness)
    results.append(
        probe(customer, "customer-login", 200, f"{NGINX}/api/customer/auth/login",
              method="POST", body={"email": cust_email, "password": cust_password})
    )
    if results[-1]["ok"]:
        results.append(probe(customer, "customer-me", 200, f"{NGINX}/api/customer/auth/me"))
        results.append(probe(customer, "customer-logout", 200, f"{NGINX}/api/customer/auth/logout",
                             method="POST", body={}))
        # After logout, /me MUST 401
        results.append(probe(customer, "customer-me-after-logout", 401, f"{NGINX}/api/customer/auth/me"))

    # ── NEGATIVE: bad credentials ─────────────────────────────────────
    bad = make_opener()
    results.append(
        probe(bad, "admin-login-wrong-password", 401, f"{NGINX}/api/auth/login",
              method="POST", body={"email": admin_email, "password": "totally-wrong"})
    )
    results.append(
        probe(bad, "admin-login-unknown-user", 401, f"{NGINX}/api/auth/login",
              method="POST", body={"email": "nobody@example.com", "password": "x"})
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = OUT_DIR / f"api_test_auth_{TS}.json"
    md_path = OUT_DIR / f"api_test_auth_{TS}.md"

    total = len(results)
    passed = sum(1 for r in results if r["ok"])
    failed = total - passed
    json_path.write_text(json.dumps({"ts": TS, "total": total, "pass": passed, "fail": failed, "results": results}, indent=2))

    lines = [
        "# Authenticated API Test Report",
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
        expect_display = r["expect"] if not isinstance(r["expect"], list) else "/".join(map(str, r["expect"]))
        lines.append(
            f"| {r['label']} | {r['method']} | `{url_display}` | "
            f"{expect_display} | {r['actual']} | {ok_mark} | {json_mark} | {r['ms']} | {excerpt_display} |"
        )
    md_path.write_text("\n".join(lines) + "\n")

    print(f"json: {json_path}")
    print(f"md  : {md_path}")
    print(f"summary: total={total} pass={passed} fail={failed}")
    if failed:
        print("\nFAILS:")
        for r in results:
            if not r["ok"]:
                e = r["expect"] if not isinstance(r["expect"], list) else "/".join(map(str, r["expect"]))
                print(f"  {r['label']:38s} {r['method']:5s} expect={e} actual={r['actual']}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
