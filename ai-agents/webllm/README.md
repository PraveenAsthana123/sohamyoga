# WebLLM · in-browser LLM via WebGPU

Browser-native LLM inference. Zero server cost · zero data egress.
Per §91. Full content in [`deep/`](deep/).

| File | Purpose |
|---|---|
| `deep/frontend/useWebLLM.js` | React hook · dynamic import of @mlc-ai/web-llm · IndexedDB cache |
| `deep/docs/` | Architecture · model selection · troubleshooting |
| `deep/examples/` | Sample prompts · streaming · chat |
| `deep/scripts/` | Model download · warm-up |
| `deep/tests/` | Unit + integration |

## Install
`npm install @mlc-ai/web-llm`

## Composes with
[CDP](../cdp/) · [RAG](../rag/) · [LangGraph](../langgraph/) — the §91 4-stack.
