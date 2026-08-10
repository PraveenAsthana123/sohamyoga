# Pipeline Checklist · Collaborative Agent Skill Routing

> Per §90 G12 mandatory subsection · Data → DB → Vector DB pipeline.

## Storage layers (per §90.5)

| Stage | DB / Storage | Table / Bucket | Schema notes |
|---|---|---|---|
| Raw data | Postgres | `collaborative-agent-skill-routing_raw` | PII classified per §76 · retention = audit |
| Cleaned data | Postgres | `collaborative-agent-skill-routing_clean` | post-G5 cleaning |
| Features | Feast OR Postgres | `collaborative-agent-skill-routing_features` | versioned |
| Predictions | Postgres | `collaborative-agent-skill-routing_predictions` | audit-linked · 7-year retention |
| Embeddings | Vector DB | source = `collaborative-agent-skill-routing_predictions` | Chroma / Qdrant / pgvector |
| Audit rows | Postgres | `user_input_events` + `audit_rows` | per §87.2 |
| Model artifacts | MLflow | registry · model_name = `collaborative-agent-skill-routing` | versioned |
| Explanations | S3/MinIO | bucket `/explanations/collaborative-agent-skill-routing/` | referenced in audit row |

## Mandatory cron jobs (per §90.5)

| Cron tag | Schedule | Script | Purpose |
|---|---|---|---|
| `INSUR-COLLABORATIVE_AGENT_SKILL_ROUTING-VECTOR-INGEST` | `*/15 * * * *` | `scripts/vector_ingest.py` | embeddings → vector DB |
| `INSUR-COLLABORATIVE_AGENT_SKILL_ROUTING-CRASH-RECOVERY-SCAN` | `*/15 * * * *` | `scripts/crash_recovery_scan.py` | find incomplete records · resume |
| `INSUR-COLLABORATIVE_AGENT_SKILL_ROUTING-DRIFT-CHECK` | `0 * * * *` | per-use-case drift script | data + concept drift |
| `INSUR-COLLABORATIVE_AGENT_SKILL_ROUTING-RAG-REINDEX` (if RAG) | `0 3 * * 1` | per-corpus reindex | weekly |
| `INSUR-COLLABORATIVE_AGENT_SKILL_ROUTING-RETRAIN` | `0 3 * * 1` | per-model retrain | weekly |
| `INSUR-COLLABORATIVE_AGENT_SKILL_ROUTING-HITL-AUDIT` | `0 9 * * *` | sample HITL · feed retrain | daily |
| `INSUR-COLLABORATIVE_AGENT_SKILL_ROUTING-FAIRNESS-AUDIT` | `0 9 * * 1` | per-cohort metrics | weekly |
| `INSUR-COLLABORATIVE_AGENT_SKILL_ROUTING-COST-REPORT` | `0 8 * * 1` | per §88 area #5 | weekly |

## Per-prediction artifact contract (per §87 + §90)

Every prediction MUST write:

1. **Input** payload → `collaborative-agent-skill-routing_raw` (redacted per §76)
2. **Process** trace → OTel span tree (correlation_id = request_id per §47.4)
3. **Output** payload → `collaborative-agent-skill-routing_predictions`
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
- [ ] Drift cron produces JSON output to `data/eval/collaborative-agent-skill-routing/drift/`
