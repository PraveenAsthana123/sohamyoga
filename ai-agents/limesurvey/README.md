# LimeSurvey · Survey/Forms

OSS survey tool · advanced logic · 80+ question types · multi-language · LDAP

License: GPL-2 · Port: 8080 · Env: DB creds

## Install (universal · preferred)

```bash
./scripts/setup_ai_agent_stack.sh --tool limesurvey
```

Or per-tool:

```bash
./ai-agents/limesurvey/deep/scripts/install.sh
```

Or manually: `docker run -p 8080:8080 -e DBENGINE=MyISAM adamzammit/limesurvey`

## Deep dive

[`deep/docs/DEEP_DIVE.md`](deep/docs/DEEP_DIVE.md) — 8-section per-tool deep dive.

## Composes with

§47 (architecture) · §64.40 (10-layer agentic) · §76 (RAI · privacy + safety) · §82.19 (ResAI) · §88.4 G18 (communication channels) · §90 (catalog) · §91 (WebLLM+CDP+RAG+LangGraph as agent host).
