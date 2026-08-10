# Anthropic Superpowers · Agentic Methodology

Claude Code skill framework · brainstorming · TDD · debugging · planning skills · also a plugin marketplace

License: MIT (Anthropic) · Port: none · Env: ANTHROPIC_API_KEY

## Install (universal · preferred)

```bash
./scripts/setup_ai_agent_stack.sh --tool superpowers
```

Or per-tool:

```bash
./ai-agents/superpowers/deep/scripts/install.sh
```

Or manually: `/plugin marketplace add claude-code/anthropic-superpowers + per-skill installation`

## Deep dive

[`deep/docs/DEEP_DIVE.md`](deep/docs/DEEP_DIVE.md)

## Composes with

§43 (drill discipline · spec → drill loop) · §44 (autonomous loop · spec drives iteration) · §47 (architecture · ADRs are specs) · §57 (production-grade discipline · spec-first) · §59 (TDDD/DDD/ORF/MDD design approaches) · §74 (ML lifecycle · phases ARE specs) · §90 (mandatory use cases · each is a spec) · §91.

## Existing references in this repo

Anthropic Superpowers plugin is referenced extensively in [`~/.claude/CLAUDE.md`](~/.claude/CLAUDE.md) under "Available Workflows" + global §20 "Recommended Claude Code Plugins".

Install via Claude Code plugin marketplace:
```
/plugin marketplace add claude-code/anthropic-superpowers
```

Per skill (e.g. brainstorming, TDD, debugging, planning, code-reviewer):
```
/plugin install superpowers:<skill-name>
```
