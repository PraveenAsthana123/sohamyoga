# AUTOMATIC1111 SD WebUI · Image Generation

Stable Diffusion WebUI · most extensions · LoRA · ControlNet · plugin ecosystem

License: AGPL-3 · Port: 7860 · Env: none

## Install (universal · preferred)

```bash
./scripts/setup_ai_agent_stack.sh --tool stable-diffusion-webui
```

Or per-tool:

```bash
./ai-agents/stable-diffusion-webui/deep/scripts/install.sh
```

Or manually: `git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui && cd stable-diffusion-webui && bash webui.sh`

## Deep dive

[`deep/docs/DEEP_DIVE.md`](deep/docs/DEEP_DIVE.md) — 8-section per-tool deep dive.

## Composes with

§47 (architecture) · §64.40 (10-layer agentic) · §76 (RAI · privacy + safety) · §82.19 (ResAI) · §88.4 G18 (communication channels) · §90 (catalog) · §91 (WebLLM+CDP+RAG+LangGraph as agent host).
