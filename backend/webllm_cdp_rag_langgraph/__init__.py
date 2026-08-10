"""WebLLM + CDP + RAG + LangGraph integration package.

Per operator 2026-06-08 + docs/WEBLLM_CDP_RAG_LANGGRAPH_INTEGRATION.md.
Composes with §38.3 · §39 · §47 · §48 · §64.40 · §64.43 · §74 · §75 · §76 ·
§79 · §80 · §82.21 · §87 · §88 · §90.

Modules:
- langgraph_dag · stateful agent state machine
- cdp_manager · Chrome DevTools Protocol wrapper
- rag_service · Chroma + retrieval
- web_llm_bridge · WebSocket bridge to browser WebLLM
- schemas · Pydantic models
- router · FastAPI routes
"""
