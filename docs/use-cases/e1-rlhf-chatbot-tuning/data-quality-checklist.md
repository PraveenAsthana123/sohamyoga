# Data Quality Checklist · Rlhf Chatbot Tuning

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
