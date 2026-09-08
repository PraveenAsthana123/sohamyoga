# ADR-0004: SAST/DAST/SCA/IaC scanning runs as an in-app cron feature, not a CI gate

**Status:** Accepted (in effect) — flagged as a risk in [ATAM.md](../ATAM.md), not necessarily final

## Context
`src/domain/security/scanners/` wraps real CLI tools (semgrep, OWASP ZAP, `npm audit`,
trivy/checkov) and persists results to `security_scan_run`/`security_finding` tables, triggered by
`src/cron/jobs/SecurityScanJob.ts`. Separately, `.github/workflows/ci.yml` runs only
`next lint` + `tsc --noEmit` + `next build` — no test execution, no security scan step. No CodeQL,
Dependabot, or SBOM generation exists anywhere in the repo (verified by `find`).

## Decision
Security scanning is a first-class in-app admin feature (viewable, re-runnable, with finding
triage state preserved across rescans) rather than a CI/CD merge gate.

## Consequences
- **Positive:** findings are queryable and persistent, not just build-log noise; triage state
  survives rescans via fingerprint-based dedup.
- **Negative:** a vulnerable dependency or an IaC misconfiguration can merge to `main` without any
  automated block — the scan only runs when someone (or a cron schedule) triggers it inside the
  running app. There is no SBOM and no Dependabot alerting either. This is the single largest
  real gap in the security posture and should be weighed before treating this system as
  CI/CD-gated-secure.
