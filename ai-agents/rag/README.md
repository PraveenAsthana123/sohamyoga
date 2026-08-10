# RAG · Retrieval-Augmented Generation

Chroma multi-tenant retrieval. Per §39 (RAG architecture) + §79 (production RAG catalog · 7-pillar) + §91.

| File | Purpose |
|---|---|
| `deep/backend/rag_service.py` | Chroma wrapper · tenant-scoped retrieval |
| `deep/docs/` | Chunking strategy · embedding model selection · eval (Ragas) |
| `deep/examples/` | Indexing + querying samples |
| `deep/scripts/` | Vector ingest cron (per §87.4) |
| `deep/tests/` | Retrieval precision @ K |

## Install
`pip install chromadb sentence-transformers`
