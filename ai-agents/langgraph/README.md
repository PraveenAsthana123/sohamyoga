# LangGraph · Stateful Agent DAG

Plan → Navigate → RAG → Reason → Verify → HITL. Per §64.43 #5 Blackboard + #10 Reflection.

| File | Purpose |
|---|---|
| `deep/backend/langgraph_dag.py` | 6-node DAG (canonical N1 per §91) |
| `deep/backend/router.py` | FastAPI `/api/v1/webllm-agent/{ws,run,health}` |
| `deep/backend/web_llm_bridge.py` | WebSocket bridge browser ↔ backend |
| `deep/backend/schemas.py` | Pydantic models |
| `deep/frontend/WebLLMAgentPanel.jsx` | Operator UI (3 status pills + audit feed) |
| `deep/docs/` | DAG patterns · checkpointer · HITL gates |
| `deep/examples/` | Sample DAGs · ReAct · reflection loops |
| `deep/scripts/` | Postgres checkpointer setup |
| `deep/tests/` | DAG node unit + integration |

## Install
`pip install langgraph langchain langchain-community`
