# BMAD (Build-Measure-Analyze-Deploy) · Agentic Methodology

Iterative agentic dev cycle · already present in repo at _bmad/ · operator-tailored agent council pattern

License: — · Port: none · Env: see _bmad/scripts/

## Install (universal · preferred)

```bash
./scripts/setup_ai_agent_stack.sh --tool bmad
```

Or per-tool:

```bash
./ai-agents/bmad/deep/scripts/install.sh
```

Or manually: `see _bmad/ for reference impl`

## Deep dive

[`deep/docs/DEEP_DIVE.md`](deep/docs/DEEP_DIVE.md)

## Composes with

§43 (drill discipline · spec → drill loop) · §44 (autonomous loop · spec drives iteration) · §47 (architecture · ADRs are specs) · §57 (production-grade discipline · spec-first) · §59 (TDDD/DDD/ORF/MDD design approaches) · §74 (ML lifecycle · phases ARE specs) · §90 (mandatory use cases · each is a spec) · §91.

## Existing reference impl in this repo

This repo already has BMAD scaffolding at [`_bmad/`](../../_bmad/). Use this `ai-agents/bmad/` folder for §91-stack integration notes, deep-dive on the BMAD loop, and cross-project portability.

See [`_bmad/scripts/`](../../_bmad/scripts/) for the actual BMAD config + customization logic.
