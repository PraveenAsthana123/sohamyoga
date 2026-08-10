#!/usr/bin/env python3
"""SohamYoga comprehensive API matrix — every endpoint, public + authenticated + write-cycle.

Strategy:
  1. ANONYMOUS GETs (public catalog + every sub-route)
  2. ADMIN flow: login → all admin-only GETs (incl. lists, by-id, sub-routes)
  3. ADMIN CRUD lifecycle per resource (create → read → update → delete)
     wrapped in try/finally so created rows get cleaned up even on failure.
  4. Negative tests: bogus slugs, role boundaries, wrong creds, invalid tokens
  5. CUSTOMER flow + role boundary
  6. UsersController coverage (admin-only)

Writes JSON + Markdown under jobs/reports/api_test_complete_<TS>.{json,md}.
"""
from __future__ import annotations

import datetime as dt
import http.cookiejar
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
ENV_PATH = ROOT / ".env"


def load_creds() -> tuple[str, str]:
    env: dict[str, str] = {}
    for line in ENV_PATH.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.split("#")[0].strip()
    return env["ADMIN_EMAIL"], env["ADMIN_PASSWORD"]


def make_opener() -> urllib.request.OpenerDirector:
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [("User-Agent", "sohamyoga-api-tester/1.0"), ("Accept", "application/json")]
    return opener


def probe(opener, label: str, expect, url: str, *, method: str = "GET", body: dict | None = None) -> dict:
    headers = {}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    t0 = time.perf_counter()
    payload = b""
    try:
        with opener.open(req, timeout=15) as resp:
            code = resp.status
            payload = resp.read(2048)
    except urllib.error.HTTPError as e:
        code = e.code
        try:
            payload = e.read(2048)
        except Exception:
            pass
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        code = 0
        payload = f"ERR: {e}".encode()
    ms = round((time.perf_counter() - t0) * 1000, 1)
    excerpt = payload[:180].decode("utf-8", errors="replace").replace("\n", " ").replace("|", "\\|")
    is_json = payload[:1] in (b"{", b"[")
    if isinstance(expect, (list, tuple, set)):
        ok = code in expect
    else:
        ok = code == expect
    return {
        "label": label, "url": url, "method": method,
        "expect": list(expect) if isinstance(expect, (list, tuple, set)) else expect,
        "actual": code, "ok": ok, "json": is_json, "ms": ms, "excerpt": excerpt,
    }


def parse_id(excerpt: str) -> int | None:
    try:
        obj = json.loads(excerpt + (")" if excerpt.endswith("(") else ""))
    except Exception:
        # Excerpt is truncated; pull "id":N out greedy-style
        import re
        m = re.search(r'"id"\s*:\s*(\d+)', excerpt)
        return int(m.group(1)) if m else None
    if isinstance(obj, dict):
        return obj.get("id")
    return None


def main() -> int:
    admin_email, admin_password = load_creds()
    results: list[dict] = []

    # ── 1. ANONYMOUS GETs ─────────────────────────────────────────────
    anon = make_opener()
    anon_get = [
        # Health
        ("health-direct", 200, f"{BACKEND}/api/health"),
        # Keep one nginx-routing sanity probe so we still validate the public surface.
        # All other tests hit :5070 directly to avoid the 20r/s nginx rate limit.
        ("health-via-nginx", 200, f"{NGINX}/api/health"),
        # HomeController
        ("home", 200, f"{BACKEND}/api/home"),
        ("home-settings", 200, f"{BACKEND}/api/home/settings"),
        # BlogController public
        ("blog-list", 200, f"{BACKEND}/api/blog"),
        ("blog-recent", 200, f"{BACKEND}/api/blog/recent"),
        ("blog-categories", 200, f"{BACKEND}/api/blog/categories"),
        # CaseStudiesController public
        ("casestudies-list", 200, f"{BACKEND}/api/casestudies"),
        # IndustriesController public
        ("industries-list", 200, f"{BACKEND}/api/industries"),
        ("industry-banking", 200, f"{BACKEND}/api/industries/banking-finance"),
        ("industry-oil-gas", 200, f"{BACKEND}/api/industries/oil-gas"),
        # ServicesController public
        ("services-list", 200, f"{BACKEND}/api/services"),
        ("services-featured", 200, f"{BACKEND}/api/services/featured"),
        ("services-by-category", 200, f"{BACKEND}/api/services/category/AI"),  # accepts any string
        ("service-sharepoint", 200, f"{BACKEND}/api/services/sharepoint"),
        ("service-ml", 200, f"{BACKEND}/api/services/machine-learning"),
        # TestimonialsController public
        ("testimonials-list", 200, f"{BACKEND}/api/testimonials"),
        # TeamController public
        ("team-list", 200, f"{BACKEND}/api/team"),
        # VideosController public
        ("videos-list", 200, f"{BACKEND}/api/videos"),
        ("videos-by-category", 200, f"{BACKEND}/api/videos/category/AI"),
        # JobsController public
        ("jobs-list", 200, f"{BACKEND}/api/jobs"),
        ("jobs-departments", 200, f"{BACKEND}/api/jobs/departments"),
        # LiveChat public (history is per-session, anonymous can probe with new id)
        ("live-chat-history-empty", [200, 404], f"{BACKEND}/api/live-chat/history/00000000-0000-0000-0000-000000000000"),
    ]
    results += [probe(anon, lbl, exp, url) for lbl, exp, url in anon_get]

    # Newsletter token endpoints (anonymous, expect 404/400 for bogus token)
    results += [
        probe(anon, "newsletter-unsubscribe-bogus", [200, 400, 404], f"{BACKEND}/api/newsletter/unsubscribe/bogus-token-not-real"),
        probe(anon, "newsletter-confirm-bogus", [200, 400, 404], f"{BACKEND}/api/newsletter/confirm/bogus-token-not-real"),
    ]

    # Negative slugs
    for label, path in [
        ("industry-404", "/api/industries/totally-not-a-thing"),
        ("service-404", "/api/services/totally-not-a-thing"),
        ("blog-404", "/api/blog/totally-not-a-thing"),
        ("casestudy-404", "/api/casestudies/totally-not-a-thing"),
        ("job-slug-404", "/api/jobs/slug/totally-not-a-thing"),
    ]:
        results.append(probe(anon, label, 404, f"{NGINX}{path}"))

    # Negative team/{id} + testimonials/{id} + videos/{id} with bogus int
    for label, path in [
        ("team-id-404", "/api/team/99999"),
        ("testimonials-id-404", "/api/testimonials/99999"),
        ("videos-id-404", "/api/videos/99999"),
    ]:
        results.append(probe(anon, label, 404, f"{NGINX}{path}"))

    # Anonymous auth-gated probes (expect 401)
    for label, path in [
        ("admin-me-anon", "/api/auth/me"),
        ("customer-me-anon", "/api/customer/auth/me"),
        ("admin-dashboard-anon", "/api/admin/dashboard"),
        ("admin-users-anon", "/api/admin/users"),
        ("live-chat-sessions-anon", "/api/live-chat/sessions"),
        ("jobs-admin-all-anon", "/api/jobs/admin/all"),
    ]:
        results.append(probe(anon, label, 401, f"{NGINX}{path}"))

    # Anonymous POSTs
    results.append(
        probe(anon, "newsletter-subscribe-anon", [200, 201],
              f"{BACKEND}/api/newsletter/subscribe", method="POST",
              body={"email": f"smoke-{TS.lower()}@example.com", "name": "SohamYoga Smoke"})
    )
    results.append(
        probe(anon, "contact-submit-anon", [200, 201],
              f"{BACKEND}/api/contact", method="POST",
              body={"name": "Smoke", "email": "smoke@example.com",
                    "subject": "api smoke", "message": "automated test"})
    )

    # Job apply (anonymous): need a real job id first
    jobs_list_resp = probe(anon, "jobs-list-for-apply", 200, f"{BACKEND}/api/jobs")
    job_apply_id = None
    try:
        jl = json.loads(jobs_list_resp["excerpt"] + "]") if jobs_list_resp["excerpt"].endswith(",") else json.loads(jobs_list_resp["excerpt"])
        if isinstance(jl, list) and jl and isinstance(jl[0], dict):
            job_apply_id = jl[0].get("id")
    except Exception:
        # fallback: grep "id":N
        import re
        m = re.search(r'"id"\s*:\s*(\d+)', jobs_list_resp["excerpt"])
        if m: job_apply_id = int(m.group(1))
    if job_apply_id:
        results.append(
            probe(anon, "job-apply-anon", [200, 201, 400, 404],
                  f"{BACKEND}/api/jobs/{job_apply_id}/apply", method="POST",
                  body={"applicantName": "Smoke Apply", "applicantEmail": "smoke@example.com",
                        "applicantPhone": "+1-555-0000", "coverLetter": "automated smoke",
                        "resumeUrl": "https://example.com/resume.pdf"})
        )

    # ── 2. ADMIN flow ─────────────────────────────────────────────────
    admin = make_opener()
    results.append(probe(admin, "admin-login", 200, f"{BACKEND}/api/auth/login",
                         method="POST", body={"email": admin_email, "password": admin_password}))
    if not results[-1]["ok"]:
        print("ADMIN LOGIN FAILED — aborting", file=sys.stderr)
        return _write_and_exit(results)

    results.append(probe(admin, "admin-me", 200, f"{BACKEND}/api/auth/me"))

    admin_gets = [
        ("admin-dashboard", "/api/admin/dashboard"),
        ("admin-users-list", "/api/admin/users"),
        ("admin-contact-list", "/api/contact"),
        ("admin-contact-unread-count", "/api/contact/unread-count"),
        ("admin-newsletter-subscribers", "/api/newsletter/subscribers"),
        ("admin-newsletter-count", "/api/newsletter/count"),
        ("admin-live-chat-sessions", "/api/live-chat/sessions"),
        ("admin-live-chat-unread", "/api/live-chat/unread-count"),
        ("admin-jobs-all", "/api/jobs/admin/all"),
        ("admin-jobs-applications", "/api/jobs/admin/applications"),
    ]
    results += [probe(admin, label, 200, f"{NGINX}{path}") for label, path in admin_gets]

    # Role-boundary: admin denied on Customer-only route
    results.append(probe(admin, "admin-blocked-customer-route", 403,
                         f"{BACKEND}/api/live-chat/customer-sessions"))

    # ── 3. ADMIN CRUD lifecycles ──────────────────────────────────────
    created_ids: dict[str, int] = {}
    try:
        # 3a. Industries
        r = probe(admin, "industry-create", [200, 201], f"{BACKEND}/api/industries",
                  method="POST",
                  body={"title": f"_test_{TS}_ind", "slug": f"test-{TS.lower()}-ind",
                        "shortDescription": "smoke test", "fullDescription": "<p>smoke</p>",
                        "iconSvg": "<svg></svg>", "challenges": "[]", "solutions": "[]",
                        "isActive": True, "displayOrder": 9999})
        results.append(r)
        ind_id = parse_id(r["excerpt"]) if r["ok"] else None
        if ind_id:
            created_ids["industry"] = ind_id
            results.append(probe(admin, "industry-read-after-create", 200,
                                 f"{BACKEND}/api/industries/test-{TS.lower()}-ind"))
            results.append(probe(admin, "industry-update", [200, 204], f"{BACKEND}/api/industries/{ind_id}",
                                 method="PUT",
                                 body={"id": ind_id, "title": f"_test_{TS}_ind_u",
                                       "slug": f"test-{TS.lower()}-ind",
                                       "shortDescription": "updated", "fullDescription": "<p>updated</p>",
                                       "iconSvg": "", "challenges": "[]", "solutions": "[]",
                                       "isActive": True, "displayOrder": 9999}))

        # 3b. Services
        r = probe(admin, "service-create", [200, 201], f"{BACKEND}/api/services",
                  method="POST",
                  body={"title": f"_test_{TS}_svc", "slug": f"test-{TS.lower()}-svc",
                        "category": "Test", "shortDescription": "smoke", "fullDescription": "<p>s</p>",
                        "iconSvg": "<svg></svg>", "features": "[]", "isFeatured": False,
                        "isActive": True, "displayOrder": 9999})
        results.append(r)
        svc_id = parse_id(r["excerpt"]) if r["ok"] else None
        if svc_id:
            created_ids["service"] = svc_id
            results.append(probe(admin, "service-update", [200, 204], f"{BACKEND}/api/services/{svc_id}",
                                 method="PUT",
                                 body={"id": svc_id, "title": f"_test_{TS}_svc_u",
                                       "slug": f"test-{TS.lower()}-svc", "category": "Test",
                                       "shortDescription": "u", "fullDescription": "<p>u</p>",
                                       "iconSvg": "", "features": "[]", "isFeatured": False,
                                       "isActive": True, "displayOrder": 9999}))

        # 3c. Testimonials (entity uses AuthorName/Quote/Company, not clientName/text)
        r = probe(admin, "testimonial-create", [200, 201], f"{BACKEND}/api/testimonials",
                  method="POST",
                  body={"authorName": f"_test_{TS}", "authorTitle": "Tester",
                        "company": "Smoke Co", "quote": "Great service for smoke test.",
                        "initials": "ST", "rating": 5, "isActive": True, "displayOrder": 9999,
                        "imageUrl": ""})
        results.append(r)
        tm_id = parse_id(r["excerpt"]) if r["ok"] else None
        if tm_id:
            created_ids["testimonial"] = tm_id
            results.append(probe(admin, "testimonial-read-by-id", 200,
                                 f"{BACKEND}/api/testimonials/{tm_id}"))
            results.append(probe(admin, "testimonial-update", [200, 204],
                                 f"{BACKEND}/api/testimonials/{tm_id}", method="PUT",
                                 body={"id": tm_id, "clientName": f"_test_{TS}_u",
                                       "clientCompany": "smoke Co", "clientTitle": "T",
                                       "testimonialText": "updated", "rating": 5,
                                       "isActive": True, "displayOrder": 9999, "avatarUrl": ""}))

        # 3d. Videos (entity uses VideoUrl)
        r = probe(admin, "video-create", [200, 201], f"{BACKEND}/api/videos",
                  method="POST",
                  body={"title": f"_test_{TS}_vid", "description": "smoke description",
                        "videoUrl": "https://youtu.be/dQw4w9WgXcQ", "category": "Test",
                        "thumbnailUrl": "", "duration": "0:30",
                        "isActive": True, "displayOrder": 9999})
        results.append(r)
        vid_id = parse_id(r["excerpt"]) if r["ok"] else None
        if vid_id:
            created_ids["video"] = vid_id
            results.append(probe(admin, "video-read-by-id", 200, f"{BACKEND}/api/videos/{vid_id}"))
            results.append(probe(admin, "video-update", [200, 204], f"{BACKEND}/api/videos/{vid_id}",
                                 method="PUT",
                                 body={"id": vid_id, "title": f"_test_{TS}_vid_u",
                                       "description": "u", "youtubeUrl": "https://youtu.be/dQw4w9WgXcQ",
                                       "category": "Test", "thumbnailUrl": "", "isActive": True,
                                       "displayOrder": 9999}))

        # 3e. Case study (entity uses Description + FullContent + Tag + IconSvg)
        r = probe(admin, "casestudy-create", [200, 201], f"{BACKEND}/api/casestudies",
                  method="POST",
                  body={"title": f"_test_{TS}_cs", "slug": f"test-{TS.lower()}-cs",
                        "description": "smoke summary", "fullContent": "<p>full content</p>",
                        "tag": "TestTag", "gradientFrom": "#000", "gradientTo": "#fff",
                        "iconSvg": "<svg></svg>", "isActive": True, "displayOrder": 9999})
        results.append(r)
        cs_id = parse_id(r["excerpt"]) if r["ok"] else None
        if cs_id:
            created_ids["casestudy"] = cs_id
            results.append(probe(admin, "casestudy-read-after-create", 200,
                                 f"{BACKEND}/api/casestudies/test-{TS.lower()}-cs"))

        # 3f. Contact mark-read (use an existing contact if any)
        clist = probe(admin, "_internal-contact-list-pick", 200, f"{BACKEND}/api/contact")
        first_contact_id = parse_id(clist["excerpt"])
        if first_contact_id:
            results.append(probe(admin, "contact-by-id", 200, f"{BACKEND}/api/contact/{first_contact_id}"))
            results.append(probe(admin, "contact-mark-read", [200, 204],
                                 f"{BACKEND}/api/contact/{first_contact_id}/read", method="PUT", body={}))
            results.append(probe(admin, "contact-archive", [200, 204],
                                 f"{BACKEND}/api/contact/{first_contact_id}/archive", method="PUT", body={}))

        # 3g. Job admin-by-id read (if any job exists)
        if job_apply_id:
            results.append(probe(admin, "job-admin-by-id", 200, f"{BACKEND}/api/jobs/admin/{job_apply_id}"))

    finally:
        # Cleanup created rows (best-effort; ignore failures)
        for kind, rid in created_ids.items():
            url = {
                "industry": f"{BACKEND}/api/industries/{rid}",
                "service": f"{BACKEND}/api/services/{rid}",
                "testimonial": f"{BACKEND}/api/testimonials/{rid}",
                "video": f"{BACKEND}/api/videos/{rid}",
                "casestudy": f"{BACKEND}/api/casestudies/{rid}",
            }[kind]
            results.append(probe(admin, f"{kind}-delete-teardown", [200, 204, 404],
                                 url, method="DELETE"))

    # ── 3h. UsersController lifecycle (admin-only) ────────────────────
    # Create a disposable Editor user, list, change roles, delete, verify gone.
    test_user_email = f"smoke-user-{TS.lower()}@example.com"
    test_user_id: str | None = None
    try:
        r = probe(admin, "user-create", [200, 201], f"{BACKEND}/api/admin/users",
                  method="POST",
                  body={"email": test_user_email, "password": "Smoke@123456", "role": "Editor"})
        results.append(r)
        if r["ok"]:
            try:
                obj = json.loads(r["excerpt"][:200] + "}" if not r["excerpt"].endswith("}") else r["excerpt"])
                test_user_id = obj.get("id") if isinstance(obj, dict) else None
            except Exception:
                import re
                m = re.search(r'"id"\s*:\s*"([0-9a-f-]+)"', r["excerpt"])
                test_user_id = m.group(1) if m else None

        results.append(probe(admin, "user-list-after-create", 200, f"{BACKEND}/api/admin/users"))

        if test_user_id:
            results.append(probe(admin, "user-update-roles", 200,
                                 f"{BACKEND}/api/admin/users/{test_user_id}/roles",
                                 method="PUT", body={"roles": ["HR"]}))

        # Negative: invalid role
        results.append(probe(admin, "user-create-invalid-role", 400,
                             f"{BACKEND}/api/admin/users", method="POST",
                             body={"email": f"bad-{TS.lower()}@example.com",
                                   "password": "Smoke@123456", "role": "BogusRole"}))
        # Negative: missing email
        results.append(probe(admin, "user-create-missing-email", 400,
                             f"{BACKEND}/api/admin/users", method="POST",
                             body={"password": "Smoke@123456", "role": "Editor"}))
        # Negative: delete non-existent
        results.append(probe(admin, "user-delete-404", 404,
                             f"{BACKEND}/api/admin/users/00000000-0000-0000-0000-000000000000",
                             method="DELETE"))
        # Negative: self-delete forbidden
        me = probe(admin, "_internal-me-for-self-delete", 200, f"{BACKEND}/api/auth/me")
        import re as _re
        m = _re.search(r'"id"\s*:\s*"([0-9a-f-]+)"', me["excerpt"])
        if m:
            results.append(probe(admin, "user-self-delete-forbidden", 400,
                                 f"{BACKEND}/api/admin/users/{m.group(1)}",
                                 method="DELETE"))
    finally:
        if test_user_id:
            results.append(probe(admin, "user-delete-teardown", [200, 204, 404],
                                 f"{BACKEND}/api/admin/users/{test_user_id}", method="DELETE"))
            # Post-teardown: PUT roles on deleted user → 404
            results.append(probe(admin, "user-update-roles-after-delete", 404,
                                 f"{BACKEND}/api/admin/users/{test_user_id}/roles",
                                 method="PUT", body={"roles": ["Editor"]}))

    # ── 4. Admin logout + post-logout 401 ─────────────────────────────
    results.append(probe(admin, "admin-logout", 200, f"{BACKEND}/api/auth/logout", method="POST", body={}))
    results.append(probe(admin, "admin-me-after-logout", 401, f"{BACKEND}/api/auth/me"))

    # ── 5. CUSTOMER flow ─────────────────────────────────────────────
    customer = make_opener()
    cust_email = f"smoke-cust-{TS.lower()}@example.com"
    cust_password = "Smoke@123456"
    results.append(probe(customer, "customer-register", [200, 201, 400],
                         f"{BACKEND}/api/customer/auth/register", method="POST",
                         body={"name": "Smoke Customer", "email": cust_email, "password": cust_password}))
    results.append(probe(customer, "customer-login", 200,
                         f"{BACKEND}/api/customer/auth/login", method="POST",
                         body={"email": cust_email, "password": cust_password}))
    if results[-1]["ok"]:
        results.append(probe(customer, "customer-me", 200, f"{BACKEND}/api/customer/auth/me"))
        # As Customer, the customer-only route should now return 200
        results.append(probe(customer, "customer-allowed-customer-route", 200,
                             f"{BACKEND}/api/live-chat/customer-sessions"))
        results.append(probe(customer, "customer-logout", 200,
                             f"{BACKEND}/api/customer/auth/logout", method="POST", body={}))
        results.append(probe(customer, "customer-me-after-logout", 401,
                             f"{BACKEND}/api/customer/auth/me"))

    # ── 6. Wrong credentials / unknown user ──────────────────────────
    bad = make_opener()
    results.append(probe(bad, "admin-login-wrong-pwd", 401, f"{BACKEND}/api/auth/login",
                         method="POST", body={"email": admin_email, "password": "wrong-password"}))
    results.append(probe(bad, "admin-login-unknown", 401, f"{BACKEND}/api/auth/login",
                         method="POST", body={"email": "nobody@example.com", "password": "x"}))

    return _write_and_exit(results)


def _write_and_exit(results: list[dict]) -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    json_path = OUT_DIR / f"api_test_complete_{TS}.json"
    md_path = OUT_DIR / f"api_test_complete_{TS}.md"

    total = len(results)
    passed = sum(1 for r in results if r["ok"])
    failed = total - passed

    json_path.write_text(json.dumps({"ts": TS, "total": total, "pass": passed, "fail": failed,
                                     "results": results}, indent=2))

    lines = [
        "# Complete API Test Report",
        "",
        f"**Run:** {TS}  ",
        f"**Total:** {total}  **Pass:** {passed}  **Fail:** {failed}",
        "",
        "| Label | Method | URL | Expect | Actual | OK | ms |",
        "|---|---|---|---:|---:|:---:|---:|",
    ]
    for r in results:
        mark = "✓" if r["ok"] else "✗"
        url_d = r["url"].replace("|", "\\|")
        e = r["expect"] if not isinstance(r["expect"], list) else "/".join(map(str, r["expect"]))
        lines.append(f"| {r['label']} | {r['method']} | `{url_d}` | {e} | {r['actual']} | {mark} | {r['ms']} |")
    md_path.write_text("\n".join(lines) + "\n")

    print(f"json: {json_path}")
    print(f"md  : {md_path}")
    print(f"summary: total={total} pass={passed} fail={failed}")
    if failed:
        print("\nFAILS:")
        for r in results:
            if not r["ok"]:
                e = r["expect"] if not isinstance(r["expect"], list) else "/".join(map(str, r["expect"]))
                excerpt = (r["excerpt"] or "")[:100]
                print(f"  {r['label']:38s} {r['method']:5s} expect={e} actual={r['actual']} | {excerpt}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
