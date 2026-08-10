#!/usr/bin/env python3
"""generate_use_case_stubs.py — drop 48 per-use-case stub directories under docs/use-cases/.

Per global §90 + operator instruction 2026-06-08. Each stub contains:
- use-case.md (22-subsection template per §90.3)
- README.md (entry point with composing §-refs)
- data-quality-checklist.md (G1-G6 subsections)
- analysis-checklist.md (G7-G9 subsections)
- responsible-ai-checklist.md (G10-G11 subsections)
- pipeline-checklist.md (G12 subsections)
- evaluation-metrics.json (per §75 12-axis matrix)
- testing-coverage.json (per §88 10 agents × 9 areas)

Output: docs/use-cases/<block>-<id>-<slug>/
Total: 48 directories × 8 files = 384 files.

Idempotent. --force to overwrite. --dry-run to preview.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ROOT = REPO / "docs" / "use-cases"

# 48 use cases from §90.2 (matches the catalog Blocks A-F)
USE_CASES = [
    # Block A · Zero-coverage gaps (5)
    ("A1", "deep-learning-photo-triage", "Dept 7 Claims · CNN damage class", 7),
    ("A2", "cv-classification-property-risk", "Dept 4 Underwriting · ResNet 7-class risk", 4),
    ("A3", "gan-synthetic-fraud-augmentation", "Dept 8 SIU · CTGAN augments rare fraud", 8),
    ("A4", "vae-network-anomaly", "Dept 20 Cyber · VAE reconstruction anomaly", 20),
    ("A5", "content-based-policy-recommender", "Dept 3 Sales · attribute-similarity rec", 3),

    # Block B · Low-coverage gaps (5)
    ("B1", "cv-segmentation-roof-damage", "Dept 7 Claims · U-Net per-pixel mask", 7),
    ("B2", "collaborative-agent-skill-routing", "Dept 9 CS · ALS skill match", 9),
    ("B3", "anomaly-accounting-journal", "Dept 14 Finance · IsoForest+VAE ensemble", 14),
    ("B4", "claims-total-loss-determination", "Dept 7 Claims · hybrid XGB+CNN", 7),
    ("B5", "underwriting-ft-transformer-uncertainty", "Dept 4 UW · FT-Transformer + MC-Dropout", 4),

    # Block C · Architecture explicit (5)
    ("C1", "cnn-1d-audio-call-fnol", "Dept 7 Claims · 1-D CNN on call audio", 7),
    ("C2", "transformer-long-doc-policy-clause", "Dept 13 Legal · Longformer clause class", 13),
    ("C3", "lstm-payment-failure-sequence", "Dept 6 Billing · Bi-LSTM churn risk", 6),
    ("C4", "tft-catastrophe-loss-forecast", "Dept 11 Reinsurance · TFT quantile forecast", 11),
    ("C5", "autoencoder-customer-feature-compression", "Dept 18 Analytics · 800→32 AE", 18),

    # Block D · Missing scenarios (18)
    ("D1", "rl-treaty-allocation-ppo", "Dept 11 Reinsurance · PPO optimal allocation", 11),
    ("D2", "gnn-fraud-ring-detection", "Dept 8 SIU · GraphSAGE on entity graph", 8),
    ("D3", "causal-pricing-uplift-econml", "Dept 4 UW · CATE for premium elasticity", 4),
    ("D4", "federated-cross-tenant-fraud", "Cross-tenant · FedAvg w/ DP", 8),
    ("D5", "survival-time-to-claim-reactivation", "Dept 11 Reinsurance · DeepSurv", 11),
    ("D6", "self-supervised-customer-embedding", "All depts · SimCLR contrastive pretrain", 18),
    ("D7", "active-learning-adjudication", "Dept 7 Claims · uncertainty sampling", 7),
    ("D8", "knowledge-graph-regulation-reasoner", "Dept 13 Legal · Neo4j + GNN + rules", 13),
    ("D9", "multimodal-accident-report-clip", "Dept 7 Claims · vision+text CLIP fusion", 7),
    ("D10", "speech-bilingual-stt-tts", "Dept 9 CS · Whisper + Coqui-TTS", 9),
    ("D11", "vector-similar-claim-retrieval", "All depts · pgvector cosine top-K", 7),
    ("D12", "reranker-regulation-search", "Dept 12 Compliance · cross-encoder rerank", 12),
    ("D13", "topic-drift-customer-complaints", "Dept 18 Analytics · BERTopic", 18),
    ("D14", "time-series-dl-revenue-forecast", "Dept 14 Finance · N-BEATS + DeepAR", 14),
    ("D15", "counterfactual-denial-explanation", "Dept 4 UW · DiCE counterfactual", 4),
    ("D16", "deep-ocr-handwriting-policy", "Dept 5 Policy Admin · TrOCR", 5),
    ("D17", "nlu-intent-classification-routing", "Dept 9 CS · DistilBERT 50-class", 9),
    ("D18", "explainability-as-service", "All depts · SHAP/LIME/IG/Captum service", 18),

    # Block E · Stacked additions (10)
    ("E1", "rlhf-chatbot-tuning", "Dept 9 CS · RLHF on agent preferences", 9),
    ("E2", "statistical-ai-hypothesis-engine", "Dept 10 Actuarial · t-test/KS/Anderson", 10),
    ("E3", "probability-ai-bayesian-loss-cost", "Dept 4 UW · PyMC hierarchical Bayes", 4),
    ("E4", "conformal-prediction-uncertainty", "Dept 4 UW · distribution-free CI", 4),
    ("E5", "mixture-density-network-cat-loss", "Dept 11 Reinsurance · MDN multi-modal", 11),
    ("E6", "bayesian-optimization-hp-search", "All depts · Optuna BO + Ax", 18),
    ("E7", "neural-ode-irregular-time-series", "Health/Life dept · latent ODE", 16),
    ("E8", "adversarial-robustness-evaluator", "Cyber + CV · FGSM/PGD audit", 20),
    ("E9", "active-inference-pomdp-adjudication", "Dept 7 Claims · belief-state RL", 7),
    ("E10", "mpc-portfolio-optimal-control", "Dept 14 Finance · MPC + LSTM forecast", 14),

    # Block F · Hybrid combinations (5)
    ("F1", "hybrid-ml-rag-claim-adjudication", "Dept 7 Claims · XGB + Chroma + LLM", 7),
    ("F2", "hybrid-dl-rag-damage-photo-repair", "Dept 7 Claims · CNN + OEM manual RAG", 7),
    ("F3", "hybrid-cv-rag-roof-cost", "Dept 7 Claims · U-Net + regional cost RAG", 7),
    ("F4", "hybrid-ml-cv-nlp-rag-multimodal", "Dept 7 Claims · full multimodal assistant", 7),
    ("F5", "hybrid-agentic-rag-mcp-workflow", "Dept 7 Claims · §64.40 10-layer + Temporal", 7),
]


USE_CASE_MD_TEMPLATE = """# Use Case · {name}

> **Block** · {block} · **Dept** · {dept_id} · **Status** · stub (operator fills sections)
> Generated from §90 catalog. Edit this file in-place.

## 1. Use case

{summary}

**Business value**: TODO (e.g. reduce AHT by 60% · improve CSAT by 15 pp · reduce fraud loss $X/yr)

**KPI moved**: TODO

## 2. Architecture

```
TODO · block diagram
Input  →  Preprocess  →  Model  →  Decision policy  →  Audit row
                                            ↓
                                  HITL (when uncertain)
```

Key modules: TODO

## 3. Data source + download

| Source | Format | Volume | Download command |
|---|---|---|---|
| TODO | TODO | TODO | `bash scripts/download_kaggle_datasets.sh # already covered if applicable` |

## 4. Planning

| Week | Activity | Owner |
|---|---|---|
| 1 | Data quality pass (per §74 Phase 2 + G1-G6) | data-quality-test-agent |
| 2 | Baseline model (per §75 12-axis) | model-evaluation-test-agent |
| 3 | Hyperparameter sweep (§5) | model-evaluation-test-agent |
| 4 | Fairness + ResAI (§76 + G10) | council-governance-review-agent |
| 5 | Shadow deploy 5% (per §47.10) | load-performance-test-agent |
| 6 | Canary 25% → 100% with §38 audit | quality-gate-agent |

## 5. Hyperparameter tuning

- **Algorithm**: Optuna TPE / BayesianOpt / Hyperband (operator picks)
- **Budget**: TODO trials · TODO h GPU
- **Search space**: TODO
- **Objective**: TODO (weighted composite)
- **Early stopping**: TODO

## 6. Noise handling

- Label noise: TODO
- Outliers: TODO
- Missing data: TODO
- Class imbalance: TODO (per G3 below)
- Adversarial: TODO

## 7. Job scheduling

| Cron tag | Schedule | Purpose | DB writes |
|---|---|---|---|
| `INSUR-{slug_upper}-INFERENCE` | per request OR `*/5 * * * *` | run model | predictions table |
| `INSUR-{slug_upper}-DRIFT-CHECK` | hourly | PSI / KS drift | drift_metrics |
| `INSUR-{slug_upper}-RETRAIN` | `0 3 * * 1` | weekly retrain | MLflow run |
| `INSUR-{slug_upper}-VECTOR-INGEST` | `*/15 * * * *` | embed → vector DB (per §87.4 + §90.5) | vector_db |
| `INSUR-{slug_upper}-HITL-AUDIT` | `0 9 * * *` | sample overrides for retrain | hitl_audit |
| `INSUR-{slug_upper}-FAIRNESS-AUDIT` | `0 9 * * 1` | per-cohort metric audit | fairness_audit |

## 8. Top 1% production gates

- ✓ Drift PSI > 0.2 → block deploy (per §82.7)
- ✓ Fairness disparate impact ≥ 0.8 across protected groups (per §76)
- ✓ Explainability artifact per prediction (per §48 · see G11)
- ✓ MC-Dropout / ensemble uncertainty surfaced (per §75.5)
- ✓ Shadow + canary 5%→25%→100% (per §47.10)
- ✓ Model card mandatory (per §48.3 EU AI Act Art. 86)
- ✓ Counterfactual per regulated decision (per §48.7)
- ✓ Rollback via MLflow registry (per §47.7)

## 9. Composing § references

§38.3 (audit row) · §43 (drill discipline) · §47 (architecture · 4-layer rollback) · §48 (XAI · MANDATORY) · §74 (11-phase ML lifecycle) · §75 (12-axis metric matrix) · §76 (RAI 5 pillars) · §83 (subject-level bootstrap CI · MANDATORY for any human-data) · §87 (universal audit · vector ingest cron) · §88 (default testing 10 agents) · §90 (this use case catalogued in mandatory 48).

## 10. Insurance-domain mapping

- Dept {dept_id} · Process: TODO
- Sub-process: TODO
- Downstream: TODO

---

# Mandatory subsections G1-G12 (per §90.3)

## G1. Data preprocessing pipeline

See `data-quality-checklist.md` · sections 1-5.

## G2. EDA

See `data-quality-checklist.md` · section 6.

## G3. Class balance + SMOTE

See `data-quality-checklist.md` · section 7.

## G4. Feature engineering + selection

See `data-quality-checklist.md` · section 8.

## G5. Data cleaning

See `data-quality-checklist.md` · section 9.

## G6. Data scoring + quality

See `data-quality-checklist.md` · section 10.

## G7. Statistical analysis

See `analysis-checklist.md` · section 1.

## G8. Subjective analysis

See `analysis-checklist.md` · section 2.

## G9. Sensitivity analysis

See `analysis-checklist.md` · section 3.

## G10. ResAI (5 pillars per §76)

See `responsible-ai-checklist.md` · sections 1-5.

## G11. ExpAI (per §48 + §82.20)

See `responsible-ai-checklist.md` · sections 6-9.

## G12. Data → DB → Vector DB pipeline

See `pipeline-checklist.md` · all sections + cron in §7 above.

---

## Definition of done (per §90.9)

- [ ] All 22 subsections (10 top-level + G1-G12) have non-TODO content
- [ ] Data downloaded (run `scripts/download_kaggle_datasets.sh`)
- [ ] DB tables exist (`<use_case>_raw` · `<use_case>_clean` · `<use_case>_features` · `<use_case>_predictions`)
- [ ] Vector ingest cron installed (per §87.4 + §90.5)
- [ ] §47.6 + §76 + §88 audits pass
- [ ] §48 XAI artifacts present (SHAP global + local · CF per regulated)
- [ ] §83 subject-level bootstrap CI computed
- [ ] Drift cron active

## Composes with

- [`../../../docs/AI_USE_CASES_TOP_1_PERCENT.md`](../../../docs/AI_USE_CASES_TOP_1_PERCENT.md) — full 48-catalog
- `data-quality-checklist.md` · `analysis-checklist.md` · `responsible-ai-checklist.md` · `pipeline-checklist.md` · `evaluation-metrics.json` · `testing-coverage.json`
"""


DATA_QUALITY_TEMPLATE = """# Data Quality Checklist · {name}

> Per §90 G1-G6 mandatory subsections.

## 1. Schema detection

| Column | dtype | Cardinality | Notes |
|---|---|---|---|
| TODO | TODO | TODO | TODO |

## 2. Structure tag (per col)

| Column | Structured / Semi / Unstructured |
|---|---|

## 3. Missing value scan

`missingno.matrix(df)` + `missingno.bar(df)` PNGs saved to `plots/missing_*.png`.

| Column | % missing | Strategy |
|---|---|---|

## 4. Outlier detection

| Column | IQR outliers | Z>3 | IsoForest score | Strategy |
|---|---|---|---|---|

## 5. Distribution analysis

| Column | Mean | Median | Std | Skew | Kurtosis | KDE shape |
|---|---|---|---|---|---|---|

## 6. EDA (G2)

- [ ] Univariate stats (pandas-profiling / ydata-profiling) → `reports/eda_profile.html`
- [ ] Bivariate correlation heatmap → `plots/correlation_heatmap.png`
- [ ] Categorical cardinality top-N bars → `plots/cat_topN.png`
- [ ] Box + violin per numeric col → `plots/box_violin.png`
- [ ] (If time-series) seasonal_decompose → `plots/seasonal.png`

## 7. Class balance + SMOTE (G3)

- [ ] Class count table
- [ ] Imbalance ratio computed · flag if IR > 5
- [ ] Decision: SMOTE vs ADASYN vs class_weight vs undersample
- [ ] Validation: ROC and PR-AUC on balanced vs imbalanced

## 8. Feature engineering + selection (G4)

- [ ] Numeric scaling (Standard / MinMax / Robust)
- [ ] Categorical encoding (OneHot / Target / Frequency / Embedding)
- [ ] Mutual information ranking → top-15 bar chart
- [ ] Pearson correlation matrix (numeric only)
- [ ] VarianceThreshold (drop near-constant)
- [ ] RFE / RFECV chosen feature subset
- [ ] L1-Lasso sparse solution
- [ ] Tree-based feature_importances ranking
- [ ] SHAP-based post-hoc importance (after model train)

## 9. Data cleaning (G5)

- [ ] Duplicate detection + decision (drop / merge)
- [ ] Typo correction (fuzzy / soundex) on key string cols
- [ ] Format normalization (strip · lower · regex)
- [ ] Date parsing with validation
- [ ] Unit conversion per registry
- [ ] PII redaction (regex + NER + Presidio per §76)
- [ ] Inconsistent codes mapped to controlled vocabulary

## 10. Data scoring + quality (G6)

Use Great Expectations / Soda Core / dbt tests / Deequ (per §88 area #6).

| Metric | Threshold | Current | Pass? |
|---|---|---|---|
| Completeness | ≥ 95% | TODO | ☐ |
| Uniqueness (PK) | = 1.0 | TODO | ☐ |
| Validity (regex/range/enum) | ≥ 99% | TODO | ☐ |
| Consistency (cross-field) | < 1% violations | TODO | ☐ |
| Timeliness | < 24h freshness | TODO | ☐ |
| Accuracy (verifiable cols) | ≥ 95% | TODO | ☐ |
| **Composite quality score** | **≥ 0.85** | TODO | ☐ |
"""


ANALYSIS_TEMPLATE = """# Analysis Checklist · {name}

> Per §90 G7-G9 mandatory subsections.

## 1. Statistical analysis (G7 · per §83 Phase 6)

| Analysis | Done? | Tool | Output |
|---|---|---|---|
| Pre-registered hypotheses (written before training) | ☐ | docs/hypotheses.md | — |
| Effect size: Cohen's d · Cliff's δ · ΔF1 · ΔAUC | ☐ | scipy / pingouin | `reports/effect_sizes.json` |
| **95% CI via subject-level bootstrap** (NOT window) | ☐ | custom | `reports/bootstrap_ci.json` |
| Paired comparisons: McNemar · DeLong · paired-bootstrap | ☐ | statsmodels / custom | `reports/paired.json` |
| CV statistics (mean ± std + per-fold) | ☐ | sklearn | `reports/cv_stats.json` |
| Multi-comp correction: Holm-Bonferroni · BH-FDR | ☐ | statsmodels | `reports/corrected_pvals.json` |
| Nonparametric: Wilcoxon · permutation | ☐ | scipy | `reports/nonparam.json` |
| Rare-event: sensitivity @ FAR · precision @ recall floor | ☐ | custom | `reports/rare_event.json` |
| Calibration: ECE + Brier + reliability diagram + CI | ☐ | sklearn / custom | `reports/calibration.json` |
| Subgroup disparity: per-group Cohen's d + significance | ☐ | custom | `reports/subgroup_disparity.json` |
| Robustness significance: sensitivity-analysis p-value | ☐ | custom | `reports/robustness.json` |
| Model ranking stability: bootstrap win-rate | ☐ | custom | `reports/ranking_stability.json` |
| Power / sample adequacy: post-hoc power analysis | ☐ | statsmodels | `reports/power_analysis.json` |

## 2. Subjective analysis (G8 · per §75.4)

| Method | Done? | Sample size | Output |
|---|---|---|---|
| Operator NPS survey (AI usefulness) | ☐ | ≥ 50 ops | `reports/nps.json` |
| Adjuster preference A/B (AI vs human-only) | ☐ | ≥ 200 cases | `reports/ab_preference.json` |
| Word cloud on free-text feedback | ☐ | — | `plots/wordcloud.png` |
| BERTopic theme extraction | ☐ | — | `reports/themes.json` |
| Quote-of-the-day curation | ☐ | — | `reports/quotes.md` |
| Longitudinal feedback gallery (per release) | ☐ | — | `reports/feedback_gallery.md` |

## 3. Sensitivity analysis (G9 · per §83 Phase 5)

| Analysis | Done? | Method | Output |
|---|---|---|---|
| One-at-a-time perturbation (±10% per feature) | ☐ | custom | `reports/oat.json` |
| Variance-based Sobol (total + first-order) | ☐ | SALib | `reports/sobol.json` |
| Counterfactual generation (per §48.7) | ☐ | DiCE / Alibi | `reports/counterfactuals.json` |
| Adversarial perturbation (FGSM/PGD for CV · TextFooler for NLP) | ☐ | foolbox / textattack | `reports/adversarial.json` |
| Concept-drift simulation (distribution shift) | ☐ | custom | `reports/drift_sensitivity.json` |
| Hyperparameter sensitivity (OOS vs HP grid) | ☐ | Optuna | `reports/hp_sensitivity.json` |
"""


RAI_TEMPLATE = """# Responsible AI Checklist · {name}

> Per §90 G10-G11 mandatory subsections.

## G10 · ResAI · 5 pillars (per §76)

### 1. Privacy

- [ ] DLP scan completed (no secrets in training data)
- [ ] PII redaction proof (sample: 100 rows shown redacted)
- [ ] CMEK at rest verified
- [ ] No PII in vector DB embeddings (per §76.10 EU AI Act Art. 12)
- [ ] Retention class set (per §87 audit row)
- [ ] Right-to-be-forgotten path tested

### 2. Transparency

- [ ] Data sources documented in model card
- [ ] Model card filed (per §48.3 EU AI Act Art. 86)
- [ ] User-facing AI disclosure (per §76.10 Art. 50)
- [ ] Limitations documented
- [ ] Last review date current

### 3. Robustness

- [ ] Adversarial robustness audit (per G9 sensitivity)
- [ ] Out-of-distribution detection wired
- [ ] Fallback path tested (when model down)
- [ ] Latency p99 measured under load (per §47.10)
- [ ] Drift monitoring active (per §82.7)

### 4. Safety

- [ ] Kill switch wired (per §76 + §47)
- [ ] HITL escalation tested (per §40 + §80)
- [ ] Safety classifier on outputs (toxicity / hallucination per §76.7)
- [ ] Incident playbook documented (per §57.5)
- [ ] On-call rotation defined

### 5. Accountability

- [ ] Named owner (RACI matrix)
- [ ] §38.3 audit row per prediction
- [ ] Dispute mechanism for users
- [ ] Override log captured
- [ ] Council review cadence set (per §38 + §88)

## G11 · ExpAI (per §48 + §82.20)

| Method | Done? | When to use | Output |
|---|---|---|---|
| SHAP global feature importance | ☐ | every tabular | `plots/shap_global.png` |
| SHAP local per prediction | ☐ | every regulated decision (§48.7) | `data/shap_local/<request_id>.json` |
| LIME local | ☐ | alternative when SHAP slow | `data/lime_local/` |
| Integrated Gradients | ☐ | every deep model | `data/ig/` |
| Grad-CAM | ☐ | every CV model | `data/grad_cam/` |
| Attention maps (with §48.2 caveat) | ☐ | every transformer | `data/attention/` |
| Counterfactual (MANDATORY for regulated) | ☐ | every regulated decision | `data/cf/<request_id>.json` |
| Anchors (Ribeiro) | ☐ | rule-based local explanations | `data/anchors/` |
| Surrogate decision tree | ☐ | interpretable approximation | `models/surrogate.pkl` |
| Citation tracing (for RAG) | ☐ | every RAG answer (per §48.5) | `data/citations/<answer_id>.json` |
"""


PIPELINE_TEMPLATE = """# Pipeline Checklist · {name}

> Per §90 G12 mandatory subsection · Data → DB → Vector DB pipeline.

## Storage layers (per §90.5)

| Stage | DB / Storage | Table / Bucket | Schema notes |
|---|---|---|---|
| Raw data | Postgres | `{slug}_raw` | PII classified per §76 · retention = audit |
| Cleaned data | Postgres | `{slug}_clean` | post-G5 cleaning |
| Features | Feast OR Postgres | `{slug}_features` | versioned |
| Predictions | Postgres | `{slug}_predictions` | audit-linked · 7-year retention |
| Embeddings | Vector DB | source = `{slug}_predictions` | Chroma / Qdrant / pgvector |
| Audit rows | Postgres | `user_input_events` + `audit_rows` | per §87.2 |
| Model artifacts | MLflow | registry · model_name = `{slug}` | versioned |
| Explanations | S3/MinIO | bucket `/explanations/{slug}/` | referenced in audit row |

## Mandatory cron jobs (per §90.5)

| Cron tag | Schedule | Script | Purpose |
|---|---|---|---|
| `INSUR-{slug_upper}-VECTOR-INGEST` | `*/15 * * * *` | `scripts/vector_ingest.py` | embeddings → vector DB |
| `INSUR-{slug_upper}-CRASH-RECOVERY-SCAN` | `*/15 * * * *` | `scripts/crash_recovery_scan.py` | find incomplete records · resume |
| `INSUR-{slug_upper}-DRIFT-CHECK` | `0 * * * *` | per-use-case drift script | data + concept drift |
| `INSUR-{slug_upper}-RAG-REINDEX` (if RAG) | `0 3 * * 1` | per-corpus reindex | weekly |
| `INSUR-{slug_upper}-RETRAIN` | `0 3 * * 1` | per-model retrain | weekly |
| `INSUR-{slug_upper}-HITL-AUDIT` | `0 9 * * *` | sample HITL · feed retrain | daily |
| `INSUR-{slug_upper}-FAIRNESS-AUDIT` | `0 9 * * 1` | per-cohort metrics | weekly |
| `INSUR-{slug_upper}-COST-REPORT` | `0 8 * * 1` | per §88 area #5 | weekly |

## Per-prediction artifact contract (per §87 + §90)

Every prediction MUST write:

1. **Input** payload → `{slug}_raw` (redacted per §76)
2. **Process** trace → OTel span tree (correlation_id = request_id per §47.4)
3. **Output** payload → `{slug}_predictions`
4. **Log** lines → ELK / Loki (structured · with request_id)
5. **Trace** → Jaeger / Tempo
6. **Prompt** (if LLM) → `data/prompts.db` per §21 prompt-tracker
7. **Embedding** → Vector DB via cron (within 15 min)
8. **Explanation** → S3/MinIO with reference in audit row
9. **Audit row** → `audit_rows` table (per §38.3 16-field schema per §57.6.1)
10. **Model card** check → MLflow registry entry exists for current model version

## Definition of done (per §90.9)

- [ ] All 10 storage layers populated for first sample request
- [ ] All 8 cron jobs installed and verified running
- [ ] Vector DB has ≥ 1 row per prediction within 15 min
- [ ] Audit row has all 16 §57.6.1 fields populated
- [ ] Drift cron produces JSON output to `data/eval/{slug}/drift/`
"""


def slugify(s: str) -> str:
    import re
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--force", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--limit", type=int, default=0)
    args = p.parse_args()

    ROOT.mkdir(parents=True, exist_ok=True)
    written = 0; skipped = 0; count = 0

    for block_id, slug, summary, dept_id in USE_CASES:
        count += 1
        if args.limit and count > args.limit:
            break

        dirname = f"{block_id.lower()}-{slug}"
        dest = ROOT / dirname
        if dest.exists() and not args.force:
            skipped += 1
            continue

        if args.dry_run:
            print(f"  WOULD CREATE: docs/use-cases/{dirname}/")
            continue

        dest.mkdir(parents=True, exist_ok=True)

        ctx = dict(
            name=slug.replace('-', ' ').title(),
            block=block_id,
            dept_id=dept_id,
            summary=summary,
            slug=slug,
            slug_upper=slug.upper().replace('-', '_'),
        )

        (dest / "use-case.md").write_text(USE_CASE_MD_TEMPLATE.format(**ctx))
        (dest / "data-quality-checklist.md").write_text(DATA_QUALITY_TEMPLATE.format(**ctx))
        (dest / "analysis-checklist.md").write_text(ANALYSIS_TEMPLATE.format(**ctx))
        (dest / "responsible-ai-checklist.md").write_text(RAI_TEMPLATE.format(**ctx))
        (dest / "pipeline-checklist.md").write_text(PIPELINE_TEMPLATE.format(**ctx))

        # Evaluation metrics JSON · per §75 12-axis
        (dest / "evaluation-metrics.json").write_text(json.dumps({
            "use_case_id": block_id,
            "slug": slug,
            "dept_id": dept_id,
            "12_axis_per_75": {
                "performance":       {"target": None, "current": None, "status": "todo"},
                "subject_wise":      {"target": None, "current": None, "status": "todo"},
                "cross_validation":  {"target": None, "current": None, "status": "todo"},
                "model":             {"target": None, "current": None, "status": "todo"},
                "feature":           {"target": None, "current": None, "status": "todo"},
                "robustness":        {"target": None, "current": None, "status": "todo"},
                "generalization":    {"target": None, "current": None, "status": "todo"},
                "reliability":       {"target": None, "current": None, "status": "todo"},
                "interpretability":  {"target": None, "current": None, "status": "todo"},
                "computational":    {"target": None, "current": None, "status": "todo"},
                "comparative":       {"target": None, "current": None, "status": "todo"},
                "statistical":       {"target": None, "current": None, "status": "todo"},
            },
            "composite_score": {
                "formula": "operator-defined per §77 composite formulas",
                "current": None,
                "target": None
            }
        }, indent=2))

        # Testing coverage JSON · per §88 10 agents
        (dest / "testing-coverage.json").write_text(json.dumps({
            "use_case_id": block_id,
            "slug": slug,
            "ten_agents_per_88": {
                "quality-gate-agent":               {"owns": "default health gate", "tests_run": [], "status": "todo"},
                "sast-code-quality-agent":          {"owns": "SonarQube + Semgrep + Ruff + ESLint + Gitleaks + Trivy", "tests_run": [], "status": "todo"},
                "api-contract-test-agent":          {"owns": "API contract · route · schema · auth · OpenAPI · negative", "tests_run": [], "status": "todo"},
                "frontend-browser-test-agent":      {"owns": "Playwright · Axe · F12 console + network", "tests_run": [], "status": "todo"},
                "load-performance-test-agent":      {"owns": "k6 · Locust · 1000-request · latency · throughput", "tests_run": [], "status": "todo"},
                "data-quality-test-agent":          {"owns": "Great Expectations · Soda · dbt · KPI lineage", "tests_run": [], "status": "todo"},
                "database-test-agent":              {"owns": "migration · SQL · pgTAP · pgbench", "tests_run": [], "status": "todo"},
                "model-evaluation-test-agent":      {"owns": "MLflow · sklearn · RAGAS · DeepEval · BLEU · ROUGE · SHAP · Fairlearn · Detoxify", "tests_run": [], "status": "todo"},
                "reporting-notification-agent":     {"owns": "MD + JSON reports · evidence · routing", "tests_run": [], "status": "todo"},
                "council-governance-review-agent":  {"owns": "P0/P1 review · weekly full gate · promotion signoff", "tests_run": [], "status": "todo"},
            },
            "nine_areas_per_88_2": {
                "default_health_gate":    "owner: quality-gate-agent",
                "code_quality_sast":      "owner: sast-code-quality-agent",
                "api_testing":            "owner: api-contract-test-agent",
                "frontend_f12":           "owner: frontend-browser-test-agent",
                "load_testing":           "owner: load-performance-test-agent",
                "data_testing":           "owner: data-quality-test-agent",
                "database_testing":       "owner: database-test-agent",
                "model_training_accuracy": "owner: model-evaluation-test-agent",
                "governance_security_ai": "owner: council-governance-review-agent",
            }
        }, indent=2))

        # README pointing back
        (dest / "README.md").write_text(f"""# {block_id} · {slug}

{summary}

## Files in this stub

| File | Purpose | § ref |
|---|---|---|
| `use-case.md` | 22-subsection master spec | §90 |
| `data-quality-checklist.md` | G1-G6 (preprocessing · EDA · SMOTE · feature eng · cleaning · quality) | §90.3 |
| `analysis-checklist.md` | G7-G9 (statistical · subjective · sensitivity) | §90.3 |
| `responsible-ai-checklist.md` | G10-G11 (ResAI 5-pillar · ExpAI) | §76 · §48 |
| `pipeline-checklist.md` | G12 (DB → Vector DB · cron · audit row contract) | §87.4 · §90.5 |
| `evaluation-metrics.json` | §75 12-axis matrix · composite score | §75 |
| `testing-coverage.json` | §88 10 agents × 9 areas | §88 |

## Definition of done

See `use-case.md` § "Definition of done" — all 22 subsections + DB + vector cron + audits + XAI artifacts.

## Composes with

[`../../AI_USE_CASES_TOP_1_PERCENT.md`](../../AI_USE_CASES_TOP_1_PERCENT.md) — full 48-catalog.

Block §90 of `~/.claude/CLAUDE.md`.
""")
        written += 1

    print(f"\nGenerated: {written} use-case stubs · {skipped} skipped")
    print(f"Root: {ROOT.relative_to(REPO)}")
    print(f"Total files: {written * 8}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
