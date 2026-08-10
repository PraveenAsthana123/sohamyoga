# Mautic · Marketing Automation

OSS marketing automation · multi-channel (email/SMS/web) · drip campaigns · lead scoring

License: GPL-3 · Port: 8080 · Env: DB + SMTP

## Install (universal · preferred)

```bash
./scripts/setup_ai_agent_stack.sh --tool mautic
```

Or per-tool:

```bash
./ai-agents/mautic/deep/scripts/install.sh
```

Or manually: `docker run -p 8080:80 mautic/mautic`

## Deep dive

[`deep/docs/DEEP_DIVE.md`](deep/docs/DEEP_DIVE.md) — 8-section per-tool deep dive.

## Composes with

§47 (architecture) · §64.40 (10-layer agentic) · §76 (RAI · privacy + safety) · §82.19 (ResAI) · §88.4 G18 (communication channels) · §90 (catalog) · §91 (WebLLM+CDP+RAG+LangGraph as agent host).
