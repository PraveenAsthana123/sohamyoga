# Security Gates — Phase 7 Audit

**Status:** what actually blocks a merge/deploy today, verified 2026-09-08, vs. what runs but doesn't
gate anything. Per this workspace's audit policy: security tooling that exists as an app feature is
not the same as security *enforcement* — this doc draws that line explicitly.

## What currently gates a merge (i.e., can fail CI)

`sohamyoga-frontend/.github/workflows/ci.yml` — the only CI workflow that runs on every push:

| Check | Gates merge? | Evidence |
|---|---|---|
| `next lint` | yes | `ci.yml` |
| `tsc --noEmit` | yes | `ci.yml` |
| `next build` | yes | `ci.yml` |
| Unit tests (Jest) | **no — not run in CI at all** | `ci.yml` has no test step; 125 real Jest test files exist under `src/__tests__/` but nothing executes them on push |
| E2E tests (Playwright) | **no** | 28 real spec files exist under `tests/e2e/`, not run in CI |
| SAST (semgrep) | **no** | real scanner exists at `src/domain/security/scanners/sast.ts`, runs only as an in-app admin feature / cron job, not CI |
| DAST (OWASP ZAP) | **no** | same — in-app only |
| SCA (`npm audit`) | **no** | same — in-app only |
| IaC scan (trivy/checkov) | **no** | same — in-app only, and per its own code comment can't even scan `docker-compose.yml` (tool limitation) |
| Secrets scanning | **no** | no gitleaks/trufflehog/detect-secrets config found anywhere in the repo |
| Dependency vulnerability alerts | **no** | no `.github/dependabot.yml` anywhere in the repo |
| SBOM generation | **no** | no SBOM tooling/config found |
| Container image scan | **no** | `deploy.yml` builds/pushes images to GHCR with no scan step |
| Static analysis (CodeQL) | **no** | no CodeQL workflow found |

`.github/workflows/audits.yml` runs Python scripts (`audit_recommender_flavors.py`,
`audit_dept_artifacts.py`, `audit_folder_readmes.py`, `audit_voice_ai_artifacts.py`) — these are
**documentation/completeness audits, not security checks**, and don't gate anything security-relevant.

**Other portals** (market-research-portal, voice-agent-platform, ai-orchestrator-platform,
password-manager, SohamYoga .NET) have **no CI workflow of any kind** — confirmed via `find . -path
'*/.github/workflows/*'` scoped to each portal directory returning nothing outside
sohamyoga-frontend's 3 files.

## What exists but doesn't gate anything (real, just not enforcing)

- **In-app SAST/DAST/SCA/IaC scanner** (sohamyoga-frontend only) — genuinely functional, persists
  findings to `security_scan_run`/`security_finding` tables with fingerprint-based dedup, triggered
  by cron or an admin clicking "run scan." A critical finding here today would not block tomorrow's
  deploy.
- **Playwright + Jest test suites** across sohamyoga-frontend (153 files), market-research-portal (8
  real e2e tests writing to a real `test_run` table), voice-agent-platform (zero), password-manager
  (zero), ai-orchestrator-platform (zero) — none of these run automatically on push anywhere.

## Gap summary (feeds SECURITY_RISK_REGISTER.md)

| Gap | Severity | Why it matters |
|---|---|---|
| No test execution in CI | High | A broken test (153 exist) does not block a merge today |
| No SAST/SCA/secrets-scan in CI | High | A newly-introduced vulnerability or leaked secret would not be caught before merge, even though the tooling to catch it already exists in-app |
| No Dependabot/equivalent | Medium | Known-vulnerable dependencies accumulate silently; no automated PR/alert |
| No CodeQL | Medium | No automated static taint/dataflow analysis on any portal |
| No container image scan before push to GHCR | Medium | An image with a vulnerable base layer or bundled CVE ships without a check |
| No CI at all for 5 of 6 portals | High | voice-agent-platform, market-research-portal, ai-orchestrator-platform, password-manager, SohamYoga .NET have zero automated quality/security gate of any kind |

## Recommended minimum viable gate set (not yet implemented — a proposal, not a claim)

A lint/typecheck/build/unit-test/`npm audit --audit-level=high` gate added to `ci.yml`, and a
skeleton `ci.yml` created for each of the other 5 portals, would close the highest-value gap without
a slow pipeline. This is scoped as a real, actionable next step, not implemented in this pass —
implementing it is a code change to `.github/workflows/*`, which the audit framework treats as
Phase 7 follow-through, and is offered here as a recommendation pending confirmation.
