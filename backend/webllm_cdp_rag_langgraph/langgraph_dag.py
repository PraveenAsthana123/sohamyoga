"""LangGraph DAG · plan → navigate → rag → reason → verify → hitl.

Skeleton · production needs full TypedDict state and PostgresCheckpointer.
"""
from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)

try:
    from langgraph.graph import StateGraph, END
    from typing import TypedDict, Annotated
    from operator import add
    _LG_OK = True
except ImportError:
    _LG_OK = False


def build_dag(cdp, rag, webllm_bridge):
    """Return a compiled LangGraph DAG. Caller invokes via dag.ainvoke(...)."""
    if not _LG_OK:
        raise RuntimeError("langgraph not installed: pip install langgraph")

    class AgentState(TypedDict, total=False):
        goal: str
        url: str
        plan: list[str]
        extracted_dom: dict
        rag_chunks: list[dict]
        recommendation: str
        hitl_approved: bool
        audit_log: Annotated[list[dict], add]

    async def plan(state: AgentState) -> dict:
        out = await webllm_bridge.prompt(
            f"Decompose goal into 3-5 steps: {state['goal']}"
        )
        return {"plan": out.split("\n"), "audit_log": [{"step": "plan", "out": out}]}

    async def navigate(state: AgentState) -> dict:
        await cdp.navigate(state["url"])
        dom = await cdp.extract_dom()
        screenshot = await cdp.screenshot()
        return {
            "extracted_dom": dom,
            "audit_log": [{"step": "navigate", "url": state["url"],
                          "screenshot_b64_len": len(screenshot)}]
        }

    async def rag_retrieve(state: AgentState) -> dict:
        query = state["goal"]
        chunks = rag.retrieve(query, top_k=10)
        return {"rag_chunks": chunks,
                "audit_log": [{"step": "rag", "n_chunks": len(chunks)}]}

    async def reason(state: AgentState) -> dict:
        ctx = "\n".join([c.get("text", "")[:200] for c in state.get("rag_chunks", [])])
        prompt = f"""Goal: {state.get('goal')}
Context: {ctx}
Generate recommendation grounded in context. Cite chunk IDs."""
        rec = await webllm_bridge.prompt(prompt, max_tokens=1024)
        return {"recommendation": rec,
                "audit_log": [{"step": "reason", "rec_len": len(rec)}]}

    async def verify(state: AgentState) -> dict:
        # In production: extract citations from rec, check against chunk IDs
        rec = state.get("recommendation", "")
        is_valid = len(rec) > 10 and "[FAILED" not in rec
        return {"audit_log": [{"step": "verify", "valid": is_valid}]}

    async def hitl(state: AgentState) -> dict:
        # In production: wait on Postgres hitl_queue
        return {"hitl_approved": True,
                "audit_log": [{"step": "hitl", "decision": "auto-approve-skeleton"}]}

    g = StateGraph(AgentState)
    g.add_node("plan", plan)
    g.add_node("navigate", navigate)
    g.add_node("rag_retrieve", rag_retrieve)
    g.add_node("reason", reason)
    g.add_node("verify", verify)
    g.add_node("hitl", hitl)

    g.add_edge("plan", "navigate")
    g.add_edge("navigate", "rag_retrieve")
    g.add_edge("rag_retrieve", "reason")
    g.add_edge("reason", "verify")
    g.add_edge("verify", "hitl")
    g.add_edge("hitl", END)
    g.set_entry_point("plan")

    return g.compile()
