# End-to-End Journeys — Phase 12

Verified 2026-09-08. Full detail for the 2 strongest journeys from DEMO_CATALOG.md — persona,
trigger, I/P/O, KPI, demo steps, negative/failure scenario.

## Journey: Security scan → finding → triage → remediation → rescan (the strongest, most complete journey in the repo)

- **Persona:** Admin/operator
- **Problem:** Is the codebase currently vulnerable, and did a fix actually work?
- **Trigger:** Admin clicks "Run Scan" or the cron-scheduled `SecurityScanJob` fires
- **Input:** Target repo path (implicit — the running sohamyoga-frontend checkout)
- **Process:** `src/domain/security/scanners/{sast,dast,sca,iac}.ts` shell out to real semgrep/ZAP/npm
  audit/trivy+checkov; results parsed into a common finding shape
- **Output:** Rows in `security_finding`, fingerprinted for dedup
- **Business outcome:** A real, current vulnerability list, not a stale point-in-time report
- **KPI:** Finding count by severity, triage-state distribution (open/acknowledged/resolved)
- **Dependencies:** semgrep/ZAP/npm/trivy/checkov binaries installed in the running environment
- **Demo steps:** (1) trigger a scan, (2) view findings in the admin Control Tower, (3) mark one
  "acknowledged", (4) re-run the scan, (5) confirm the acknowledged finding's triage state persisted
  across the rescan (fingerprint-based dedup) rather than reappearing as new
- **Expected result:** Finding list reflects real tool output; triage state survives rescan
- **Negative scenario:** A scan tool binary is missing/misconfigured — per Phase 7, the IaC scanner
  has a documented, self-aware limitation (can't scan `docker-compose.yml` with the current tool
  versions) rather than silently reporting a false "clean"
- **Failure scenario:** Scan takes too long / times out — not independently verified this pass

## Journey: Lead capture → CRM → segmentation → campaign → follow-up → conversion

- **Persona:** Marketing admin
- **Problem:** Turn an inbound lead into a paying customer with real tracking at every step
- **Trigger:** A public form submission, or a UTM-tagged link click
- **Input:** Lead contact info + source/campaign metadata
- **Process:** Lead Routing Engine assigns to an admin (least-recently-assigned round-robin, Phase 1
  verified live with 9 real leads); Lead SLA Control flags overdue follow-up; Customer Segmentation
  evaluates real fields (membership_plan, spend, etc. — 4/5 fields real per 2026-09-08 build);
  Campaign Management dispatches real notifications (built 2026-09-08, replacing the earlier
  status-flip-only stub)
- **Output:** `campaign_lead` row with real status progression, attribution back to the original UTM
  link via a real `campaign_lead` JOIN (not a guess, per the UTM tracking module's own description)
- **Business outcome:** Attributable revenue per campaign/channel
- **KPI:** Lead-to-conversion rate, SLA compliance rate, cost-per-acquisition (the last one only if
  ad-spend data is also real — Paid Ads Management creation is real but launching to an actual ad
  platform is not, per Phase 1, so true CPA isn't fully closeable yet)
- **Demo steps:** (1) submit a tagged link click, (2) confirm a `campaign_lead` row appears with the
  right UTM attribution, (3) confirm routing assigns an admin, (4) advance the lead's status,
  (5) confirm SLA breach detection fires if left untouched past the deadline
- **Negative scenario:** No admin available to route to — not independently verified this pass
- **Failure scenario:** UTM parameters missing/malformed — bot/UA fraud filtering exists per Phase 1
  (added 2026-09-07), not independently re-tested this pass

## What this document does not cover

Full I/P/O detail for the remaining 8 journeys in DEMO_CATALOG.md — writing all 10 to this depth
would substantially duplicate content already covered across the Reality Matrix and PORTALS.md;
the 2 above were chosen as the strongest (most-real) and most business-representative
(revenue-adjacent) examples, per this audit's discipline against padding documents with
low-marginal-value repetition.
