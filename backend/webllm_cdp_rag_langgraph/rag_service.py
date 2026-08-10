"""RAG service · Chroma multi-tenant wrapper."""
from __future__ import annotations
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

try:
    import chromadb
    _CHROMA_OK = True
except ImportError:
    _CHROMA_OK = False


class RAGService:
    """Thin Chroma wrapper. Per §87.4 vector ingest cron uses this."""

    def __init__(self, host: str | None = None, port: int | None = None):
        host = host or os.environ.get("CHROMA_HOST", "localhost")
        port = int(port or os.environ.get("CHROMA_PORT", "8001"))
        self.coll = None
        if not _CHROMA_OK:
            logger.warning("chromadb not installed")
            return
        try:
            client = chromadb.HttpClient(host=host, port=port)
            self.coll = client.get_or_create_collection("agent_context")
        except Exception as e:
            logger.warning(f"chroma connect failed: {e}")

    def retrieve(self, query: str, top_k: int = 10, tenant_id: str = "default") -> list[dict]:
        if not self.coll:
            return []
        try:
            results = self.coll.query(
                query_texts=[query],
                n_results=top_k,
                where={"tenant_id": tenant_id},
            )
        except Exception as e:
            logger.warning(f"chroma query failed: {e}")
            return []
        chunks = []
        for i, doc_id in enumerate(results.get("ids", [[]])[0]):
            chunks.append({
                "id": doc_id,
                "text": results["documents"][0][i],
                "score": results.get("distances", [[0.0]])[0][i],
            })
        return chunks

    def index(self, documents: list[dict], tenant_id: str = "default") -> int:
        if not self.coll or not documents:
            return 0
        self.coll.add(
            ids=[d["id"] for d in documents],
            documents=[d["text"] for d in documents],
            metadatas=[{**d.get("meta", {}), "tenant_id": tenant_id} for d in documents],
        )
        return len(documents)
