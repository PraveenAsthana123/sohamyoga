# Pipeline Checklist · Adversarial Robustness Evaluator

> Per §90 G12 mandatory subsection · Data → DB → Vector DB pipeline.

## Storage layers (per §90.5)

| Stage | DB / Storage | Table / Bucket | Schema notes |
|---|---|---|---|
| Raw data | Postgres | `adversarial-robustness-evaluator_raw` | PII classified per §76 · retention = audit |
| Cleaned data | Postgres | `adversarial-robustness-evaluator_clean` | post-G5 cleaning |
| Features | Feast OR Postgres | `adversarial-robustness-evaluator_features` | versioned |
| Predictions | Postgres | `adversarial-robustness-evaluator_predictions` | audit-linked · 7-year retention |
| Embeddings | Vector DB | source = `adversarial-robustness-evaluator_predictions` | Chroma / Qdrant / pgvector |
| Audit rows | Postgres | `user_input_events` + `audit_rows` | per §87.2 |
| Model artifacts | MLflow | registry · model_name = `adversarial-robustness-evaluator` | versioned |
| Explanations | S3/MinIO | bucket `/explanations/adversarial-robustness-evaluator/` | referenced in audit row |

## Mandatory cron jobs (per §90.5)

| Cron tag | Schedule | Script | Purpose |
|---|---|---|---|
| `INSUR-ADVERSARIAL_ROBUSTNESS_EVALUATOR-VECTOR-INGEST` | `*/15 * * * *` | `scripts/vector_ingest.py` | embeddings → vector DB |
| `INSUR-ADVERSARIAL_ROBUSTNESS_EVALUATOR-CRASH-RECOVERY-SCAN` | `*/15 * * * *` | `scripts/crash_recovery_scan.py` | find incomplete records · resume |
| `INSUR-ADVERSARIAL_ROBUSTNESS_EVALUATOR-DRIFT-CHECK` | `0 * * * *` | per-use-case drift script | data + concept drift |
| `INSUR-ADVERSARIAL_ROBUSTNESS_EVALUATOR-RAG-REINDEX` (if RAG) | `0 3 * * 1` | per-corpus reindex | weekly |
| `INSUR-ADVERSARIAL_ROBUSTNESS_EVALUATOR-RETRAIN` | `0 3 * * 1` | per-model retrain | weekly |
| `INSUR-ADVERSARIAL_ROBUSTNESS_EVALUATOR-HITL-AUDIT` | `0 9 * * *` | sample HITL · feed retrain | daily |
| `INSUR-ADVERSARIAL_ROBUSTNESS_EVALUATOR-FAIRNESS-AUDIT` | `0 9 * * 1` | per-cohort metrics | weekly |
| `INSUR-ADVERSARIAL_ROBUSTNESS_EVALUATOR-COST-REPORT` | `0 8 * * 1` | per §88 area #5 | weekly |

## Per-prediction artifact contract (per §87 + §90)

Every prediction MUST write:

1. **Input** payload → `adversarial-robustness-evaluator_raw` (redacted per §76)
2. **Process** trace → OTel span tree (correlation_id = request_id per §47.4)
3. **Output** payload → `adversarial-robustness-evaluator_predictions`
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
- [ ] Drift cron produces JSON output to `data/eval/adversarial-robustness-evaluator/drift/`
