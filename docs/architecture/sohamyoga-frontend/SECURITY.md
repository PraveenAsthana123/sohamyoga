# Security — sohamyoga-frontend

## 1. Access layers by actor

| Actor | Gate | File | Behavior |
|---|---|---|---|
| Customer | `requireCustomer` → `getCustomerPrincipal()` | `src/lib/customer-auth.ts` | Calls `.NET` backend `/api/customer/auth/me` with forwarded cookie; any authenticated customer passes; 401 if not authenticated. Used in 38 route files. |
| Admin | `requireAdmin` → `getAdminPrincipal()` | `src/lib/admin-auth.ts` | Calls backend `/api/auth/me`; requires role in `['Admin','Editor','Sales']`; 403 otherwise, 401 unauthenticated, 503 if auth service unreachable. Used in 230 route files. |
| Finer-grained roles | `RolePermission.ts` | `src/domain/security/RolePermission.ts` + `db-schema.sql` | Layered on top of the coarse Admin/Editor/Sales check for permission-level control. |
| API (external callers) | Same `requireAdmin`/`requireCustomer` gates apply per-route — no separate API-key tier found | — | — |
| Ops | **Not found as a distinct tier.** Only customer / admin / public separation exists in code. | — | — |

**Structural gap (see ATAM S-1):** there is no `middleware.ts`. Every route is individually
responsible for calling its gate helper — nothing prevents a new route from forgetting to.

## 2. Secrets management

`src/lib/openbao.ts` fetches credentials from an OpenBao vault at runtime rather than relying on
env vars alone. Used by the Skyvern client and others (`src/domain/platform-setup/` backs
credential/scenario management, schema in `db-schema-secure-credentials.sql`).

## 3. In-app security scanning subsystem (real, functioning)

`src/domain/security/scanners/` — 4 files, each a thin wrapper shelling out to a real installed CLI:

| Scanner | File | Tool | Notes |
|---|---|---|---|
| SAST | `sast.ts` | `semgrep` (free `semgrep.dev/r` rulesets) | No login required |
| DAST | `dast.ts` | OWASP ZAP | Parses ZAP JSON alert output |
| SCA | `sca.ts` | `npm audit` | Parses `NpmAuditVia` JSON |
| IaC | `iac.ts` | `trivy config` / `checkov`, targets Dockerfiles | Documented gap: neither tool version in use can scan `docker-compose.yml` directly (as of 2026-09-01) |

Results persist to `security_scan_run` / `security_finding` tables via
`src/domain/security/runScan.ts`, with fingerprint-based dedup preserving triage state across
rescans. Triggered by a real cron job, `src/cron/jobs/SecurityScanJob.ts`.

## 4. CI/CD security gate inventory (what's actually configured)

`.github/workflows/` — 3 files total:

| Workflow | Does | Does NOT do |
|---|---|---|
| `ci.yml` | `next lint`, `tsc --noEmit`, `next build` | No test execution, no security scan step |
| `audits.yml` | Internal doc/artifact-consistency audits (Python scripts) | Not a security scan |
| `deploy.yml` | Builds/pushes Docker images to GHCR | No scan gate before deploy |

**Confirmed absent** (checked via `find`, not assumed): CodeQL workflow, Trivy/Snyk GitHub Action,
`.github/dependabot.yml`, any SBOM file, `.semgrep` config, `.trivyignore`.

**Bottom line:** real SAST/DAST/SCA/IaC tooling exists and works, but it is an in-app admin feature
triggered on demand or by cron — not a CI/CD merge gate. A vulnerable dependency or a bad IaC change
can merge to `main` today without being blocked. See [ADR-0004](ADR/0004-security-scans-in-app-not-ci.md).

## 5. SOLID / architectural style notes

- **Single Responsibility**: domain folders are narrowly scoped (57 domains, each with its own
  schema + entity files) — consistent with SRP at the module level.
- **Not microservices**: this is a modular monolith — one Next.js app serving 383 API routes across
  57 domains against one shared Postgres instance, not independently deployable services. The only
  separately-deployed pieces are the `.NET` auth backend, the cron runner, and the Ollama bridge —
  everything else runs inside the single `frontend` container.
- **Dependency direction**: domain modules depend on shared `src/lib/*` (postgres, auth, openbao)
  rather than on each other directly, per the one exception found (`shared/HealthModel.ts` reused by
  6 domain-specific health-score modules) — a legitimate shared abstraction, not a violation.

## 6. Output evaluation

No dedicated "output evaluation" (e.g. LLM-response grading/eval harness) subsystem was found for
the Ollama integration — `src/lib/ollama.ts` wraps calls with a circuit breaker
(`@sohamyoga/shared-backend`) for reliability, but no eval/scoring pipeline for output quality was
located in this pass. Flagging as unverified-absent rather than confirmed-absent — a targeted
follow-up search would be needed to be certain.
