# UI-TARS · ByteDance vision-language model

Apache-2.0 · 7B parameters · OCR-free GUI understanding · needs 16GB GPU.

| File | Purpose |
|---|---|
| `deep/docs/setup.md` | GPU + git-lfs + vLLM |
| `deep/examples/` | Screenshot → action prediction |
| `deep/scripts/install.sh` | Clone model + serve via vLLM |
| `deep/backend/` | OpenAI-compatible client wrapper |

## Install
`./scripts/setup_ai_agent_stack.sh --tool ui-tars`
