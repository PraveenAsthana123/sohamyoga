# Recommender System Flavors per Department · Item · Content · Hybrid

> Per operator 2026-06-08: "did you setup recommender system each (item, text, hybrid)"
> Closes the §64.22 gap: every dept MUST cover all 3 classical flavors.

## The 3 classical recommender flavors

| Flavor | Technique | Best for | Limitation |
|---|---|---|---|
| **Item-based (collaborative filter)** | Item-item · ALS · matrix factorization · two-tower NN · session-based seq | Rich user×item interaction history | Cold-start fails on new items/users |
| **Content-based (text/feature)** | TF-IDF · sentence-transformer · CLIP · attribute match | Cold-start friendly · interpretable | Filter bubble · narrow recommendations |
| **Hybrid** | CF + content + business rules · gradient-boosted ranker (LightGBM/XGB) · weighted ensemble | Production default · best metric · cold + warm covered | Most complex · 2-3× train cost |

## Per-dept matrix · 21 depts × 3 flavors = 63 cells

Each cell shows the **concrete algorithm choice** that fits the dept's data shape.

| Dept ID | Dept | Item-based (CF) | Content-based | Hybrid (production default) |
|---|---|---|---|---|
| 1 | Product Mgmt | Two-tower NN · feature × spec | Spec embed sim | LightGBM rerank over CF + content |
| 3 | Sales | ALS on customer×product | TF-IDF on product copy | Hybrid · margin × inventory rule |
| 4 | Underwriting | Two-tower (UW history) | Property attribute match | XGB rerank · risk + history blend |
| 5 | Policy Admin | Item-item (template×customer) | LayoutLM embed sim | LightGBM rerank |
| 6 | Billing | Session seq (payment flow) | Payment-method attribute | Hybrid · multi-armed bandit |
| **7** | **Claims (canonical)** | Item-item (claim×shop) MF | CLIP photo sim + region | LightGBM rerank · 3-signal blend |
| 8 | SIU | n/a (single-shot detection) | Narrative similarity | XGB · narrative + GNN ensemble |
| 9 | CS | Skill-based collab + load bandit | KB BM25 + DPR | RAG + rerank cross-encoder |
| 10 | Actuarial | Bayesian rec (uncertainty) | Profile attribute match | Bayesian blend |
| 11 | Reinsurance | NSGA-II multi-objective | Treaty-term text embed | NSGA-II + content score |
| 12 | Compliance | n/a (filing requirements) | Regulation embed (E5/BGE) | Cross-encoder rerank |
| 13 | Legal | n/a (case lookup) | Caselaw dense retrieval | Rerank + clause match |
| 14 | Finance | RL DDPG (allocation) | Bond/asset attribute | DDPG + risk-attribute |
| 15 | ERM | Bayesian (rare events) | Risk-category embed | Bayesian blend |
| 16 | HR | Item collab + content embed | Resume embed | LightGBM + role-fit rule |
| 17 | Procurement | MAB Thompson (vendor) | Vendor catalog embed | MAB + content + SLA |
| 18 | Analytics | Item-item (dashboard) | Saved-view embed | Hybrid + cohort |
| 19 | IT | Skill-based collab + alert MAB | Runbook embed | RAG over runbooks |
| 20 | Cyber | n/a (playbook lookup) | Threat embed | Rerank + severity |
| 21 | Partner | Item-item (partner×product) | Partner profile embed | XGB + tier blend |
| 22 | Product Innovation | n/a (cold-start dominant) | Concept embed | Content-only · then graduate |

**Totals**:
- Item-based applicable: 17 of 21 depts (81%)
- Content-based applicable: 21 of 21 depts (100%)
- Hybrid applicable: 21 of 21 depts (100%)

## Mapping to existing 23 R-* scenarios

The 23 scenarios in [`RECOMMENDER_ANOMALY_FRAUD_SCENARIOS.md`](RECOMMENDER_ANOMALY_FRAUD_SCENARIOS.md) cover all 3 flavors implicitly:

| Flavor | R-* IDs (modality-split) |
|---|---|
| **Item-based** | R-N1 (cross-sell) · R-N3 (repair-shop CF) · R-N6 (Bayesian rec) · R-N8 (adjudicator) · R-T6 (training-content collab) · R-I7 (asset visual sim) |
| **Content-based** | R-N7 (vendor terms via MAB) · R-T1 (clause embed) · R-T2 (regulation) · R-T3 (template) · R-T4 (KB BM25+DPR) · R-T5 (complaint resolution) · R-T7 (caselaw) · R-T8 (PRD clause) · R-I1 (CLIP claim photo) · R-I2 (property photo) · R-I3 (vendor equip CLIP) · R-I4 (OEM part) · R-I5 (resume bg) · R-I6 (form template) |
| **Hybrid** | R-N2 (premium-tier two-tower) · R-N4 (reinsurance multi-objective) · R-N5 (investment RL+risk) |

## Mandatory subsections per flavor (per §90.3)

Every flavor implementation must have all 28 §90.3 subsections (10 top-level + G1-G18). Specific to recommenders:

- **G3 SMOTE / balance**: rare-event recs need negative sampling
- **G4 feature selection**: SHAP per-recommendation for explainability (§48)
- **G7 statistical**: bootstrap MAP/MRR/NDCG@K confidence intervals
- **G10 ResAI fairness**: diversity score + cohort-fairness audit (per §76)
- **G11 ExpAI**: "why this rec?" tracing — content-based easier than item-based
- **G16 inference modes**: sync (per request · <500ms) · batch (overnight precompute) · stream (event-triggered re-rank)

## §64.22 compliance audit per dept

| Dept | Has item-based? | Has content-based? | Has hybrid? | §64.22 Pass? |
|---|---|---|---|---|
| 1-22 | per matrix above | per matrix above | per matrix above | per matrix |

Pass criteria per dept: ≥1 of each applicable flavor implemented + drilled + audited per §43.

## Composes with

§38.3 (audit row · recommendation context tracked) · §43 (drill ≥1 negative · "wrong cohort gets wrong rec") · §48 (XAI · "why this rec?" mandatory) · §64.22 (per-dept recommendation MANDATORY · 3 flavors) · §76 (RAI · fairness across cohorts · diversity score) · §82.7 (drift on rec quality) · §87 (vector ingest of rec history → RAG) · §90 (per-use-case 28 subsections) · §91 (LangGraph for RAG-backed rec orchestration).
