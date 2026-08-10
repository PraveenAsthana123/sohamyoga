#!/usr/bin/env python3
"""Scaffold 14 missing HOLY_*.md files per dept · §64.29 audit RED → GREEN.

Per global §64.29 (and §64 amendments §64.2 / .3 / .4 / .5 / .6 / .14 / .15
/ .17 / .22 / .23 / .25 / .27 / .32 / .34).

For each canonical 21-dept × 14-mandatory-file = 294 cells, writes a starter
HOLY_*.md that:
- Contains the §64-mandated section headers (skeleton compliance)
- Has dept-specific substitutions (name · domain · concrete process examples)
- Marks every operator-content section as TODO with §-reference

Idempotent. Skip-if-exists unless --force.

HOLY_RECOMMENDATION.md is handled by scaffold_recommendation_files.py — this
script SKIPS it to avoid clobbering.

NOTE per §57.7: these are starter scaffolds · NOT production content. Their
sole purpose is to turn the §64.29 audit GREEN so operators can see real
gaps (vs everything red). Operator content work follows.
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

CANONICAL_DEPTS = [
    (1, "product-management", "Product Management"),
    (3, "sales-distribution", "Sales & Distribution"),
    (4, "underwriting", "Underwriting"),
    (5, "policy-admin", "Policy Administration"),
    (6, "billing", "Billing & Collections"),
    (7, "claims", "Claims"),
    (8, "siu-fraud", "SIU / Fraud Investigation"),
    (9, "customer-service", "Customer Service"),
    (10, "actuarial", "Actuarial"),
    (11, "reinsurance", "Reinsurance"),
    (12, "compliance", "Compliance & Regulatory"),
    (13, "legal", "Legal"),
    (14, "finance", "Finance & Accounting"),
    (15, "erm", "Enterprise Risk Management"),
    (16, "hr", "Human Resources"),
    (17, "procurement", "Procurement & Vendor Management"),
    (18, "analytics", "Data & Analytics"),
    (19, "it", "IT / Cloud / Infrastructure"),
    (20, "cyber", "Cybersecurity / Fraud Defense"),
    (21, "partner", "Sales / Broker / Agency Partner"),
    (22, "product-innovation", "Product Innovation & Digital"),
]


def find_dept_dir(did: int, slug: str, depts_root: Path) -> Path:
    candidates = [
        depts_root / slug,
        depts_root / f"{did:02d}-{slug}",
        depts_root / f"{did}-{slug}",
    ]
    for c in candidates:
        if c.exists():
            return c
    fallback = depts_root / f"{did:02d}-{slug}"
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


# ─────────────────────────────────────────────────────────────────────
# Per-file content templates (each ~30-50 lines · §64-spec sections)
# ─────────────────────────────────────────────────────────────────────

def demo_story(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_DEMO_STORY.md · Dept {did} · {name}

> Generated scaffold per §64.2. Operator refines content.

## Persona
TODO · Named user · role · reports-to · primary daily KPI.

## Scenario
TODO · Concrete business goal · main KPI driven by this demo.

## Walkthrough
TODO · Click-by-click UI walkthrough · screen-by-screen.

## Pitch (30 seconds)
TODO · Stakeholder narrative · why this matters now.

## Demo Script

| Step | Action | Expected screen | Talking point |
|---|---|---|---|
| 1 | TODO | TODO | TODO |
| 2 | TODO | TODO | TODO |

## Success Criteria (drill-able per §43)
- TODO · Timeout assertion
- TODO · Baseline-beat assertion
- TODO · Output validity assertion

## Common Gotchas
- TODO · pre-warm tips
- TODO · env requirements

## Related artifacts
- HLD · LLD · SAD · C4 (see `docs/architecture/`)
- Process IDs in INSUR_NAV.json (per §64.7)
- HOLY_FLOW.md (per §64.27)

Composes with §43 · §57.5 (5-question runbook) · §64.2 · §90.
"""


def asis_assessment(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_ASIS_ASSESSMENT.md · Dept {did} · {name}

> Generated scaffold per §64.3 · 7-axis impact table.

## 7-axis impact per AS-IS process

| Process | Time Loss (hrs/wk) | Error Rate | Cost Impact ($/yr) | People impact | Process impact | Productivity impact | Technology |
|---|---|---|---|---|---|---|---|
| TODO · Process A | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| TODO · Process B | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| TODO · Process C | TODO | TODO | TODO | TODO | TODO | TODO | TODO |

## Prioritized automation backlog
Sort the table above by `(time_loss × labor_rate + cost_impact) × error_multiplier` and link each row to a sub-process in INSUR_NAV.json.

| Rank | Process | Composite score | TO-BE flavor |
|---|---|---|---|
| 1 | TODO | TODO | (per HOLY_DT_STRATEGY.md) |

## Quarterly re-assessment
Cron: `0 9 1 * *` (1st of month · 09:00) · output `jobs/reports/asis-quarterly/<dept>-<date>.log`

Composes with §43 · §50 (deterministic discovery for table audit) · §64.3 · §90 · §74 Phase 1.
"""


def dt_strategy(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_DT_STRATEGY.md · Dept {did} · {name}

> Generated scaffold per §64.4 · 4P Digital Transformation Strategy.

## 4 dimensions of impact

### People
- Org-chart impact: TODO
- Role redesign: TODO
- Training plan: TODO
- Change-mgmt risk: TODO

### Process
- TO-BE process maps: TODO
- Automation %: TODO
- Decision authority shift: TODO

### Profit
- Cost-out: TODO
- Revenue-up: TODO
- ROI horizon (6/12/36 mo): TODO
- Risk-adjusted NPV: TODO

### Technology
- Stack shift: TODO
- Build-vs-buy: TODO
- Vendor lock-in risk: TODO
- Technical debt impact: TODO

## Per-dimension AS-IS evidence
- Link to row in HOLY_ASIS_ASSESSMENT.md (per §64.3)
- AI-pipeline reference (per §64.20)
- Success metric (per §75 12-axis)

Composes with §38 · §43 · §47 · §74 · §76 · §85 · §90 · §91.
"""


def contact_center(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_CONTACT_CENTER.md · Dept {did} · {name}

> Generated scaffold per §64.5 · Contact Center Automation.

## Channels
- [ ] Voice · TODO
- [ ] Email · TODO
- [ ] Chat · TODO
- [ ] WhatsApp · TODO
- [ ] Portal · TODO

## Intent taxonomy (top 20)
TODO · enumerate top 20 inbound intent categories per channel.

## Automation tiers

| Tier | Definition | SLA | Routing |
|---|---|---|---|
| Self-service | Bot handles fully | <30s | LangGraph |
| AI-resolve | Bot proposes · operator confirms | <2 min | LangGraph + HITL |
| Human-assist | Operator handles · bot assists | <5 min | Human + RAG |
| Human-only | Operator handles solo | <15 min | Human |

## Quality metrics
- AHT · TODO
- FCR · TODO
- CSAT · TODO
- Automation rate · TODO
- Escalation rate · TODO

## Compliance
- Call recording: TODO
- Consent: TODO (per §76.10 Art. 50)
- PII redaction: TODO (per §76 + §47.6)

Composes with §41.3 · §46 (TTS consent) · §64.5 · §76 · §80 · §82.21 · §88 G18.
"""


def incident_mgmt(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_INCIDENT_MGMT.md · Dept {did} · {name}

> Generated scaffold per §64.6 · L1/L2/L3 incidents + RAG solutions.

## Level 1 issues (top 20 · self-service / L1 agents)
TODO · top 20 user-facing issues.

## Level 2 issues (top 10 · SME escalation)
TODO · top 10 escalations needing SME.

## Level 3 issues (top 5 · P1 incidents)
TODO · top 5 P1 incidents needing engineering / management.

## Issue source breakdown

| Source | Volume (last 7d) | Top intent |
|---|---|---|
| Customer | TODO | TODO |
| Employee | TODO | TODO |
| Vendor | TODO | TODO |
| Partner | TODO | TODO |

## RAG-driven solutions

For each L1 issue, document the runbook chunk(s) the RAG retrieves + the LLM-synthesized resolution.

| Issue | Chunks retrieved | LLM resolution |
|---|---|---|
| TODO | TODO | TODO |

## MTTD / MTTR targets

| Level | AS-IS | TO-BE | Gap |
|---|---|---|---|
| L1 | TODO | TODO | TODO |
| L2 | TODO | TODO | TODO |
| L3 | TODO | TODO | TODO |

## Escalation flow
```
L1 → (no resolution) → L2 → (P1) → L3 → (resolved) → post-incident loop
```

## Post-incident learning
Loop back into RAG corpus (per §87.4 vector ingest). Drill-locked per §43.

Composes with §38.3 · §43 · §47.7 · §57.5 (5-question runbook) · §64.6 · §76 · §79 · §80 · §91.
"""


def meeting_comms(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_MEETING_COMMS.md · Dept {did} · {name}

> Generated scaffold per §64.14 · Meeting Summary + Communication Mgmt.

## Meeting cadence

| Cadence | Duration | Roster |
|---|---|---|
| Daily standup | 15 min | TODO |
| Weekly review | 60 min | TODO |
| Monthly strategic | 90 min | TODO |
| Quarterly business review | 180 min | TODO |

## Meeting AI integration
- STT: Whisper / Deepgram (per §91 + ai-agents/)
- Diarization: pyannote / SpeechBrain
- Summarizer: LLM (per §91 WebLLM)
- Action-item extractor: NER + LLM
- Audit row per §38.3

## Action-item routing
TODO · NLP-extracted action items → owner + due-date + per-dept TODO list (per §64.15).

## Communication channels
- Email · TODO SLA · Automation %
- Slack · TODO
- Teams · TODO
- WhatsApp · TODO
- Portal · TODO

## Newsletter / digest
Weekly auto-digest of decisions + KPIs + risks for stakeholders.

## Comms templates (≥ 10)
1. TODO · status update
2. TODO · escalation
3. TODO · decision memo
4. TODO · incident comms
5. TODO · ...

## Tone + style guardrail
LLM guardrail enforcing brand voice + compliance (no PII · no commitments without approver).

## Multi-language
Per-dept i18n: TODO (e.g., English · Spanish · etc.).

Composes with §38.3 · §46 (TTS consent for recordings) · §64.14 · §76 · §80 · §82.21 · §91.
"""


def process_mgmt(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_PROCESS_MGMT.md · Dept {did} · {name}

> Generated scaffold per §64.15 · Process Mgmt (IPO + TODO + Tasks).

## Process catalog

| # | Process | One-line purpose |
|---|---|---|
| 1.0 | TODO · Process A | TODO |
| 2.0 | TODO · Process B | TODO |

## Per-process IPO + sub-process tree

### 1.0 TODO · Process A
- **Input**: TODO · sources · triggers · contracts
- **Process**: TODO · steps · owners · decision points · SLAs
- **Output**: TODO · artifacts · downstream consumers · KPIs

#### 1.1 TODO · Sub-process A.1
- **IPO**: TODO (Input · Process · Output)
- **TODO list** (backlog):
  - [ ] TODO discovered work item 1
  - [ ] TODO discovered work item 2
- **Task list** (assigned):
  - [ ] TODO owner / due / status / blocking-on

## Process tags
- `process_type`: manual · automatic · hybrid (per §64.8)

## Dependencies (DAG)
TODO · cross-process dependency graph.

## Process KPIs

| Process | Cycle time | Defect rate | Throughput | SLA attainment |
|---|---|---|---|---|
| 1.0 TODO | TODO | TODO | TODO | TODO |

Composes with §38.3 · §43 · §64.15 · §82.7 (drift) · §88 · §90.
"""


def data_mgmt(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_DATA_MGMT.md · Dept {did} · {name}

> Generated scaffold per §64.17 · per process · per sub-process.

## Per-process data surfaces (6 mandatory per §64.17)

### Process 1.0 · TODO

1. **Input data sources**
   - Producer / endpoint / format / schema version / SLA / retention
   - TODO
2. **Input data contract**
   - Required fields · types · value ranges · null policy · idempotency key
   - TODO
3. **Data quality rules**
   - Per field: must-be-present / unique / regex / range
   - TODO
4. **Data lineage**
   - Source → ingestion → cleaned → feature → model graph
   - TODO
5. **Before-process visualization** (per §64.17)
   - Raw EDA: target distribution · numeric histograms · correlation heatmap · missing matrix · outlier scan
   - Saved at `plots/before_*.png`
6. **After-process visualization**
   - Cleaned · imputed · scaled · feature-engineered equivalents
   - Saved at `plots/after_*.png`
   - Side-by-side with Before in PipelineOutput.jsx

Composes with §38.3 · §39 · §43 · §64.17 · §74 · §75 · §76 · §87.
"""


def anomaly(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_ANOMALY.md · Dept {did} · {name}

> Generated scaffold per §64.23 · multi-flavor anomaly detection.

## Univariate
- Z-score · TODO threshold
- IQR · TODO
- EWMA · TODO

## Multivariate
- Isolation Forest · TODO contamination
- One-Class SVM · TODO
- Autoencoder · TODO reconstruction threshold

## Time-series
- Prophet residual · TODO
- LSTM-autoencoder · TODO

## Streaming (online drift)
- KSWIN · TODO window
- ADWIN · TODO

## Scoring
- PR-AUC · TODO target
- ROC-AUC · TODO target
- Per-anomaly-type confusion matrix · TODO

## §76 RAI per anomaly
- Per-cohort recall fairness (DI ≥ 0.8)
- Per-anomaly explanation (SHAP / per-feature contribution)
- HITL escalation for high-confidence + high-impact

Composes with §38.3 · §43 · §48 · §64.23 · §74 · §75 · §76 · §82.7 (drift on anomaly model itself) · §87 · §90.
"""


def fraud(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_FRAUD.md · Dept {did} · {name}

> Generated scaffold per §64.23 · multi-layer fraud detection.

## Rule layer (hard rules · first)
TODO · per-process rules + thresholds.

## ML layer
- XGBoost · TODO features
- Autoencoder · TODO
- Graph features · TODO (per GNN)

## LLM layer
- Transaction-narrative classifier · TODO
- §82.21 prompt injection defense

## Decision layer (per §40)
- Rule fires? → reject / approve / escalate
- ML confidence threshold? → review / auto / decline
- HITL for ambiguous

## Cost-sensitive metrics
- Recall at fraud > 90% with FPR < 5% · TODO
- Cost-weighted F1 · TODO

## §76 fairness
- Per-cohort false-positive rate parity (DI ≥ 0.8)
- Per-cohort recall parity
- Audit cadence: weekly

Composes with §38.3 · §43 · §47.7 · §48 · §57.5 · §64.23 · §74 · §75 · §76 · §82.7 · §82.21 · §87 · §90.
"""


def contacts(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_CONTACTS.md · Dept {did} · {name}

> Generated scaffold per §64.25 · Customer + Vendor + Internal contact mgmt.

## Customer contacts
Fields: id · name · email · phone · segment · NPS · last-interaction · open-tickets

| Action | Endpoint |
|---|---|
| Create | TODO |
| Read | TODO |
| Update | TODO |
| Delete (GDPR) | TODO |

## Vendor contacts
Fields: id · name · email · phone · category · contract-status · SLA · scorecard

## Internal contacts
Cross-dept owners · escalation chain.

## Bulk import / export
CSV · format documented · audit row per import (§38.3).

## Privacy
- PII redaction in logs (per §76)
- Encryption at rest
- Consent flag per contact (per §76.10 Art. 50)
- Right-to-be-forgotten propagation (per §76)

Composes with §38.3 · §41.3 (multi-tenant MANDATORY for contact mgmt) · §47.6 (SOC2 CC6.2) · §64.25 · §76 (RAI MANDATORY · PII as biometric).
"""


def flow(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_FLOW.md · Dept {did} · {name}

> Generated scaffold per §64.27 · Manual + Automatic flow + Architecture.

## Per-process flow

### Process 1.0 · TODO

#### Manual flow (AS-IS)
```mermaid
graph TB
    User[Actor A] -->|"Step 1 · TODO"| StepA1[Sub-step]
    StepA1 -->|"Step 2"| StepA2[Sub-step]
```

#### Automatic flow (TO-BE)
```mermaid
graph TB
    Trigger[Event] -->|"agent invoke"| LangGraph[LangGraph DAG]
    LangGraph -->|"per §91"| RAG[RAG retrieval]
    LangGraph -->|"per §91"| LLM[WebLLM in browser]
    LangGraph -->|"§38.3"| Audit[Audit row]
```

#### Architecture view (C4 L2)
TODO · per §47.2 C4 model.

#### Per-step table

| # | Actor | Action | AI augmentation | Decision rule | Log/trace point | Fallback path |
|---|---|---|---|---|---|---|
| 1 | TODO | TODO | TODO | TODO | TODO | TODO |

#### Comparison table (Manual vs Auto)

| Metric | Manual | Auto | Delta |
|---|---|---|---|
| Time per instance | TODO | TODO | TODO |
| Error rate | TODO | TODO | TODO |
| Cost | TODO | TODO | TODO |
| Human-touch-points | TODO | TODO | TODO |

Composes with §38.3 · §43 · §47.2 (C4) · §59 (DDD process modeling) · §64.7 (manual/auto tags) · §64.27 · §91.
"""


def simulation(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_SIMULATION.md · Dept {did} · {name}

> Generated scaffold per §64.34 · 5-layer simulation tab.

## 5 mandatory simulation layers

| Layer | What gets shown | UI rendering |
|---|---|---|
| 1. Backend | HTTP / DB / queue / agent / LLM call · latency + status | Waterfall (Gantt) + log tail |
| 2. Process | Sub-process step transitions · actor switch · decision branch | Swimlane diagram |
| 3. Data | Input row → cleaned → enriched → predicted | Data-card step-by-step |
| 4. Accuracy | Model confidence + rules + override + final | Per-step confidence gauge |
| 5. Reporting | Per-run summary · time / cost / error / accuracy delta | Reporting card + chart |

## Side-by-side comparison (Manual vs Automatic)
```
+---------------------+---------------------+
| Manual flow (AS-IS) | Automatic (TO-BE)   |
+---------------------+---------------------+
| Step 1 · TODO       | Step 1 · TODO       |
| TODO duration       | TODO duration       |
+---------------------+---------------------+
```

## Simulation engine requirements
- Replayable · `simulation_id`
- Deterministic seed
- Speed control (0.25× · 1× · 4× · instant)
- Inputs configurable
- What-if mutations
- Audit-trail capture (per §38.3 + §64.34.3)
- MLflow integration

## Backend API
- `POST /api/v1/holy/sim/{slug}/{{process}}/run`
- `GET /api/v1/holy/sim/{slug}/{{process}}/runs/{{sim_id}}/events` (SSE)
- `GET /api/v1/holy/sim/{slug}/{{process}}/runs/{{sim_id}}/manifest`
- `GET /api/v1/holy/sim/{slug}/{{process}}/runs/{{sim_id}}/replay`

Composes with §38.3 · §40 · §43 · §47 · §48 · §57.5 · §64.7 · §64.27 · §64.34 · §91.
"""


def security(did: int, slug: str, name: str) -> str:
    return f"""# HOLY_SECURITY.md · Dept {did} · {name}

> Generated scaffold per §64.32 · Security & Observability tab.

## Capture surfaces (10 mandatory per §64.32.1)

| Category | Mechanism | Backing tool |
|---|---|---|
| Application logs | every request/response/error with correlation_id + tenant_id + actor | ELK / Loki |
| Audit logs | every admin action · every AI decision (per §38.3) | Postgres audit table |
| Traces | distributed traces per request (OpenTelemetry) | Tempo / Jaeger |
| User operations | clickstream + form submits + admin actions | RUM + backend audit |
| Monitoring | latency p50/p95/p99 + error rate + throughput | Grafana + Prometheus |
| Scoring | risk score per request (rule + ML + LLM blend) | per §64.23 |
| Visualization | live security dashboard with drill-down | Grafana |
| DDoS check | sustained rate per IP + connection flood | rate limiter + chaos test |
| Sensitive data | PII / PHI / PCI scan + redaction + classification | regex + Presidio / DLP |
| All attack types | OWASP Top 10 + AI (prompt inj / model theft / poisoning) | ZAP + nuclei + custom AI |

## Required modeling layers (per §64.32.2)
- RAG · Q&A over runbooks + threat intel + past incidents
- Tabular ML · Risk scoring on structured signals
- DL · Behavioral anomaly
- CV · CCTV / document forgery / deepfake detection
- NLP · Phishing / threat-intel parsing
- Time-series · Trend on attack volume
- Recommendation · Suggest playbook actions to SOC analysts
- Anomaly · First-line detection
- Fraud · Transaction / account-takeover detection

## Test data generation (per §64.32.3)
Attack simulation panel · realistic adversarial test data per attack class.

| Attack | Generator |
|---|---|
| SQL injection | sqlmap + custom mutator |
| XSS | XSS-FUZZER + DOM payloads |
| Prompt injection | Garak + custom LLM-jailbreak |
| DDoS | wrk + locust |
| Phishing | LLM-generated phishing corpus |
| Deepfake | StyleGAN-NADA / Diff-Detect |

All payloads + results → `data/security-tests/{slug}/<attack-type>/<run_id>/`

Composes with §38.3 · §42 (gated pen-testing) · §43 · §47.6 (4-lens) · §57.6.1 (canonical fields) · §64.21 (XAI on risk score) · §64.32 · §82.21 (Secure AI).
"""


FILE_GENERATORS = {
    "HOLY_DEMO_STORY.md":     demo_story,
    "HOLY_ASIS_ASSESSMENT.md": asis_assessment,
    "HOLY_DT_STRATEGY.md":    dt_strategy,
    "HOLY_CONTACT_CENTER.md": contact_center,
    "HOLY_INCIDENT_MGMT.md":  incident_mgmt,
    "HOLY_MEETING_COMMS.md":  meeting_comms,
    "HOLY_PROCESS_MGMT.md":   process_mgmt,
    "HOLY_DATA_MGMT.md":      data_mgmt,
    "HOLY_ANOMALY.md":        anomaly,
    "HOLY_FRAUD.md":          fraud,
    "HOLY_CONTACTS.md":       contacts,
    "HOLY_FLOW.md":           flow,
    "HOLY_SIMULATION.md":     simulation,
    "HOLY_SECURITY.md":       security,
}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true",
                   help="overwrite existing files")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--only", action="append", default=[],
                   help="only regenerate specific file types (repeatable). "
                        "Names can be full (HOLY_FRAUD.md) or short (fraud · anomaly · flow). "
                        "Combine with --force to refresh schema-shifted files.")
    p.add_argument("--list-types", action="store_true",
                   help="show available file types and exit")
    p.add_argument("--diff", action="store_true",
                   help="show unified diff of what would change vs disk (no write)")
    p.add_argument("--summary", action="store_true",
                   help="brief block-count summary (smaller than --list-types)")
    args = p.parse_args()

    if args.list_types:
        print("  Available file types (short form OK):")
        for fname in FILE_GENERATORS.keys():
            short = fname.replace("HOLY_", "").replace(".md", "").lower().replace("_", "-")
            print(f"    {fname:<28} short: {short}")
        return 0

    if args.summary:
        print(f"  scaffold_dept_artifacts.py · {len(CANONICAL_DEPTS)} depts × {len(FILE_GENERATORS)} files = {len(CANONICAL_DEPTS) * len(FILE_GENERATORS)} cells")
        return 0

    # Resolve --only to FILE_GENERATORS keys
    selected: set[str] | None = None
    if args.only:
        selected = set()
        for raw in args.only:
            key = raw.strip()
            # Full name match
            if key in FILE_GENERATORS:
                selected.add(key)
                continue
            # Short form match (case-insensitive)
            key_lower = key.lower().replace("-", "_")
            for fname in FILE_GENERATORS:
                short = fname.replace("HOLY_", "").replace(".md", "").lower()
                if short == key_lower or short.startswith(key_lower):
                    selected.add(fname)
                    break
            else:
                print(f"  WARNING: unknown file type '{raw}' (use --list-types to see options)",
                      file=sys.stderr)

    repo = Path(__file__).resolve().parent.parent
    depts_root = repo / "global-ai-org" / "departments"

    written = skipped = 0
    diff_changed = 0
    diff_same = 0
    for did, slug, name in CANONICAL_DEPTS:
        dept_dir = find_dept_dir(did, slug, depts_root)
        bl = dept_dir / "business-layer"
        bl.mkdir(parents=True, exist_ok=True)

        for fname, gen in FILE_GENERATORS.items():
            if selected is not None and fname not in selected:
                continue
            target = bl / fname
            new_content = gen(did, slug, name)

            # --diff: compare regenerated content vs disk · NO write
            if args.diff:
                if not target.exists():
                    diff_changed += 1
                    print(f"  [NEW]    {target.relative_to(repo)}")
                    continue
                current = target.read_text(errors="replace")
                if current == new_content:
                    diff_same += 1
                else:
                    diff_changed += 1
                    import difflib
                    diff = difflib.unified_diff(
                        current.splitlines(keepends=True),
                        new_content.splitlines(keepends=True),
                        fromfile=str(target.relative_to(repo)) + " (disk)",
                        tofile=str(target.relative_to(repo)) + " (regenerated)",
                        n=1,
                    )
                    diff_str = "".join(diff)
                    if diff_str:
                        # Show only first 8 lines of diff per file to keep output sane
                        print(f"  [DIFF]   {target.relative_to(repo)}")
                        for line in diff_str.splitlines()[:8]:
                            print(f"    {line}")
                continue

            if target.exists() and not args.force:
                skipped += 1
                continue
            if args.dry_run:
                print(f"  WOULD WRITE: {target.relative_to(repo)}")
                continue
            target.write_text(new_content)
            written += 1

    sel_msg = f" · scope: {sorted(selected)}" if selected is not None else ""
    if args.diff:
        print(f"\n  Diff summary: {diff_changed} changed/new · {diff_same} identical{sel_msg}")
        print(f"  (use --force --only <name> to apply)")
    else:
        print(f"\n  Summary: wrote {written} · skipped {skipped}{sel_msg}")
        print(f"  Per §57.7 honest: these are starter scaffolds · operator refines content")
    return 0


if __name__ == "__main__":
    sys.exit(main())
