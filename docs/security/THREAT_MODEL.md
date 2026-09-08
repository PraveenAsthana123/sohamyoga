# Threat Model — Phase 7 Audit

STRIDE-lens threat model built from real findings (grep/file-read evidence), not a generic
checklist. Verified 2026-09-08. Status: 5 of 6 portals' header/session/CORS/CSRF/XSS posture
confirmed; sohamyoga-frontend's equivalent pass is the one piece still pending at time of writing —
will be appended, not fabricated here.

## Cross-portal pattern: CSRF relies solely on SameSite=Lax, everywhere

**Confirmed identically across all 5 portals audited so far** (market-research-portal,
password-manager, voice-agent-platform, ai-orchestrator-platform, SohamYoga .NET): zero portals
implement a dedicated CSRF token, double-submit cookie, or Origin/Referer check. Every
state-changing endpoint's only CSRF defense is `SameSite=Lax` on the session cookie, which blocks
the cookie on cross-site POST/PUT/DELETE but is a browser behavior, not an application-layer
control. **This is a real, repeated architectural gap, not a one-off oversight** — it's the same
missing control in 5 independently-implemented auth systems. SohamYoga .NET's finding names this
most precisely: "cookie-based session auth on state-changing endpoints without
`[ValidateAntiForgeryToken]` is CSRF-exposed unless SameSite=Lax is relied upon as the sole
mitigation" — that sentence applies verbatim to all 5.

**Severity:** Medium, not Critical — SameSite=Lax is a real, modern-browser-enforced mitigation for
the classic CSRF attack shape (cross-site form POST). Risk concentrates in scenarios SameSite=Lax
doesn't cover: browsers with cookie/privacy settings that weaken SameSite enforcement, or any future
subdomain-hosted content that counts as same-site. Recommend defense-in-depth (CSRF token or
custom-header requirement) as a P2, not P0/P1.

## Cross-portal pattern: zero rate limiting on authentication endpoints, everywhere except one

| Portal | `/login` or equivalent rate-limited? | Evidence |
|---|---|---|
| market-research-portal | **No** — only `leads/capture` and `intake` are rate-limited (5 req/min) | grep confirmed `isRateLimited` used in exactly 2 files, neither is login |
| password-manager | No | grep-confirmed zero rate-limiting code/dependency anywhere |
| voice-agent-platform | No — also, **real outbound phone calls have no rate cap** (`POST /api/admin/calls/place`), only `requireAdmin` gates it | grep-confirmed |
| ai-orchestrator-platform | No | grep-confirmed, only `secrets.compare_digest` for constant-time compare, no lockout |
| SohamYoga .NET | **Yes, but not endpoint-specific** — a global 100 req/60s per-IP limiter applies uniformly, including to `/api/auth/login`, but there's no tighter policy just for auth | `RateLimitingMiddleware.cs`, confirmed no `[EnableRateLimiting]` per-endpoint override |
| sohamyoga-frontend | **N/A — no login route exists in this repo at all.** Auth is entirely delegated to the SohamYoga .NET backend (see above); this app only forwards cookies. | grep-confirmed zero login/signup/register/password-reset route files under `src/app/api` |

**Severity:** High for voice-agent-platform specifically (unrated-limited real-money phone-call
placement + unrated-limited login = both a cost-abuse vector and a credential-stuffing vector on the
same portal). Medium for the others (credential-stuffing/brute-force exposure on login, partially
mitigated by password hashing cost — scrypt/Argon2id/bcrypt-class algorithms all impose real
per-attempt cost even without app-level throttling, but that's a weaker defense than actual rate
limiting).

## Cross-portal pattern: CSP is present in 3/5, absent in 2/5, and where present allows unsafe-inline/eval everywhere

| Portal | CSP | Allows unsafe-inline/eval? |
|---|---|---|
| market-research-portal | Yes, `default-src 'self'` base | `unsafe-inline` (script+style) always; `unsafe-eval` in dev only |
| SohamYoga .NET | Yes, `default-src 'self'` base | both `unsafe-inline` AND `unsafe-eval`, unconditionally |
| password-manager | **No CSP at all** | n/a |
| voice-agent-platform | **No CSP at all** | n/a |
| ai-orchestrator-platform (backend+frontend) | **No CSP at all** | n/a |
| sohamyoga-frontend | Yes, `default-src 'self'` base (`next.config.js:32-49`) | `unsafe-inline`+`unsafe-eval` on `script-src`, unconditionally |

**Severity:** Low-Medium. A CSP with `unsafe-inline`/`unsafe-eval` is meaningfully weaker than a
nonce-based CSP but still blocks some injection classes (external script loading, object/embed).
Absence of any CSP on 3 portals is the more concrete gap — standard defense-in-depth against any
future XSS finding.

## A real, concrete XSS finding: ai-orchestrator-platform's DocxViewer

**Not a pattern — a specific, exploitable-in-principle finding.**
`frontend/src/components/DocxViewer.tsx:56` renders `mammoth.convertToHtml()`'s raw output via
`dangerouslySetInnerHTML` with **zero sanitization** — no DOMPurify, confirmed absent from both the
codebase and `package.json`. The HTML comes from any `.docx` file reachable via the backend's
`/fs/raw` endpoint under the app's configured project roots (`config.py`). Since this app is a
personal, single-operator tool whose filesystem access is intentionally scoped to trusted project
directories, the realistic attack requires an attacker to first get a malicious `.docx` into one of
those directories — meaningfully reduces exploitability versus a public multi-tenant app, but the
missing sanitization step is real and cheap to fix (wrap the `mammoth` output in DOMPurify before
render). **Severity: Medium** (real vulnerability, constrained blast radius given the single-operator
threat model).

sohamyoga-frontend has `dompurify` installed per Phase 1 tech-stack findings — worth confirming (in
the pending sohamyoga-frontend pass) that it's actually applied at every raw-HTML render point, not
just present as a dependency.

## A genuine positive finding: sohamyoga-frontend's XSS sanitization is done correctly

Worth recording, not just gaps — sohamyoga-frontend has exactly one `dangerouslySetInnerHTML` call
site in its entire codebase (`src/components/SafeHtml.tsx:19`), and it's routed through a real
DOMPurify call (`src/lib/sanitize.ts`) with an explicit tag/attribute allowlist and
`ALLOW_DATA_ATTR: false`, with a regex-strip fallback for the server-side (no-DOM) render path. This
is the correct pattern — a single sanitization chokepoint rather than scattered raw-HTML rendering —
and stands in direct contrast to ai-orchestrator-platform's `DocxViewer.tsx` finding above, which has
`dompurify` nowhere in its dependency tree. Confirms the earlier module-registry finding that
`dompurify` in `package.json` is genuinely applied, not just installed-and-unused.

## Dependency vulnerabilities (SCA) — real tool output, not estimated

Full detail in [SECURITY_RISK_REGISTER.md](SECURITY_RISK_REGISTER.md). Headline: **3 of 5 Node
portals (market-research-portal, voice-agent-platform, password-manager) share an identical set of 5
high-severity findings** — all rooted in an outdated `next`/`eslint-config-next`/`postcss` toolchain,
none fixable without a major-version bump. sohamyoga-frontend carries the largest raw count (39
findings, 15 high) but 25 are non-breaking-fixable. ai-orchestrator-platform/frontend, the Python
backend, and the .NET backend show few-to-zero known vulnerabilities in their current pinned
versions. This is a **Supply Chain / Tampering-adjacent** threat category: an outdated framework
version is a real, scored (CVE-backed) exposure, distinct from the custom-code findings above.

## Secrets/vault threat: the OpenBao dev-mode finding, reframed as a threat

Already documented in [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) §3 — reframed here in
STRIDE terms: this is an **Information Disclosure / Availability** threat, not a classic injection
threat. The vault's `-dev` mode means (a) no audit log of secret access, (b) a single root token
with no real ACL boundaries, (c) total secret loss on every restart. The realistic failure mode
already happened during this audit: a routine restart during the Phase 1 incident-fix wiped whatever
provider keys were previously stored, with no alert. **Severity: High** — not because of an external
attacker, but because it's a live reliability/availability threat against the app's own core
function (AI provider access) that already materialized once, undetected, before this audit.

## What this document does not model

Full attacker-persona threat trees (external anonymous, authenticated low-priv, insider,
supply-chain) per OWASP Top 10 + API Security Top 10 categories exhaustively, for every endpoint —
that's a larger deliverable than this pass covers. This document prioritizes **patterns confirmed
by real evidence across multiple portals** and **specific concrete findings**, over a generic
checklist filled from assumption. See [SECURITY_RISK_REGISTER.md](SECURITY_RISK_REGISTER.md) for
the full itemized, severity-scored register once the dependency scan lands.
