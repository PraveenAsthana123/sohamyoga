# Recommender · Anomaly · Fraud Detection · Per Data Type

> Per operator 2026-06-08: "list of recommender system scenario, anomaly detection, fraud detection for numerical data, text data, image data".

3 problem types × 3 data modalities = **9-cell matrix · ~50 concrete scenarios** mapped to dept × process. Each row follows the §90 contract (architecture · noise · pipelines · inference modes · workflow · channels · ResAI · ExpAI · DB+VectorDB cron).

---

## Recommender Systems

### R · Numerical data

| # | Use case | Dept × Process | Algorithm | Key data | Inference |
|---|---|---|---|---|---|
| R-N1 | **Next-best-product (cross-sell)** | Dept 3 Sales · `cross-sell-upsell` | Hybrid · ALS + LightGBM ranker | customer × product purchase matrix · features | sync (per session) |
| R-N2 | **Premium-tier upgrade rec** | Dept 4 UW · `pricing-tier-recommendation` | Two-tower NN · user-tower + tier-tower | risk score · current tier · acceptance history | sync |
| R-N3 | **Repair-shop recommendation** | Dept 7 Claims · `vendor-selection` | Collaborative filter · matrix factorization | claim × shop × rating × cost | sync (per FNOL) |
| R-N4 | **Reinsurance-treaty match** | Dept 11 Reinsurance · `treaty-allocation` | Multi-objective · NSGA-II + content score | exposure × treaty terms × historical loss | batch (weekly portfolio) |
| R-N5 | **Investment allocation rec** | Dept 14 Finance · `portfolio-rebalance` | RL (DDPG) + risk-constrained | returns · risk metrics · constraints | batch (daily) |
| R-N6 | **Reserve-tier recommendation** | Dept 10 Actuarial · `reserve-tier-selection` | Bayesian rec w/ uncertainty | claim profile + tier history | sync |
| R-N7 | **Vendor-payment-terms rec** | Dept 17 Procurement · `payment-terms-optimization` | Multi-armed bandit (Thompson Sampling) | vendor risk · cash flow · historical terms | sync |
| R-N8 | **HITL adjudicator rec** | Dept 7 Claims · `adjuster-routing` (skills) | Skill-based collab + workload bandit | adjuster history · case attrs · current load | sync |

### R · Text data

| # | Use case | Dept × Process | Algorithm | Key data | Inference |
|---|---|---|---|---|---|
| R-T1 | **Policy-clause recommender** | Dept 13 Legal · `policy-drafting-assist` | Sentence-transformer embed + reranker | clause corpus · drafted text query | sync |
| R-T2 | **Regulation recommender** | Dept 12 Compliance · `reg-citation-helper` | Embedding + cross-encoder rerank | regulations.gov + state filings | sync |
| R-T3 | **Email-template recommender** | Dept 3 Sales · `personalized-cold-email` | Embedding sim · template × customer-attr | template corpus + CRM | batch (per campaign) |
| R-T4 | **Knowledge-base article rec** | Dept 9 CS · `agent-knowledge-suggestion` | Hybrid: BM25 + DPR + reranker | KB corpus + open ticket text | sync (per chat) |
| R-T5 | **Customer-complaint resolution rec** | Dept 9 CS · `complaint-handling` | Few-shot LLM + RAG | complaint corpus + resolution outcomes | sync |
| R-T6 | **Training-content rec** | Dept 16 HR · `learning-and-development` | Item-based collab + content embed | LMS catalog + completion history | batch (weekly) |
| R-T7 | **Caselaw / precedent rec** | Dept 13 Legal · `legal-research` | Dense retrieval (E5/BGE) + rerank | court filings + case outcomes | sync |
| R-T8 | **PRD-clause recommender** | Dept 22 Product · `prd-drafting` | LangGraph + RAG | PRD archive + roadmap items | sync |

### R · Image data

| # | Use case | Dept × Process | Algorithm | Key data | Inference |
|---|---|---|---|---|---|
| R-I1 | **Similar-claim photo rec** | Dept 7 Claims · `claim-precedent-lookup` | CLIP embedding + vector DB cosine | closed-claim photo archive | sync (per FNOL upload) |
| R-I2 | **Property-photo benchmark rec** | Dept 4 UW · `comparable-property-lookup` | ResNet embed + per-region vector index | property photo archive | sync |
| R-I3 | **Vendor-equipment image rec** | Dept 17 Procurement · `equipment-search` | CLIP + filterable metadata | vendor catalog photos | sync |
| R-I4 | **OEM-part image rec** | Dept 7 Claims · `parts-match` | CLIP + OEM catalog · part-by-photo | OEM catalog images | sync (per repair order) |
| R-I5 | **Resume-photo background rec** | Dept 16 HR · `candidate-similarity` | Face-attribute-blind embed | candidate gallery | batch (per req) |
| R-I6 | **Document-template image rec** | Dept 5 Policy Admin · `form-template-match` | Layout embed (LayoutLMv3) + vector | form template library | sync |
| R-I7 | **Risk-asset image rec** (similar buildings) | Dept 15 ERM · `exposure-comparable-lookup` | ResNet + GIS metadata | exposure inventory photos | batch |

---

## Anomaly Detection

### A · Numerical data

| # | Use case | Dept × Process | Algorithm | Key data | Inference |
|---|---|---|---|---|---|
| A-N1 | **GL journal anomaly** | Dept 14 Finance · `accounting-anomaly` | IsoForest + VAE ensemble · SHAP attribution | journal entries (account · amount · period) | batch (post-close daily) |
| A-N2 | **Premium-pricing anomaly** | Dept 4 UW · `pricing-outlier-detection` | One-Class SVM + Mahalanobis | quote attrs + premium amount | sync (per quote) |
| A-N3 | **Claims-payment anomaly** | Dept 7 Claims · `payment-validation` | Robust covariance + percentile gate | settlement amount · claim attrs | sync (pre-pay) |
| A-N4 | **Reserve-volume anomaly** | Dept 10 Actuarial · `reserve-monitor` | Streaming z-score · EWMA | reserve change events | stream (real-time) |
| A-N5 | **Loss-ratio drift anomaly** | Dept 11 Reinsurance · `loss-ratio-monitor` | TFT residual + control chart | aggregated loss ratio time series | batch (weekly) |
| A-N6 | **Capital-position anomaly** | Dept 15 ERM · `solvency-monitor` | Multivariate z-score · per-line | capital positions · stress test outputs | batch (daily) |
| A-N7 | **Vendor-spend anomaly** | Dept 17 Procurement · `spend-monitor` | Holt-Winters residual + IsoForest | per-vendor spend per period | batch (weekly) |
| A-N8 | **Cash-flow anomaly** | Dept 14 Finance · `treasury-monitor` | Prophet residual + DBSCAN | bank-account daily balances | stream (intra-day) |
| A-N9 | **Underwriting-decision drift** | Dept 4 UW · `decision-drift-monitor` | KS-test + per-cohort drift | decision distribution per week × cohort | batch (weekly) |
| A-N10 | **Sensor-telemetry anomaly** (IoT) | Dept 19 IT · `infra-metric-monitor` | LSTM-autoencoder | server metric time series (CPU · mem · disk · net) | stream |

### A · Text data

| # | Use case | Dept × Process | Algorithm | Key data | Inference |
|---|---|---|---|---|---|
| A-T1 | **Complaint-text topic anomaly** | Dept 18 Analytics · `complaint-monitor` | BERTopic · new-topic alert when DBSCAN finds 2σ shift | customer complaint corpus | batch (weekly) |
| A-T2 | **Email-content anomaly** | Dept 9 CS · `email-spam-anomaly` | DistilBERT + embedding outlier | inbound email | stream |
| A-T3 | **Policy-text wording anomaly** | Dept 5 Policy Admin · `wording-deviation-check` | sentence-transformer + cosine outlier | policy text vs canonical templates | sync (per issuance) |
| A-T4 | **Adjuster-narrative anomaly** | Dept 7 Claims · `narrative-flag` | BERT + reconstruction score | adjuster narrative text per claim | sync |
| A-T5 | **Regulatory-language drift** | Dept 12 Compliance · `reg-language-shift` | Embedding drift + per-state delta | regulations.gov + state texts | batch (weekly) |
| A-T6 | **Contract-deviation anomaly** | Dept 13 Legal · `contract-anomaly` | LayoutLM + clause embedding outlier | contract repository | sync (pre-sign) |
| A-T7 | **Sentiment swing anomaly** | Dept 9 CS · `csat-sentiment-monitor` | sentiment classifier + EWMA on score | survey responses · call transcripts | stream |
| A-T8 | **Code-review comment anomaly** | Dept 19 IT · `pr-review-anomaly` | embedding outlier on PR comments | GitHub PR comments | stream |

### A · Image data

| # | Use case | Dept × Process | Algorithm | Key data | Inference |
|---|---|---|---|---|---|
| A-I1 | **CCTV anomaly (premise)** | Dept 7 Claims · `premise-claim-validation` | 3D CNN autoencoder · reconstruction | CCTV footage | stream (real-time) |
| A-I2 | **Damage-photo authenticity anomaly** | Dept 8 SIU · `photo-tampering` | ELA + CNN classifier + GAN-detect | claim photos | sync (per upload) |
| A-I3 | **Drone-imagery property anomaly** | Dept 4 UW · `drone-anomaly` | U-Net + per-region baseline diff | drone passes over time | batch (post-inspection) |
| A-I4 | **Document-format anomaly** | Dept 5 Policy Admin · `doc-format-deviation` | LayoutLM + format embedding outlier | inbound documents | sync |
| A-I5 | **Network topology anomaly** (Grafana / topo screenshot) | Dept 19 IT · `topology-monitor` | OCR + structure embedding | dashboard screenshot stream | stream |
| A-I6 | **Satellite-imagery anomaly** | Dept 11 Reinsurance · `cat-anomaly` | Siamese CNN before/after compare | satellite passes pre/post event | batch (post-event) |
| A-I7 | **Surveillance-camera anomaly** | Dept 20 Cyber · `physical-intrusion-detect` | YOLO + per-time-window baseline | facility cameras | stream |

---

## Fraud Detection

### F · Numerical data

| # | Use case | Dept × Process | Algorithm | Key data | Inference |
|---|---|---|---|---|---|
| F-N1 | **Premium-fraud (rate-evasion)** | Dept 8 SIU · `rate-evasion-detect` | XGBoost + adversarial validation | quote attrs + paid premium | sync (per quote) |
| F-N2 | **Soft-fraud claim inflation** | Dept 8 SIU · `claim-inflation` | LightGBM + percentile vs peer | claim payments + attrs | sync (per claim) |
| F-N3 | **Hard-fraud claim** (staged) | Dept 8 SIU · `staged-claim-detect` | XGBoost + class-weighted + SMOTE | claim metadata + outcomes | sync |
| F-N4 | **Identity-fraud (synthetic)** | Dept 20 Cyber · `synthetic-id-detect` | Graph features + XGBoost + GNN | application identities + bureau scores | sync (per app) |
| F-N5 | **Agent-fraud (book-rolling)** | Dept 21 Sales · `agent-rolling-detect` | Behavioral features + XGBoost | agent · policy · renewal patterns | batch (monthly) |
| F-N6 | **Premium-payment fraud** | Dept 6 Billing · `payment-fraud-detect` | Real-time gradient boosting + Isolation Forest | payment events · account history | stream |
| F-N7 | **Claim-shop collusion** | Dept 8 SIU · `collusion-network` | GNN on graph (D2) + community detection | claim × shop × vendor edges | batch (weekly) |
| F-N8 | **Vendor-invoice fraud** | Dept 17 Procurement · `invoice-fraud-detect` | XGBoost + duplicate scan + Benford's law | invoice features + history | batch (daily) |
| F-N9 | **Insider-trading anomaly** | Dept 14 Finance · `trading-pattern-detect` | Sequence-aware LSTM + bandit | trade events + market data | stream |
| F-N10 | **Loss-cost padding** | Dept 10 Actuarial · `loss-cost-padding` | Hierarchical Bayes (E3) + posterior anomaly | per-line loss-cost data | batch (monthly) |

### F · Text data

| # | Use case | Dept × Process | Algorithm | Key data | Inference |
|---|---|---|---|---|---|
| F-T1 | **Claim-narrative fraud signal** | Dept 8 SIU · `narrative-fraud-score` | BERT + structured features + ensemble | adjuster narrative + claim attrs | sync |
| F-T2 | **Phishing-email detection** | Dept 20 Cyber · `phishing-detect` | DistilBERT + URL features + GraphSAGE | inbound emails | stream |
| F-T3 | **Customer-complaint fraud pattern** | Dept 8 SIU · `complaint-fraud-cluster` | BERTopic on complaint corpus + cluster anomaly | complaints · CSAT | batch (weekly) |
| F-T4 | **Vendor-form fraud** | Dept 17 Procurement · `form-fraud-detect` | LayoutLM + handwriting-anomaly | vendor application forms | sync |
| F-T5 | **Resume-fraud detection** | Dept 16 HR · `resume-verification` | BERT + entity match + RAG cross-check | resumes + verification corpus | sync |
| F-T6 | **Compliance-report-fraud** | Dept 12 Compliance · `report-fraud-detect` | Hierarchical attention + RAG verification | filed reports vs source data | batch (per filing) |
| F-T7 | **Chat-fraud (account takeover)** | Dept 20 Cyber · `chat-impersonation` | Stylometric features + few-shot LLM | chat transcripts vs user history | stream |
| F-T8 | **Phone-script fraud** | Dept 9 CS · `script-fraud-detect` | Whisper STT → BERT topic + sentiment | call transcripts | stream |

### F · Image data

| # | Use case | Dept × Process | Algorithm | Key data | Inference |
|---|---|---|---|---|---|
| F-I1 | **Photo-tampering detection** | Dept 8 SIU · `photo-forgery-detect` | ELA-CNN + GAN-detect | claim photos | sync |
| F-I2 | **Fake document detection** | Dept 5 Policy Admin · `doc-forgery-detect` | LayoutLM + tamper-specific CNN | submitted PDFs/images | sync |
| F-I3 | **Deepfake video detection** | Dept 8 SIU · `deepfake-detect` | Faceforensics++ pretrained + temporal CNN | submitted videos · video calls | sync |
| F-I4 | **Fake ID detection** | Dept 21 Sales · `id-fraud-detect` | OCR + biometric liveness + KYC RAG | ID photos at onboarding | sync |
| F-I5 | **Receipt-fraud detection** | Dept 17 Procurement · `receipt-fraud-detect` | TrOCR + duplicate-image hash + tamper-CNN | receipt photos | sync |
| F-I6 | **Damaged-photo manipulation** | Dept 7 Claims · `damage-photo-manipulation` | ResNet + manipulation classifier | claim photos | sync |
| F-I7 | **Drone-imagery fraud** (faked damage) | Dept 11 Reinsurance · `drone-fraud-detect` | Siamese + metadata cross-check (EXIF · GPS) | drone passes | sync |
| F-I8 | **Surveillance-evidence fraud** | Dept 20 Cyber · `evidence-fraud-detect` | Temporal CNN + chain-of-custody hash | submitted CCTV evidence | sync |
| F-I9 | **Handwriting forgery** | Dept 13 Legal · `signature-forgery` | Siamese network + biometric | signatures on legal docs | sync |

---

## Roll-up · per (problem · modality) cell

| Problem \ Modality | Numerical | Text | Image |
|---|---|---|---|
| **Recommender** | 8 scenarios | 8 scenarios | 7 scenarios |
| **Anomaly detection** | 10 scenarios | 8 scenarios | 7 scenarios |
| **Fraud detection** | 10 scenarios | 8 scenarios | 9 scenarios |
| **TOTAL per problem** | 28 | 24 | 23 |
| **Grand total** | | | **75 scenarios** |

## Mandatory per-scenario sections (per §90.3)

Every one of the 75 scenarios above MUST have the 28 mandatory subsections (10 top-level + G1-G18 per §90.3 + §J/§K extensions):

1-10: use case · architecture · data download · planning · HP tuning · noise handling · job scheduling · top 1% gates · §refs · domain mapping
- G1-G6: preprocessing · EDA · SMOTE/balance · feature eng/selection · cleaning · quality scoring
- G7-G9: statistical · subjective · sensitivity analysis
- G10-G11: ResAI 5-pillar · ExpAI (SHAP · LIME · IG · Grad-CAM · CF · citations)
- G12: DB + VectorDB pipeline with cron (per §87.4 + §90.5)
- G13-G18: architecture diagram · edge cases · pipeline catalog (13 pipelines) · inference modes (sync · batch · stream) · workflow tool · communication channels

## Composes with

§38.3 · §39 · §47 · §47.4 · §48 (XAI MANDATORY · CF for regulated) · §57.6.1 · §64.40 (agentic K5 variants) · §64.43 (pattern selection) · §74 · §75 · §76 (RAI 5-pillar · fraud-fairness MANDATORY) · §79 (RAG production) · §80 · §82.19 (ResAI · F* fraud detection MANDATORY) · §82.21 (Secure AI · F* MANDATORY) · §87 (vector ingest cron) · §88 (default testing · 10 agents) · §90 (this is the per-problem-per-modality expansion of §90 Block A-F).
