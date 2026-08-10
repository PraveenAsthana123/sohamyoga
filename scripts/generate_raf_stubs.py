#!/usr/bin/env python3
"""generate_raf_stubs.py — drop one stub per Recommender/Anomaly/Fraud scenario.

Per operator 2026-06-08: "for each scenario" — 75 scenarios from
docs/RECOMMENDER_ANOMALY_FRAUD_SCENARIOS.md get a stub directory each with the
same 8-file pattern as §90 (use-case · data-quality · analysis · responsible-ai ·
pipeline checklists + metrics/coverage JSONs + README).

Output: docs/use-cases/raf/<problem>-<modality>-<idx>-<slug>/
Total: 75 dirs × 8 files = 600 files.

Idempotent. --force to overwrite. --dry-run to preview.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ROOT = REPO / "docs" / "use-cases" / "raf"

# 75 scenarios from RECOMMENDER_ANOMALY_FRAUD_SCENARIOS.md
# Format: (problem · modality · id · slug · summary · dept_id)
SCENARIOS = [
    # Recommender · Numerical (8)
    ("R", "N", 1,  "next-best-product-cross-sell",     "Dept 3 Sales · ALS+LGBM ranker",                 3),
    ("R", "N", 2,  "premium-tier-upgrade-rec",         "Dept 4 UW · two-tower NN",                       4),
    ("R", "N", 3,  "repair-shop-recommendation",       "Dept 7 Claims · collab MF",                      7),
    ("R", "N", 4,  "reinsurance-treaty-match",         "Dept 11 Reinsurance · NSGA-II + content",        11),
    ("R", "N", 5,  "investment-allocation-rec",        "Dept 14 Finance · RL DDPG",                      14),
    ("R", "N", 6,  "reserve-tier-recommendation",      "Dept 10 Actuarial · Bayesian rec",               10),
    ("R", "N", 7,  "vendor-payment-terms-rec",         "Dept 17 Procurement · MAB Thompson",             17),
    ("R", "N", 8,  "hitl-adjudicator-rec",             "Dept 7 Claims · skill collab + load bandit",     7),

    # Recommender · Text (8)
    ("R", "T", 1,  "policy-clause-recommender",        "Dept 13 Legal · embed + rerank",                 13),
    ("R", "T", 2,  "regulation-recommender",           "Dept 12 Compliance · DPR + cross-encoder",       12),
    ("R", "T", 3,  "email-template-recommender",       "Dept 3 Sales · template sim",                    3),
    ("R", "T", 4,  "kb-article-rec",                   "Dept 9 CS · BM25 + DPR + rerank",                9),
    ("R", "T", 5,  "complaint-resolution-rec",         "Dept 9 CS · few-shot LLM + RAG",                 9),
    ("R", "T", 6,  "training-content-rec",             "Dept 16 HR · item collab + content embed",       16),
    ("R", "T", 7,  "caselaw-precedent-rec",            "Dept 13 Legal · E5/BGE + rerank",                13),
    ("R", "T", 8,  "prd-clause-recommender",           "Dept 22 Product · LangGraph + RAG",              22),

    # Recommender · Image (7)
    ("R", "I", 1,  "similar-claim-photo-rec",          "Dept 7 Claims · CLIP + vector DB",               7),
    ("R", "I", 2,  "property-photo-benchmark-rec",     "Dept 4 UW · ResNet per-region index",            4),
    ("R", "I", 3,  "vendor-equipment-image-rec",       "Dept 17 Procurement · CLIP + metadata",          17),
    ("R", "I", 4,  "oem-part-image-rec",               "Dept 7 Claims · CLIP + OEM catalog",             7),
    ("R", "I", 5,  "resume-photo-background-rec",      "Dept 16 HR · face-attribute-blind embed",        16),
    ("R", "I", 6,  "doc-template-image-rec",           "Dept 5 Policy Admin · LayoutLMv3 + vector",      5),
    ("R", "I", 7,  "risk-asset-image-rec",             "Dept 15 ERM · ResNet + GIS metadata",            15),

    # Anomaly · Numerical (10)
    ("A", "N", 1,  "gl-journal-anomaly",               "Dept 14 Finance · IsoForest+VAE ensemble",       14),
    ("A", "N", 2,  "premium-pricing-anomaly",          "Dept 4 UW · OC-SVM + Mahalanobis",                4),
    ("A", "N", 3,  "claims-payment-anomaly",           "Dept 7 Claims · robust cov + percentile",        7),
    ("A", "N", 4,  "reserve-volume-anomaly",           "Dept 10 Actuarial · streaming z-score + EWMA",   10),
    ("A", "N", 5,  "loss-ratio-drift-anomaly",         "Dept 11 Reinsurance · TFT residual + SPC",       11),
    ("A", "N", 6,  "capital-position-anomaly",         "Dept 15 ERM · multivariate z-score",             15),
    ("A", "N", 7,  "vendor-spend-anomaly",             "Dept 17 Procurement · Holt-Winters + IsoForest", 17),
    ("A", "N", 8,  "cash-flow-anomaly",                "Dept 14 Finance · Prophet residual + DBSCAN",    14),
    ("A", "N", 9,  "uw-decision-drift",                "Dept 4 UW · KS-test + per-cohort drift",         4),
    ("A", "N", 10, "sensor-telemetry-anomaly",         "Dept 19 IT · LSTM autoencoder",                  19),

    # Anomaly · Text (8)
    ("A", "T", 1,  "complaint-topic-anomaly",          "Dept 18 Analytics · BERTopic new-topic alert",   18),
    ("A", "T", 2,  "email-content-anomaly",            "Dept 9 CS · DistilBERT + embed outlier",         9),
    ("A", "T", 3,  "policy-wording-anomaly",           "Dept 5 Policy Admin · SBERT cosine outlier",     5),
    ("A", "T", 4,  "adjuster-narrative-anomaly",       "Dept 7 Claims · BERT reconstruction",            7),
    ("A", "T", 5,  "regulatory-language-drift",        "Dept 12 Compliance · embed drift",               12),
    ("A", "T", 6,  "contract-deviation-anomaly",       "Dept 13 Legal · LayoutLM + clause outlier",      13),
    ("A", "T", 7,  "sentiment-swing-anomaly",          "Dept 9 CS · sentiment + EWMA",                   9),
    ("A", "T", 8,  "code-review-comment-anomaly",      "Dept 19 IT · embed outlier on PR comments",      19),

    # Anomaly · Image (7)
    ("A", "I", 1,  "cctv-anomaly",                     "Dept 7 Claims · 3D-CNN autoencoder",             7),
    ("A", "I", 2,  "damage-photo-authenticity",        "Dept 8 SIU · ELA+CNN+GAN-detect",                8),
    ("A", "I", 3,  "drone-imagery-anomaly",            "Dept 4 UW · U-Net + baseline diff",              4),
    ("A", "I", 4,  "doc-format-anomaly",               "Dept 5 Policy Admin · LayoutLM + format embed",  5),
    ("A", "I", 5,  "network-topology-anomaly",         "Dept 19 IT · OCR + structure embed",             19),
    ("A", "I", 6,  "satellite-imagery-anomaly",        "Dept 11 Reinsurance · Siamese before/after",     11),
    ("A", "I", 7,  "surveillance-camera-anomaly",      "Dept 20 Cyber · YOLO + window baseline",         20),

    # Fraud · Numerical (10)
    ("F", "N", 1,  "premium-rate-evasion",             "Dept 8 SIU · XGB + adversarial validation",      8),
    ("F", "N", 2,  "soft-fraud-claim-inflation",       "Dept 8 SIU · LightGBM + peer percentile",        8),
    ("F", "N", 3,  "hard-fraud-staged-claim",          "Dept 8 SIU · XGB + class-weight + SMOTE",        8),
    ("F", "N", 4,  "synthetic-identity-fraud",         "Dept 20 Cyber · graph + XGB + GNN",              20),
    ("F", "N", 5,  "agent-book-rolling",               "Dept 21 Sales · behavioral XGB",                 21),
    ("F", "N", 6,  "premium-payment-fraud",            "Dept 6 Billing · streaming GBM + IsoForest",     6),
    ("F", "N", 7,  "claim-shop-collusion",             "Dept 8 SIU · GNN + community detection",         8),
    ("F", "N", 8,  "vendor-invoice-fraud",             "Dept 17 Procurement · XGB + dup-scan + Benford", 17),
    ("F", "N", 9,  "insider-trading-anomaly",          "Dept 14 Finance · LSTM + bandit",                14),
    ("F", "N", 10, "loss-cost-padding",                "Dept 10 Actuarial · hierarchical Bayes",         10),

    # Fraud · Text (8)
    ("F", "T", 1,  "claim-narrative-fraud-signal",     "Dept 8 SIU · BERT + ensemble",                   8),
    ("F", "T", 2,  "phishing-email-detect",            "Dept 20 Cyber · DistilBERT + URL features",      20),
    ("F", "T", 3,  "complaint-fraud-cluster",          "Dept 8 SIU · BERTopic + cluster anomaly",        8),
    ("F", "T", 4,  "vendor-form-fraud",                "Dept 17 Procurement · LayoutLM + handwriting",   17),
    ("F", "T", 5,  "resume-fraud-detection",           "Dept 16 HR · BERT + entity match + RAG",         16),
    ("F", "T", 6,  "compliance-report-fraud",          "Dept 12 Compliance · attention + RAG verify",    12),
    ("F", "T", 7,  "chat-fraud-account-takeover",      "Dept 20 Cyber · stylometric + few-shot LLM",     20),
    ("F", "T", 8,  "phone-script-fraud",               "Dept 9 CS · Whisper + BERT + sentiment",         9),

    # Fraud · Image (9)
    ("F", "I", 1,  "photo-tampering-detection",        "Dept 8 SIU · ELA-CNN + GAN-detect",              8),
    ("F", "I", 2,  "fake-document-detection",          "Dept 5 Policy Admin · LayoutLM + tamper-CNN",    5),
    ("F", "I", 3,  "deepfake-video-detection",         "Dept 8 SIU · Faceforensics++ + temporal CNN",    8),
    ("F", "I", 4,  "fake-id-detection",                "Dept 21 Sales · OCR + liveness + KYC RAG",       21),
    ("F", "I", 5,  "receipt-fraud-detection",          "Dept 17 Procurement · TrOCR + hash + tamper-CNN", 17),
    ("F", "I", 6,  "damage-photo-manipulation",        "Dept 7 Claims · ResNet + manipulation cls",      7),
    ("F", "I", 7,  "drone-imagery-fraud",              "Dept 11 Reinsurance · Siamese + EXIF cross-check", 11),
    ("F", "I", 8,  "surveillance-evidence-fraud",      "Dept 20 Cyber · temporal CNN + chain-hash",      20),
    ("F", "I", 9,  "handwriting-forgery",              "Dept 13 Legal · Siamese signature",              13),
]


PROBLEM_NAME = {"R": "Recommender", "A": "Anomaly", "F": "Fraud"}
MODALITY_NAME = {"N": "Numerical", "T": "Text", "I": "Image"}


def stub_md(problem: str, modality: str, idx: int, slug: str, summary: str, dept_id: int) -> str:
    pmodal = f"{PROBLEM_NAME[problem]} · {MODALITY_NAME[modality]}"
    upper_slug = slug.upper().replace("-", "_")
    return f"""# {PROBLEM_NAME[problem]}-{MODALITY_NAME[modality]}-{idx} · {slug}

> **Problem** · {PROBLEM_NAME[problem]}
> **Modality** · {MODALITY_NAME[modality]}
> **Dept** · {dept_id}
> **Status** · stub (operator fills sections)
> Per §90 + docs/RECOMMENDER_ANOMALY_FRAUD_SCENARIOS.md

## 1. Use case

{summary}

**Business value**: TODO
**KPI moved**: TODO

## 2. Architecture (G13 diagram + key modules)

```mermaid
graph LR
    Input["{MODALITY_NAME[modality]} Input"] --> Preprocess[G1-G5 preprocessing]
    Preprocess --> Feature[G4 feature eng]
    Feature --> Model[Model · {problem}-specific]
    Model --> Decision[Decision policy]
    Decision --> Audit[§38.3 audit row]
    Decision --> Output[Output · streaming / sync / batch per G16]
    Audit --> VectorDB[Vector DB · cron per §87.4]
```

Key modules: TODO

## 3. Data source + download

| Source | Format | Volume | Download |
|---|---|---|---|
| TODO | TODO | TODO | per `scripts/download_kaggle_datasets.sh` if applicable |

## 4. Planning

| Week | Activity | Owner |
|---|---|---|
| 1 | Data quality (G1-G6) | data-quality-test-agent |
| 2 | Baseline model | model-evaluation-test-agent |
| 3 | HP sweep (§5) | model-evaluation-test-agent |
| 4 | Fairness + ResAI (G10) | council-governance-review-agent |
| 5 | Shadow deploy 5% | load-performance-test-agent |
| 6 | Canary 25%→100% | quality-gate-agent |

## 5. Hyperparameter tuning

- Algorithm: Optuna TPE / BayesianOpt (operator picks)
- Budget: TODO trials
- Search space: TODO
- Objective: TODO weighted composite per §77
- Early stop: TODO

## 6. Noise handling

- Label noise: TODO
- Outliers: TODO
- Missing data: TODO
- Class imbalance (G3 SMOTE): TODO
- Adversarial (G14 edge case): TODO

## 7. Job scheduling

| Cron tag | Schedule | Purpose | DB writes |
|---|---|---|---|
| `INSUR-{upper_slug}-INFERENCE` | per request OR `*/5 * * * *` | run model | predictions table |
| `INSUR-{upper_slug}-DRIFT-CHECK` | hourly | PSI / KS drift | drift_metrics |
| `INSUR-{upper_slug}-RETRAIN` | `0 3 * * 1` | weekly retrain | MLflow run |
| `INSUR-{upper_slug}-VECTOR-INGEST` | `*/15 * * * *` | embed → vector DB | vector_db |
| `INSUR-{upper_slug}-HITL-AUDIT` | `0 9 * * *` | sample overrides | hitl_audit |
| `INSUR-{upper_slug}-FAIRNESS-AUDIT` | `0 9 * * 1` | per-cohort metrics | fairness_audit |

## 8. Top 1% production gates

- ✓ Drift PSI > 0.2 → block deploy (§82.7)
- ✓ Fairness DI ≥ 0.8 across protected groups (§76)
- ✓ Explainability per prediction (§48 · G11)
- ✓ Uncertainty surfaced (§75.5)
- ✓ Shadow + canary 5%→25%→100% (§47.10)
- ✓ Model card mandatory (§48.3 EU AI Act Art. 86)
- ✓ Counterfactual per regulated (§48.7)
- ✓ Rollback via MLflow registry (§47.7)

## 9. Composing § references

§38.3 · §43 · §47 · §48 · §74 · §75 · §76 · §82.19/.20/.21 · §83 · §87 · §88 · §90.

## 10. Insurance-domain mapping

- Dept {dept_id} · Process: TODO
- Sub-process: TODO
- Downstream consumers: TODO

---

# Mandatory sub-blocks G1-G18 (per §90.3)

## G1. Data preprocessing pipeline
See `data-quality-checklist.md` sections 1-5.

## G2. EDA
See `data-quality-checklist.md` section 6.

## G3. Class balance + SMOTE
See `data-quality-checklist.md` section 7.

## G4. Feature engineering + selection
See `data-quality-checklist.md` section 8.

## G5. Data cleaning
See `data-quality-checklist.md` section 9.

## G6. Data scoring + quality
See `data-quality-checklist.md` section 10.

## G7. Statistical analysis
See `analysis-checklist.md` section 1.

## G8. Subjective analysis
See `analysis-checklist.md` section 2.

## G9. Sensitivity analysis
See `analysis-checklist.md` section 3.

## G10. ResAI (5 pillars per §76)
See `responsible-ai-checklist.md` sections 1-5.

## G11. ExpAI (per §48 + §82.20)
See `responsible-ai-checklist.md` sections 6-9.

## G12. Data → DB → Vector DB pipeline
See `pipeline-checklist.md`.

## G13. Architecture diagram
Mermaid in section 2 above + extended detail in `pipeline-checklist.md`.

## G14. Edge case enumeration
- TODO empty input
- TODO out-of-distribution
- TODO adversarial perturbation
- TODO regulatory restriction
- TODO PII in unexpected field
- TODO demographic edge group

## G15. Pipeline catalog (13 pipelines)
See `pipeline-checklist.md` for full table (ingestion · cleaning · feature · training · evaluation · deployment · sync inference · batch inference · stream inference · audit ingest · vector ingest · drift check · retrain trigger).

## G16. Inference modes (mandatory · 3 modes)
- Sync (request-response): TODO p95 < 500ms · FastAPI + Triton/vLLM/MLflow
- Batch (scheduled): TODO Celery + worker pool
- Stream (event-driven): TODO Faust / Flink / Spark streaming

## G17. Workflow tool
Choose ≥1: Temporal / LangGraph / n8n / Airflow / Argo / Celery+Beat / Step Functions / Prefect.

## G18. Communication channels
For user-facing: TODO Email / SMS / Push / Voice / Chat · with ResAI consent + opt-out + accessibility (§46 + §76).

---

## Definition of done (per §90.9)

- [ ] All 28 subsections (10 top-level + G1-G18) have non-TODO content
- [ ] Data downloaded
- [ ] DB tables exist (raw/clean/features/predictions)
- [ ] Vector ingest cron installed (§87.4 + §90.5)
- [ ] §47.6 + §76 + §88 audits pass
- [ ] §48 XAI artifacts exist
- [ ] §83 subject-level bootstrap CI
- [ ] Drift cron active

## Composes with

- [`../../../RECOMMENDER_ANOMALY_FRAUD_SCENARIOS.md`](../../../RECOMMENDER_ANOMALY_FRAUD_SCENARIOS.md) — full 75-scenario catalog
- [`../../../AI_USE_CASES_TOP_1_PERCENT.md`](../../../AI_USE_CASES_TOP_1_PERCENT.md) — 58-scenario master catalog
- §90 of `~/.claude/CLAUDE.md`
"""


def slugify(s: str) -> str:
    import re
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--only", action="append", default=[],
                   help="filter by problem (R/A/F) · modality (N/T/I) · combined (RN/RT/RI etc.) "
                        "or slug. Repeatable. Combine with --force to refresh.")
    p.add_argument("--list", action="store_true",
                   help="list all scenarios grouped by problem×modality and exit")
    p.add_argument("--summary", action="store_true",
                   help="brief problem×modality count")
    args = p.parse_args()

    if args.list:
        from collections import Counter
        groups: dict[tuple[str, str], list] = {}
        for problem, modality, idx, slug, summary, dept_id in SCENARIOS:
            groups.setdefault((problem, modality), []).append((idx, slug, dept_id))
        counts = Counter()
        for (problem, modality), items in sorted(groups.items()):
            label = f"{PROBLEM_NAME[problem]} × {MODALITY_NAME[modality]}"
            print(f"  {label} ({len(items)}):")
            for idx, slug, dept_id in items:
                print(f"    {problem.lower()}-{modality.lower()}-{idx:02d}-{slug:<35} dept={dept_id}")
            counts[problem] += len(items)
        print(f"\n  total: {len(SCENARIOS)} scenarios · {dict(counts)}")
        return 0

    if args.summary:
        from collections import Counter
        counts: dict[tuple[str, str], int] = Counter()
        for problem, modality, idx, slug, summary, dept_id in SCENARIOS:
            counts[(problem, modality)] += 1
        print(f"  RAF summary · 3 problems × 3 modalities:")
        for (problem, modality), count in sorted(counts.items()):
            print(f"    {PROBLEM_NAME[problem]} × {MODALITY_NAME[modality]:<10} · {count}")
        print(f"  total: {len(SCENARIOS)} scenarios")
        return 0

    only_match: list[str] = []
    if args.only:
        only_match = [t.lower() for t in args.only]
        print(f"  --only filter: {only_match}")

    ROOT.mkdir(parents=True, exist_ok=True)
    written = skipped = 0
    count = 0

    for problem, modality, idx, slug, summary, dept_id in SCENARIOS:
        # Apply --only filter
        if only_match:
            p_lower = problem.lower()
            m_lower = modality.lower()
            pm = f"{p_lower}{m_lower}"  # e.g., "rn" "an" "fi"
            pmd = f"{p_lower}-{m_lower}"  # e.g., "r-n" "a-i"
            slug_lower = slug.lower()
            dir_lower = f"{p_lower}-{m_lower}-{idx:02d}-{slug_lower}"
            if not any(t == p_lower or t == m_lower or t == pm or t == pmd or
                       t == slug_lower or t == dir_lower or
                       slug_lower.startswith(t)
                       for t in only_match):
                continue

        count += 1
        if args.limit and count > args.limit:
            break

        dirname = f"{problem.lower()}-{modality.lower()}-{idx:02d}-{slug}"
        dest = ROOT / dirname
        if dest.exists() and not args.force:
            skipped += 1
            continue

        if args.dry_run:
            print(f"  WOULD CREATE: docs/use-cases/raf/{dirname}/")
            continue

        dest.mkdir(parents=True, exist_ok=True)

        # use-case.md
        (dest / "use-case.md").write_text(stub_md(problem, modality, idx, slug, summary, dept_id))

        upper_slug = slug.upper().replace("-", "_")

        # data-quality-checklist.md
        (dest / "data-quality-checklist.md").write_text(f"""# Data Quality Checklist · {slug}

> §90 G1-G6 · per {PROBLEM_NAME[problem]}-{MODALITY_NAME[modality]} scenario.

## 1. Schema detection
TODO

## 2. Structure tag (per col)
TODO

## 3. Missing value scan
`missingno.matrix()` + `missingno.bar()` PNGs → `plots/missing_*.png`

## 4. Outlier detection
IQR + Z-score + IsolationForest → `plots/box_*.png`

## 5. Distribution analysis
Mean · median · std · skew · kurtosis · KDE per col

## 6. EDA (G2)
- [ ] pandas-profiling / ydata-profiling → `reports/eda_profile.html`
- [ ] Correlation heatmap → `plots/correlation_heatmap.png`
- [ ] Categorical cardinality bars
- [ ] Box + violin per numeric col
- [ ] (if time-series) seasonal_decompose

## 7. Class balance + SMOTE (G3)
- [ ] Class count
- [ ] Imbalance ratio (flag IR > 5)
- [ ] SMOTE vs ADASYN vs class_weight vs undersample decision
- [ ] Validation: ROC + PR-AUC balanced vs imbalanced

## 8. Feature engineering + selection (G4)
- [ ] Numeric scaling
- [ ] Categorical encoding
- [ ] Mutual information ranking
- [ ] Pearson correlation
- [ ] VarianceThreshold
- [ ] RFECV
- [ ] L1-Lasso
- [ ] Tree feature_importances
- [ ] SHAP-based post-hoc

## 9. Data cleaning (G5)
- [ ] Duplicate
- [ ] Typo / fuzzy
- [ ] Format normalize
- [ ] Date parse + validate
- [ ] Unit convert
- [ ] PII redact (§76)
- [ ] Controlled vocabulary

## 10. Data scoring + quality (G6)

| Metric | Threshold | Current | Pass? |
|---|---|---|---|
| Completeness | ≥ 95% | TODO | ☐ |
| Uniqueness (PK) | = 1.0 | TODO | ☐ |
| Validity | ≥ 99% | TODO | ☐ |
| Consistency | < 1% | TODO | ☐ |
| Timeliness | < 24h | TODO | ☐ |
| Accuracy | ≥ 95% | TODO | ☐ |
| **Composite quality** | **≥ 0.85** | TODO | ☐ |
""")

        # analysis-checklist.md
        (dest / "analysis-checklist.md").write_text(f"""# Analysis Checklist · {slug}

> §90 G7-G9.

## 1. Statistical (G7)
- [ ] Pre-registered hypotheses
- [ ] Effect size (Cohen's d / Cliff's δ / ΔF1 / ΔAUC)
- [ ] **95% CI subject-level bootstrap**
- [ ] Paired (McNemar / DeLong / paired-bootstrap)
- [ ] CV stats
- [ ] Multi-comp correction (Holm / BH-FDR)
- [ ] Nonparametric (Wilcoxon / permutation)
- [ ] Rare-event (sensitivity @ FAR · precision @ recall floor)
- [ ] Calibration (ECE · Brier · reliability)
- [ ] Subgroup disparity
- [ ] Robustness significance
- [ ] Model ranking stability
- [ ] Power / sample adequacy

## 2. Subjective (G8)
- [ ] Operator NPS · ≥ 50
- [ ] A/B preference · ≥ 200
- [ ] Word cloud
- [ ] BERTopic themes
- [ ] Quote curation

## 3. Sensitivity (G9)
- [ ] OAT perturbation (±10%)
- [ ] Sobol indices
- [ ] Counterfactual (DiCE / Alibi)
- [ ] Adversarial (FGSM/PGD for CV · TextFooler for NLP)
- [ ] Drift simulation
- [ ] HP sensitivity
""")

        # responsible-ai-checklist.md
        (dest / "responsible-ai-checklist.md").write_text(f"""# Responsible AI Checklist · {slug}

> §90 G10-G11.

## G10 · ResAI 5 pillars (§76)

### 1. Privacy
- [ ] DLP scan
- [ ] PII redaction
- [ ] CMEK at rest
- [ ] No PII in vector DB
- [ ] Retention class
- [ ] Right-to-be-forgotten

### 2. Transparency
- [ ] Data sources documented
- [ ] Model card (§48.3 EU AI Act Art. 86)
- [ ] User-facing disclosure (§76.10 Art. 50)
- [ ] Limitations
- [ ] Last review date

### 3. Robustness
- [ ] Adversarial audit (G9)
- [ ] OOD detection
- [ ] Fallback path
- [ ] Latency p99 (§47.10)
- [ ] Drift monitor (§82.7)

### 4. Safety
- [ ] Kill switch
- [ ] HITL escalation
- [ ] Safety classifier (§76.7 hallucination defense)
- [ ] Incident playbook (§57.5)
- [ ] On-call rotation

### 5. Accountability
- [ ] Named owner (RACI)
- [ ] §38.3 audit per prediction
- [ ] Dispute mechanism
- [ ] Override log
- [ ] Council review (§38 + §88)

## G11 · ExpAI (§48 + §82.20)

- [ ] SHAP global · `plots/shap_global.png`
- [ ] SHAP local · per regulated decision (§48.7) · `data/shap_local/`
- [ ] LIME local (alternative)
- [ ] Integrated Gradients (deep model)
- [ ] Grad-CAM (CV model)
- [ ] Attention maps (transformer w/ §48.2 caveat)
- [ ] Counterfactual · MANDATORY for regulated · `data/cf/`
- [ ] Anchors (Ribeiro)
- [ ] Surrogate decision tree
- [ ] Citation tracing (for RAG) · `data/citations/`
""")

        # pipeline-checklist.md
        (dest / "pipeline-checklist.md").write_text(f"""# Pipeline Checklist · {slug}

> §90 G12 + G15 + G16 + G17.

## Storage layers (G12)

| Stage | Storage | Table |
|---|---|---|
| Raw | Postgres | `{slug.replace('-', '_')}_raw` |
| Cleaned | Postgres | `{slug.replace('-', '_')}_clean` |
| Features | Feast / Postgres | `{slug.replace('-', '_')}_features` |
| Predictions | Postgres | `{slug.replace('-', '_')}_predictions` |
| Embeddings | Vector DB | source = predictions |
| Audit | Postgres | `audit_rows` (§38.3) |
| Models | MLflow | registry |
| Explanations | S3/MinIO | `/explanations/{slug}/` |

## 13 mandatory pipelines (G15)

| # | Pipeline | Trigger | SLA |
|---|---|---|---|
| 1 | Ingestion | webhook / cron / stream | < 1 min |
| 2 | Cleaning | post-ingestion | < 5 min |
| 3 | Feature engineering | post-cleaning | < 5 min |
| 4 | Training | weekly OR drift | < 4 hr |
| 5 | Evaluation | post-training | < 30 min |
| 6 | Deployment | post-eval | < 15 min |
| 7 | Inference sync | per request | < 500 ms |
| 8 | Inference batch | scheduled | < 30 min / 1M |
| 9 | Inference stream | event | < 1 sec |
| 10 | Audit ingest | post-inference | < 5 sec |
| 11 | Vector ingest | post-audit | < 15 min |
| 12 | Drift check | hourly | < 5 min |
| 13 | Retrain trigger | drift OR scheduled | < 15 min |

## 3 inference modes (G16 · all 3 MANDATORY)

| Mode | When | Stack |
|---|---|---|
| Sync | UI-driven · per request | FastAPI + Triton/vLLM/MLflow |
| Batch | nightly / bulk | Celery + worker pool |
| Stream | Kafka / Pub-Sub | Faust / Flink / Spark streaming |

## Workflow tool (G17 · choose ≥1)

- [ ] Temporal (durable long-running)
- [ ] LangGraph (LLM agent DAGs)
- [ ] n8n (no-code SaaS integrations)
- [ ] Airflow (ETL · batch)
- [ ] Argo Workflows (k8s-native)
- [ ] Celery + Beat (Python tasks)
- [ ] Step Functions (AWS-native)
- [ ] Prefect (Python-first)

## Per-prediction artifact contract

Per §87 + §90 · every prediction writes:
1. Input → `{slug.replace('-', '_')}_raw` (redacted)
2. Process trace → OTel span tree
3. Output → `{slug.replace('-', '_')}_predictions`
4. Log → ELK / Loki
5. Trace → Jaeger / Tempo
6. Prompt (if LLM) → `data/prompts.db` (§21)
7. Embedding → Vector DB via cron
8. Explanation → S3/MinIO
9. Audit row → `audit_rows` (16-field §57.6.1)
10. Model card check → MLflow

## Definition of done

- [ ] All 8 storage layers populated for first sample
- [ ] All 13 pipelines + 3 inference modes operational
- [ ] Workflow tool chosen + deployed
- [ ] Vector DB has ≥ 1 row per prediction within 15 min
- [ ] Audit row has all 16 §57.6.1 fields
- [ ] Drift cron producing JSON output
""")

        # evaluation-metrics.json
        (dest / "evaluation-metrics.json").write_text(json.dumps({
            "scenario_id": f"{problem}-{modality}-{idx}",
            "slug": slug,
            "problem": PROBLEM_NAME[problem],
            "modality": MODALITY_NAME[modality],
            "dept_id": dept_id,
            "12_axis_per_75": {
                axis: {"target": None, "current": None, "status": "todo"}
                for axis in [
                    "performance", "subject_wise", "cross_validation", "model", "feature",
                    "robustness", "generalization", "reliability", "interpretability",
                    "computational", "comparative", "statistical"
                ]
            },
            "composite_score": {"formula": "per §77", "current": None, "target": None}
        }, indent=2))

        # testing-coverage.json
        (dest / "testing-coverage.json").write_text(json.dumps({
            "scenario_id": f"{problem}-{modality}-{idx}",
            "slug": slug,
            "ten_agents_per_88": {
                agent: {"owns": owns, "tests_run": [], "status": "todo"}
                for agent, owns in [
                    ("quality-gate-agent",              "default health gate"),
                    ("sast-code-quality-agent",         "SonarQube + Semgrep + Ruff + ESLint + Gitleaks + Trivy"),
                    ("api-contract-test-agent",         "API contract · route · schema · auth · OpenAPI · negative"),
                    ("frontend-browser-test-agent",     "Playwright · Axe · F12 console + network"),
                    ("load-performance-test-agent",     "k6 · Locust · 1000-request · latency · throughput"),
                    ("data-quality-test-agent",         "Great Expectations · Soda · dbt · KPI lineage"),
                    ("database-test-agent",             "migration · SQL · pgTAP · pgbench"),
                    ("model-evaluation-test-agent",     "MLflow · sklearn · RAGAS · DeepEval · SHAP · Fairlearn · Detoxify"),
                    ("reporting-notification-agent",    "MD + JSON reports · evidence · routing"),
                    ("council-governance-review-agent", "P0/P1 review · weekly full gate · promotion signoff"),
                ]
            }
        }, indent=2))

        # README
        (dest / "README.md").write_text(f"""# {problem}-{modality}-{idx} · {slug}

**{PROBLEM_NAME[problem]} · {MODALITY_NAME[modality]}** · Dept {dept_id}

{summary}

## Files in this stub

| File | Purpose |
|---|---|
| `use-case.md` | 28-subsection master spec (per §90.3) |
| `data-quality-checklist.md` | G1-G6 (preprocessing · EDA · SMOTE · feature eng · cleaning · quality) |
| `analysis-checklist.md` | G7-G9 (statistical · subjective · sensitivity) |
| `responsible-ai-checklist.md` | G10-G11 (ResAI · ExpAI) |
| `pipeline-checklist.md` | G12 + G15-G17 (DB + vector + pipelines + inference modes + workflow) |
| `evaluation-metrics.json` | §75 12-axis matrix |
| `testing-coverage.json` | §88 10 agents |

## Composes with

[`../../../RECOMMENDER_ANOMALY_FRAUD_SCENARIOS.md`](../../../RECOMMENDER_ANOMALY_FRAUD_SCENARIOS.md) — full 75-scenario catalog
""")
        written += 1

    print(f"\nGenerated: {written} RAF stubs · {skipped} skipped")
    print(f"Root: {ROOT.relative_to(REPO)}")
    print(f"Total files: {written * 7}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
