# Hybrid AI Use Cases · Per-Department Mapping

> Per operator 2026-06-08: "list of hybrid usecase ...map them for department".
> Extends §90 Block F (5 generic hybrids) to **5 hybrid types × 21 depts = 105 concrete hybrid use cases**.

Each row is a concrete production-grade scenario. All 22 mandatory subsections from §90.3 apply per row (preprocessing · EDA · SMOTE · feature eng · cleaning · quality scoring · statistical · subjective · sensitivity · ResAI 5-pillar · ExpAI · DB+VectorDB pipeline).

## 5 hybrid types (legend)

| Type | Stack | When to use |
|---|---|---|
| **H1 · ML + RAG** | XGBoost/LGBM + Vector DB + LLM | Tabular prediction + need to cite policy/regulation |
| **H2 · DL + RAG** | CNN/RNN + Vector DB + LLM | Image/sequence prediction + manual/procedure retrieval |
| **H3 · CV + RAG** | Segmentation/Detection + Vector DB + LLM | Pixel-level output + region/material cost lookup |
| **H4 · ML+CV+NLP+RAG** | XGB + CNN + BERT + Vector DB + LLM | Multi-modal claim assistants · multi-signal decisions |
| **H5 · Agentic + RAG + MCP + Workflow** | §64.40 10-layer + Temporal/LangGraph + MCP tools | Long-running goals · cross-system orchestration · durable execution |

## 105-cell matrix · Hybrid × Department

### Dept 1 · Product Management

| Type | Use case | Key components |
|---|---|---|
| H1 | `product-acceptance-rag` · XGB predicts product acceptance + RAG retrieves market analyst commentary | XGB · LegalBench-style market doc corpus · LLM rationale |
| H2 | `roadmap-image-trend-rag` · ResNet on competitor screenshots + RAG retrieves trend reports | ResNet-50 · trend RAG corpus |
| H3 | n/a (no pixel use case) | — |
| H4 | `product-launch-readiness-multimodal` · numeric KPIs + UI mockups + market chatter + RAG regulatory check | full stack |
| H5 | `agentic-product-decision-workflow` · planner gathers data from CRM + finance + market intel + composes go/no-go | Temporal + MCP tools |

### Dept 3 · Sales & Distribution

| Type | Use case | Key components |
|---|---|---|
| H1 | `lead-score-with-policy-citations` · XGB lead score + RAG cites product eligibility rules | XGB + policy RAG |
| H2 | `agent-photo-id-verification-rag` · CNN photo ID match + RAG retrieves fraud patterns | ResNet + KYC RAG |
| H3 | n/a | — |
| H4 | `omnichannel-lead-multimodal` · email text + voice + form data + RAG cross-sell rules | NLP + speech + RAG |
| H5 | `agentic-quote-to-close-workflow` · agent quotes · negotiates · binds policy via MCP tools | Temporal + MCP |

### Dept 4 · Underwriting

| Type | Use case | Key components |
|---|---|---|
| H1 | `uw-risk-score-with-reg-citations` · FT-Transformer score + RAG cites state regulations | FT-Transformer + reg RAG |
| H2 | `uw-property-photo-class-rag` · ResNet risk class + RAG retrieves underwriting guidelines | ResNet + UW guide RAG |
| H3 | `uw-aerial-segmentation-rag` · U-Net building footprint + RAG retrieves regional flood plain | U-Net + GIS RAG |
| H4 | `uw-full-stack-decision` · numeric + property photos + agent narrative + reg + cost lookups | full stack |
| H5 | `agentic-uw-workflow` · pull data · score · cite reg · request docs · approve/deny with audit | Temporal + MCP + LLM |

### Dept 5 · Policy Administration

| Type | Use case | Key components |
|---|---|---|
| H1 | `policy-issuance-with-clause-rag` · XGB pricing + RAG cites coverage clauses | XGB + policy text RAG |
| H2 | `signature-verification-cv-rag` · Siamese CNN + RAG retrieves signature exemplar database | Siamese + signature RAG |
| H3 | `policy-doc-segmentation-rag` · LayoutLM segments policy + RAG retrieves cross-references | LayoutLM + cross-ref RAG |
| H4 | `policy-multimodal-renewal` · history + signatures + payment + RAG regulatory check | full stack |
| H5 | `agentic-renewal-workflow` · auto-issue renewal · request missing docs · process | Temporal + MCP |

### Dept 6 · Billing & Collections

| Type | Use case | Key components |
|---|---|---|
| H1 | `payment-failure-with-policy-rag` · LSTM churn + RAG cites collection regulations | LSTM + collection RAG |
| H2 | `check-image-fraud-cv-rag` · CNN check tamper detect + RAG retrieves bank policies | CNN + bank policy RAG |
| H3 | `invoice-line-item-segmentation-rag` · YOLO on invoice + RAG retrieves vendor-cost benchmarks | YOLO + cost RAG |
| H4 | `collections-multimodal` · payment hx + call sentiment + invoice OCR + RAG policy | full stack |
| H5 | `agentic-collections-workflow` · agent dunning · escalate · payment plan · with audit | Temporal + MCP |

### Dept 7 · Claims

| Type | Use case | Key components |
|---|---|---|
| H1 | **F1 · `claim-adjudication-rag`** (canonical from §90) · XGB + Chroma + LLM | per §90 |
| H2 | **F2 · `damage-photo-rag`** (canonical) · CNN + OEM repair manual | per §90 |
| H3 | **F3 · `roof-seg-cost-rag`** (canonical) · U-Net + RS Means cost | per §90 |
| H4 | **F4 · `claim-multimodal-assistant`** (canonical) · all 4 stacks | per §90 |
| H5 | **F5 · `agentic-claim-workflow`** (canonical) · 10-layer agentic | per §90 |

### Dept 8 · SIU / Fraud

| Type | Use case | Key components |
|---|---|---|
| H1 | `fraud-score-with-case-rag` · XGBoost + RAG retrieves similar prior fraud cases | XGB + case law RAG |
| H2 | `document-tamper-cv-rag` · ELA-CNN + RAG retrieves forgery patterns | CNN + forgery RAG |
| H3 | `injury-photo-segmentation-rag` · U-Net body parts + RAG retrieves medical billing codes | U-Net + ICD RAG |
| H4 | `fraud-multimodal-investigation` · GNN ring + photos + transcripts + RAG SIU playbook | GNN + full stack |
| H5 | `agentic-siu-investigation-workflow` · open case · gather evidence · interview · decide | Temporal + MCP + LLM |

### Dept 9 · Customer Service / Contact Center

| Type | Use case | Key components |
|---|---|---|
| H1 | `cs-routing-with-policy-rag` · classifier + RAG retrieves coverage rules | DistilBERT + policy RAG |
| H2 | `voice-emotion-rag` · audio CNN + RAG retrieves de-escalation playbooks | Wav2Vec + playbook RAG |
| H3 | `screenshot-troubleshoot-cv-rag` · YOLO UI element + RAG retrieves help articles | YOLO + KB RAG |
| H4 | `cs-multimodal-resolution` · transcript + sentiment + screenshot + RAG KB | full stack |
| H5 | **agentic-cs-workflow** · agent triage · diagnose · resolve · escalate with audit | Temporal + MCP |

### Dept 10 · Actuarial

| Type | Use case | Key components |
|---|---|---|
| H1 | `loss-ratio-forecast-rag` · Prophet + RAG retrieves regulatory loss-cost guidance | Prophet + reg RAG |
| H2 | `mortality-table-cv-rag` · OCR mortality PDFs + RAG retrieves industry analogs | TrOCR + analog RAG |
| H3 | n/a (Actuarial is mostly tabular) | — |
| H4 | `actuarial-multimodal-bayes` · Bayesian + reg docs + market data + RAG | Bayesian + RAG |
| H5 | `agentic-rate-filing-workflow` · agent collects data · runs sims · generates filing | Temporal + MCP + LLM |

### Dept 11 · Reinsurance

| Type | Use case | Key components |
|---|---|---|
| H1 | `treaty-pricing-with-treaty-rag` · XGB + RAG retrieves treaty terms | XGB + treaty RAG |
| H2 | `satellite-cat-detection-rag` · CNN on satellite imagery + RAG retrieves exposure maps | ResNet + GIS RAG |
| H3 | `aerial-cat-segmentation-rag` · U-Net damage area + RAG retrieves treaty exposure | U-Net + treaty RAG |
| H4 | `reinsurance-multimodal-portfolio` · TFT forecast + satellite + treaty + RAG | full stack |
| H5 | `agentic-treaty-renewal-workflow` · agent gathers exposure · negotiates · binds treaty | Temporal + MCP |

### Dept 12 · Compliance & Regulatory Affairs

| Type | Use case | Key components |
|---|---|---|
| H1 | `compliance-score-with-reg-rag` · XGB + RAG retrieves applicable regs | XGB + reg.gov RAG |
| H2 | `signature-page-OCR-rag` · TrOCR + RAG retrieves filing requirements | TrOCR + filing RAG |
| H3 | n/a | — |
| H4 | `compliance-multimodal-filing` · numeric + filings + emails + RAG regs | full stack |
| H5 | `agentic-compliance-workflow` · agent monitors regs · drafts response · files | Temporal + MCP + LLM |

### Dept 13 · Legal

| Type | Use case | Key components |
|---|---|---|
| H1 | `legal-risk-score-rag` · XGB + RAG retrieves precedent cases | XGB + caselaw RAG |
| H2 | `contract-OCR-clause-rag` · LayoutLM + RAG retrieves precedent clauses | LayoutLM + precedent RAG |
| H3 | `contract-redline-segmentation-rag` · token-class + RAG retrieves boilerplate | NER + boilerplate RAG |
| H4 | `legal-multimodal-review` · doc + image + history + RAG | full stack |
| H5 | `agentic-legal-review-workflow` · agent reads contracts · flags risks · drafts redlines | Temporal + MCP |

### Dept 14 · Finance & Accounting

| Type | Use case | Key components |
|---|---|---|
| H1 | `expense-classification-rag` · XGB + RAG retrieves company expense policy | XGB + policy RAG |
| H2 | `receipt-OCR-rag` · TrOCR + RAG retrieves vendor master | TrOCR + vendor RAG |
| H3 | `dashboard-screenshot-cv-rag` · YOLO chart + RAG retrieves report templates | YOLO + template RAG |
| H4 | `finance-multimodal-audit` · journal + receipts + emails + RAG policy | full stack |
| H5 | `agentic-month-end-close-workflow` · agent runs close steps · reconciles · drafts variance commentary | Temporal + MCP + LLM |

### Dept 15 · Enterprise Risk Management (ERM)

| Type | Use case | Key components |
|---|---|---|
| H1 | `risk-register-scoring-rag` · XGB + RAG retrieves prior incidents | XGB + incident RAG |
| H2 | `risk-assessment-image-rag` · ResNet on assessment photos + RAG retrieves rubric | ResNet + rubric RAG |
| H3 | n/a | — |
| H4 | `erm-multimodal-emerging-risk` · text + news + market + RAG | NLP + RAG |
| H5 | `agentic-risk-monitoring-workflow` · agent monitors signals · escalates · creates response plan | Temporal + MCP |

### Dept 16 · Human Resources

| Type | Use case | Key components |
|---|---|---|
| H1 | `attrition-prediction-rag` · XGB + RAG retrieves HR policy + retention playbook | XGB + HR RAG |
| H2 | `resume-screening-cv-rag` · LayoutLM resume parse + RAG matches job description | LayoutLM + JD RAG |
| H3 | n/a | — |
| H4 | `hiring-multimodal` · resume + video interview + assessment + RAG | full stack |
| H5 | `agentic-hiring-workflow` · agent screens · schedules · coordinates panels · sends offers | Temporal + MCP |

### Dept 17 · Procurement & Vendor Management

| Type | Use case | Key components |
|---|---|---|
| H1 | `vendor-risk-score-rag` · XGB + RAG retrieves contract terms | XGB + contract RAG |
| H2 | `invoice-OCR-match-rag` · TrOCR + RAG retrieves PO master | TrOCR + PO RAG |
| H3 | `vendor-floor-cv-rag` · YOLO inventory + RAG retrieves SKU pricing | YOLO + SKU RAG |
| H4 | `procurement-multimodal-sourcing` · RFP + financials + sentiment + RAG | full stack |
| H5 | `agentic-vendor-onboarding-workflow` · agent collects docs · verifies · onboards | Temporal + MCP |

### Dept 18 · Data, Analytics & Enterprise Intelligence

| Type | Use case | Key components |
|---|---|---|
| H1 | `data-anomaly-with-lineage-rag` · IsoForest + RAG retrieves data dictionary | IsoForest + lineage RAG |
| H2 | `dashboard-error-cv-rag` · CV detects broken viz + RAG retrieves config | YOLO + config RAG |
| H3 | n/a | — |
| H4 | `analytics-multimodal-insight` · numeric + chart screenshots + commentary + RAG | full stack |
| H5 | `agentic-analytics-workflow` · agent monitors KPIs · investigates anomalies · drafts brief | Temporal + MCP |

### Dept 19 · IT / Cloud / Infrastructure

| Type | Use case | Key components |
|---|---|---|
| H1 | `incident-severity-rag` · XGB + RAG retrieves runbook | XGB + runbook RAG |
| H2 | `network-topology-cv-rag` · CV on Grafana screenshots + RAG retrieves architecture diagrams | CV + arch RAG |
| H3 | n/a | — |
| H4 | `it-multimodal-incident` · logs + traces + screenshots + RAG runbook | full stack |
| H5 | `agentic-itsm-workflow` · agent triages · diagnoses · creates change request · resolves | Temporal + MCP + LLM |

### Dept 20 · Cybersecurity / Identity / Fraud Defense

| Type | Use case | Key components |
|---|---|---|
| H1 | `threat-score-with-cve-rag` · XGB + RAG retrieves CVE database + MITRE ATT&CK | XGB + threat RAG |
| H2 | `phishing-image-cv-rag` · CNN on email screenshots + RAG retrieves campaign IoCs | CNN + IoC RAG |
| H3 | n/a | — |
| H4 | `cyber-multimodal-investigation` · packet + logs + screenshots + RAG playbook | full stack |
| H5 | `agentic-incident-response-workflow` · agent contains · investigates · communicates · remediates | Temporal + MCP |

### Dept 21 · Sales / Distribution / Broker / Agency Partner

| Type | Use case | Key components |
|---|---|---|
| H1 | `broker-quota-rag` · XGB + RAG retrieves contract terms | XGB + contract RAG |
| H2 | `agent-photo-id-rag` · CNN + RAG retrieves KYC requirements | CNN + KYC RAG |
| H3 | n/a | — |
| H4 | `partner-multimodal-onboarding` · forms + photos + interviews + RAG compliance | full stack |
| H5 | `agentic-partner-management-workflow` · agent monitors KPIs · escalates issues · contracts | Temporal + MCP |

### Dept 22 · Product Management, Innovation & Digital Products

| Type | Use case | Key components |
|---|---|---|
| H1 | `feature-prioritization-rag` · XGB + RAG retrieves customer feedback | XGB + feedback RAG |
| H2 | `prototype-screenshot-cv-rag` · CV on Figma + RAG retrieves design system | CV + DS RAG |
| H3 | n/a | — |
| H4 | `product-multimodal-research` · numeric + screenshots + interviews + RAG | full stack |
| H5 | `agentic-discovery-workflow` · agent runs interviews · synthesizes themes · drafts PRDs | Temporal + MCP + LLM |

---

## Roll-up: hybrid coverage per dept

| Dept | H1 | H2 | H3 | H4 | H5 | Total |
|---|---|---|---|---|---|---|
| 1 Product Mgmt | ✓ | ✓ | — | ✓ | ✓ | 4 |
| 3 Sales | ✓ | ✓ | — | ✓ | ✓ | 4 |
| 4 Underwriting | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 5 Policy Admin | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 6 Billing | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| **7 Claims (canonical)** | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 8 SIU | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 9 CS | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 10 Actuarial | ✓ | ✓ | — | ✓ | ✓ | 4 |
| 11 Reinsurance | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 12 Compliance | ✓ | ✓ | — | ✓ | ✓ | 4 |
| 13 Legal | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 14 Finance | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 15 ERM | ✓ | ✓ | — | ✓ | ✓ | 4 |
| 16 HR | ✓ | ✓ | — | ✓ | ✓ | 4 |
| 17 Procurement | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 18 Analytics | ✓ | ✓ | — | ✓ | ✓ | 4 |
| 19 IT | ✓ | ✓ | — | ✓ | ✓ | 4 |
| 20 Cyber | ✓ | ✓ | — | ✓ | ✓ | 4 |
| 21 Partner | ✓ | ✓ | — | ✓ | ✓ | 4 |
| 22 Product Innovation | ✓ | ✓ | — | ✓ | ✓ | 4 |

**Total**: **94 concrete hybrid use cases** mapped across 21 depts (5 type slots × 21 depts = 105 max · 11 marked "n/a" because that hybrid type doesn't fit the dept's data shape).

H3 (CV+RAG) is sparse because some depts have no pixel-level data (Actuarial · ERM · HR · Analytics · IT · etc.). H1+H2+H4+H5 apply universally.

## Per use case mandatory subsections (per §90.3)

Every cell above MUST have ALL 22 subsections from §90.3 when implemented:

10 top-level: use-case · architecture · data download · planning · HP tuning · noise handling · scheduling · prod gates · §refs · domain mapping

12 G-subsections: G1 preprocessing · G2 EDA · G3 SMOTE+balance · G4 feature eng/selection · G5 cleaning · G6 quality scoring · G7 statistical · G8 subjective · G9 sensitivity · G10 ResAI 5-pillar · G11 ExpAI · G12 DB+VectorDB pipeline

Use `scripts/generate_use_case_stubs.py` (modified per project) to scaffold any of the 94 cells.

## Composes with

§38.3 · §39 (RAG production) · §47.4 (baggage propagation) · §48 (XAI MANDATORY) · §64.40 (H5 10-layer agentic stack) · §64.43 · §64.44 · §74 · §75 · §76 (RAI 5-pillar) · §79 (RAG production catalog) · §80 (agentic 13-phase) · §87 (vector ingest cron MANDATORY) · §88 (default testing) · §90 (this is the per-dept expansion of §90 Block F).
