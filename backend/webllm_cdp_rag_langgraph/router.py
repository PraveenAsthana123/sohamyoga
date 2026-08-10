"""/api/v1/webllm-agent · WebLLM + CDP + RAG + LangGraph integration."""
from __future__ import annotations
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, WebSocket, Request, HTTPException

from .cdp_manager import CDPManager
from .rag_service import RAGService
from .web_llm_bridge import WebLLMBridge
from .schemas import AgentGoalRequest, AgentRunResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/webllm-agent", tags=["webllm-agent"])

_bridge = WebLLMBridge()
_rag = RAGService()


@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    """Browser connects · backend pushes prompts → WebLLM → response."""
    await _bridge.connect(ws)
    await _bridge.receive_loop()


@router.post("/run", response_model=AgentRunResponse)
async def run_agent(body: AgentGoalRequest, request: Request):
    """Trigger LangGraph DAG · uses connected WebLLM via bridge."""
    request_id = body.correlation_id or str(uuid.uuid4())
    if _bridge.ws is None:
        raise HTTPException(503, {"detail": "WebLLM not connected · open browser tab first",
                                  "error_code": "WEBLLM_NOT_CONNECTED"})
    try:
        from .langgraph_dag import build_dag
    except RuntimeError as e:
        raise HTTPException(503, {"detail": str(e), "error_code": "LANGGRAPH_NOT_INSTALLED"})

    cdp = CDPManager()
    try:
        await cdp.connect()
    except Exception as e:
        logger.warning(f"CDP not available: {e}")
        # Fallback path: run without CDP · operator wants browser-action capable
        # but degradation is acceptable for read-only use cases
        cdp = None

    dag = build_dag(cdp, _rag, _bridge)
    state = {"goal": body.goal, "url": body.url, "audit_log": []}
    try:
        result = await dag.ainvoke(state)
    finally:
        if cdp:
            await cdp.close()

    return AgentRunResponse(
        request_id=request_id,
        recommendation=result.get("recommendation", ""),
        audit_log=result.get("audit_log", []),
        hitl_required=not result.get("hitl_approved", False),
        completed=True,
    )


@router.get("/health")
async def health():
    """Self-check · per §47.8 readiness probe."""
    return {
        "status": "ok",
        "webllm_bridge_connected": _bridge.ws is not None,
        "rag_available": _rag.coll is not None,
    }
