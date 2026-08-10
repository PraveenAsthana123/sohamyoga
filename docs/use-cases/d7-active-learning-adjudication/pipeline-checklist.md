# Pipeline Checklist · Active Learning Adjudication

> Per §90 G12 mandatory subsection · Data → DB → Vector DB pipeline.

## Storage layers (per §90.5)

| Stage | DB / Storage | Table / Bucket | Schema notes |
|---|---|---|---|
| Raw data | Postgres | `active-learning-adjudication_raw` | PII classified per §76 · retention = audit |
| Cleaned data | Postgres | `active-learning-adjudication_clean` | post-G5 cleaning |
| Features | Feast OR Postgres | `active-learning-adjudication_features` | versioned |
| Predictions | Postgres | `active-learning-adjudication_predictions` | audit-linked · 7-year retention |
| Embeddings | Vector DB | source = `active-learning-adjudication_predictions` | Chroma / Qdrant / pgvector |
| Audit rows | Postgres | `user_input_events` + `audit_rows` | per §87.2 |
| Model artifacts | MLflow | registry · model_name = `active-learning-adjudication` | versioned |
| Explanations | S3/MinIO | bucket `/explanations/active-learning-adjudication/` | referenced in audit row |

## Mandatory cron jobs (per §90.5)

| Cron tag | Schedule | Script | Purpose |
|---|---|---|---|
| `INSUR-ACTIVE_LEARNING_ADJUDICATION-VECTOR-INGEST` | `*/15 * * * *` | `scripts/vector_ingest.py` | embeddings → vector DB |
| `INSUR-ACTIVE_LEARNING_ADJUDICATION-CRASH-RECOVERY-SCAN` | `*/15 * * * *` | `scripts/crash_recovery_scan.py` | find incomplete records · resume |
| `INSUR-ACTIVE_LEARNING_ADJUDICATION-DRIFT-CHECK` | `0 * * * *` | per-use-case drift script | data + concept drift |
| `INSUR-ACTIVE_LEARNING_ADJUDICATION-RAG-REINDEX` (if RAG) | `0 3 * * 1` | per-corpus reindex | weekly |
| `INSUR-ACTIVE_LEARNING_ADJUDICATION-RETRAIN` | `0 3 * * 1` | per-model retrain | weekly |
| `INSUR-ACTIVE_LEARNING_ADJUDICATION-HITL-AUDIT` | `0 9 * * *` | sample HITL · feed retrain | daily |
| `INSUR-ACTIVE_LEARNING_ADJUDICATION-FAIRNESS-AUDIT` | `0 9 * * 1` | per-cohort metrics | weekly |
| `INSUR-ACTIVE_LEARNING_ADJUDICATION-COST-REPORT` | `0 8 * * 1` | per §88 area #5 | weekly |

## Per-prediction artifact contract (per §87 + §90)

Every prediction MUST write:

1. **Input** payload → `active-learning-adjudication_raw` (redacted per §76)
2. **Process** trace → OTel span tree (correlation_id = request_id per §47.4)
3. **Output** payload → `active-learning-adjudication_predictions`
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
- [ ] Drift cron produces JSON output to `data/eval/active-learning-adjudication/drift/`
