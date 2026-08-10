# Responsible AI Checklist · Gnn Fraud Ring Detection

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
