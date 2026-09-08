# Top 10 P0/P1 Actions — Final Synthesis

Verified 2026-09-08. Priority-ordered per the mandated sequence: security vulnerabilities →
data-loss risks → broken core flows → missing CI quality gates → missing DB migration control →
missing auth enforcement → missing AI evaluation → reliability gaps → performance bottlenecks →
demo/revenue blockers. Only high-value items — not padded to reach 10 for its own sake (this list
has exactly the items that earned a place).

1. **[Security] Fix ai-orchestrator-platform's unsanitized XSS sink** (SEC-08/TD-14) — `DocxViewer.tsx`
   renders untrusted HTML via `dangerouslySetInnerHTML` with zero sanitization. Cheapest fix in the
   security register: wrap in DOMPurify, using sohamyoga-frontend's own `SafeHtml.tsx`/`sanitize.ts`
   as a ready-made template. **Effort: Low. Impact: closes a real, if narrow-blast-radius, XSS.**

2. **[Data-loss risk] Convert the one-time database backup into a recurring policy** (DB-05/TD-04) —
   a real `pg_dump` backup was taken this session for the two live-data Postgres instances (8.8MB +
   303KB), but nothing schedules a repeat. **Effort: Low (cron/systemd timer + the same pg_dump
   command). Impact: closes the highest-severity-if-it-happens finding in the entire audit.**

3. **[Broken core flow — already fixed, listed for completeness] The 3 live incidents found and
   fixed this session** (ai-orchestrator-platform backend down 4+ days, market-research-portal
   broken build, nginx stale-DNS 502) — all verified fixed with before/after evidence. **No further
   action needed on these specific instances; the systemic fix (below, #8) prevents recurrence.**

4. **[Missing CI quality gates] Add lint/test/`npm audit` to sohamyoga-frontend's existing CI, and a
   minimal CI workflow to the other 5 portals** (TD-02/SEC-02) — 153 real tests exist and never run
   automatically; 5 of 6 portals have zero CI of any kind. **Effort: Low-Medium. Impact: the second-
   highest-ROI item in the whole audit** — would have caught 2 of the 3 real incidents this session
   found (the broken build specifically) automatically.

5. **[Missing DB migration control] Adopt the proposed baseline-forward migration strategy**
   (DB-04/TD-05) — 4 of 6 portals have zero rollback capability for schema changes. **Effort:
   Medium. Impact: converts every future schema change from "hand-fix-it-live" to reversible.**

6. **[Missing auth enforcement — none found, but the one real regression risk] Write the
   voice-agent-platform tenant-isolation regression test** (TD-09) — the guard is proven correct and
   has already caught one real incident manually; it has zero automated protection against silently
   regressing. **Effort: Very low (the logic is already understood and documented). Impact: highest
   consequence-per-effort-dollar item in the entire register.**

7. **[Missing AI evaluation] Add token/cost/latency logging to the shared `OllamaClient` wrapper**
   (TD-10) — covers sohamyoga-frontend and market-research-portal's AI calls simultaneously since
   both already consume the same shared package. **Effort: Low. Impact: closes the "we have zero
   visibility into AI cost or performance" gap in one place instead of per-portal.**

8. **[Reliability gap] Restore OpenBao to a persistent storage backend** (SEC-01/TD-01) — currently
   ephemeral `-dev` mode, which already caused a real incident during this session's own Phase 1 fix
   (secrets lost on restart). **Effort: Medium (a real architecture decision, not just a flag flip).
   Impact: prevents this exact incident class from recurring.**

9. **[Performance/reliability, structural] Add an external health-check poller for all 6 portals**
   (OBS-01/TD-07) — the single most important structural gap this audit found: every real incident
   was invisible to existing monitoring because nothing checks "is the service actually working,"
   only "is the process alive." **Effort: Low-Medium (a 5-minute cron hitting each `/health` endpoint
   with alerting). Impact: would have caught all 3 real incidents automatically instead of requiring
   a full audit to surface them — the highest-leverage single action in this entire 18-phase audit.**

10. **[Demo/revenue blocker] Do NOT build a payment gateway yet** — listed here as a deliberate
    non-action per Phase 18's Stop-Building gate: revenue is not currently being sought (project
    memory: self-funded, no commercial use), and building payment infrastructure now would be
    premature relative to items 1-9 above. **When revenue is actually pursued, this becomes the
    top-priority item — tracked in REVENUE_READINESS.md as the real, named trigger condition.**

## If only 3 things happen next

Items 6 (near-zero effort, protects a proven fix), 9 (closes the root cause of every real incident
found this session), and 4 (mechanical, catches regressions before they ship) — in that order —
would close the highest-value gaps this 18-phase audit found, at a combined effort level far below
what it took to produce the audit itself.
