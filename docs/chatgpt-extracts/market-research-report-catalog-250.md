# Extracted: Market Research Report Generation Catalog (250 report types)

Source: [ChatGPT shared conversation](https://chatgpt.com/share/6a96766b-2d74-83e8-bf87-91ee34ce9cd7), "Market Research Reports", 52 messages. Extracted via the mandatory `chatgpt_share_extract.py` script (first attempt truncated mid-transcript at 316KB via the tool-result capture; re-ran redirecting stdout straight to a file to get the full 557KB / all 52 messages).

## Full enumeration of every user turn (26 total)

| # | Index | Text | Classification |
|---|---|---|---|
| 1 | 0 | "list of report generation in market research" | **Real prompt** |
| 2 | 2 | "explain each report in detail ..heading ,sub heading, topic need to adress , layout , table, grapho, trend, pie,bar" | **Real prompt** |
| 3 | 4 | "next" | Trivial continuation |
| 4 | 6 | "next" | Trivial continuation |
| 5 | 8 | "next -USE SOME SAMPLE DATA TO UNDRESTAND BETTER, IMPACT, KPI,KRI,KCI,VALUE" | **Real prompt** (modifies the instruction, not a bare continuation) |
| 6 | 10 | "NEXT" | Trivial continuation |
| 7 | 12 | "next" | Trivial continuation |
| 8 | 14 | "next" | Trivial continuation |
| 9 | 16 | "next" | Trivial continuation |
| 10 | 18 | "next" | Trivial continuation |
| 11 | 20 | "next" | Trivial continuation |
| 12 | 22 | "next" | Trivial continuation |
| 13 | 24 | "NEXT" | Trivial continuation |
| 14 | 26 | "next" | Trivial continuation |
| 15 | 28 | "next" | Trivial continuation |
| 16 | 30 | "next" | Trivial continuation |
| 17 | 32 | "next" | Trivial continuation |
| 18 | 34 | "NEXT" | Trivial continuation |
| 19 | 36 | "next" | Trivial continuation |
| 20 | 38 | "next" | Trivial continuation |
| 21 | 40 | "next" | Trivial continuation |
| 22 | 42 | "next" | Trivial continuation |
| 23 | 44 | "next" | Trivial continuation |
| 24 | 46 | "next" | Trivial continuation |
| 25 | 48 | "next" | Trivial continuation |
| 26 | 50 | "next" | Trivial continuation |

**Count check: 26 user turns total, 3 real prompts (indices 0, 2, 8), 23 trivial "next" continuations. No pasted reference material, no redacted/unrecoverable tool output — all 52 messages (26 user + 26 assistant) extracted cleanly as plain markdown text, nothing missing.**

## What the conversation actually contains

This is not 3 short answers — every "next" continuation carries substantive content. The assistant used the "next" cadence to walk through a self-organized catalog of **12 report families → 250 individually specified report types** (10 reports fully detailed per assistant turn, indices 3 through 51). Each of the 250 reports gets a consistent template: Purpose, Recommended Headings (15-25), Topics to Address, Recommended Tables, Recommended Graphs (pie/bar/line/stacked/bubble/map), Dashboard KPIs. Starting at report 31 (message index 9, driven by the real prompt "USE SOME SAMPLE DATA..."), every report also gets a worked numeric example against a fictional business ("Soham Wellness", Calgary yoga/wellness, 1,000 customers, CAD 50k/month revenue) with sample survey data, a business-impact calculation, and KPI/KRI/KCI framing.

The 12 report families (from message index 1): Market Landscape, Market Growth & Forecast, Competitor Intelligence, Customer Intelligence, Consumer Psychology, Pricing Intelligence, Product/Service Research, Marketing Intelligence, Lead & Demand Intelligence, Digital & Social Intelligence, Risk & Opportunity Intelligence, Executive/Strategy Reports.

Total assistant content: ~510,000 characters across 26 responses (average ~19,600 chars per "next" turn, each covering exactly 10 report specs).

## Cross-check against the current codebase (market-research-portal)

Per the mandatory completeness policy, checked this against current code rather than assuming genericness — this is directly on-target for market-research-portal's actual purpose (see saved memory: the real product is a generic enterprise market-research/marketing suite, not the yoga vertical). Findings from a live Explore-agent audit (2026-09-01):

- **One real, end-to-end report capability exists**: `meeting_report` table (`src/domain/pipeline/db-schema-meeting-reports.sql`) with two types (`pre_meeting_brief`, `post_meeting_report`), real CRUD (`src/app/api/meeting-reports/route.ts`, `[id]/route.ts`), a real PDF export (`src/app/api/meeting-reports/[id]/export/route.ts`, added this session), and a real UI (`src/app/(app)/meeting-reports/page.tsx`, `[id]/page.tsx`). This is a manually-typed brief template, not an auto-generated analytical report with charts/KPI dashboards as the catalog specifies.
- **Adjacent but not report artifacts**: `competitor`/`competitor_feature` (live comparison grid, no generated document — closest thing to Competitor Intelligence); `topic_signal`/`topic_flow`/`hook_experiment` (dashboard widgets, no export); `phase_run` (17-phase study pipeline, per-phase free-text `final_outcome_report` field, no PDF export, doesn't map to any single named family).
- **No `report_type`/`report_catalog`/`report_registry` table exists** anywhere in market-research-portal, and nothing equivalent to the shared `sohamyoga` DB's `module_registry` scoped to reports. `meeting_report.report_type` is a 2-value CHECK constraint, not an extensible catalog.
- **Honest coverage verdict**: of the ~12 families, at most 2 (Customer Intelligence, Competitor Intelligence) have any real-but-thin representation, and even those cover a sliver of the spec (no auto-generation from data, no charts, no KPI dashboards — meeting reports are hand-typed, competitor view is a static grid). **Of the 250 named report types, 0 are implemented as named, generated report types.** This is a large, genuinely open backlog item, not something to claim as "mostly done."

## Verdict

This conversation is a **report-generation product specification**, not idle chat — it directly defines what market-research-portal's core "generate a report" feature should eventually cover. Building all 250 report types is out of scope for a single session (250 distinct data-driven documents with charts/KPIs each). The honest next step, if the user wants to act on this, is a `report_type` catalog table (schema entries for all 250 specs, `built_status` per row, same pattern as `module_registry`) so coverage is tracked truthfully as work proceeds, rather than either ignoring the catalog or fabricating report content with no underlying data pipeline. No report should be marked "real" without a genuine data source feeding it — several families (Digital & Social Intelligence, Risk & Opportunity) would need external data (social listening, regulatory feeds) that doesn't exist in this environment yet.
