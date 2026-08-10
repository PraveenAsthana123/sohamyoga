# Analysis Checklist · Rlhf Chatbot Tuning

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
