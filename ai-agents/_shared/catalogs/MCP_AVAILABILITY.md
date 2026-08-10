# MCP Server Availability per Tool · ai-agents/ catalog

> Per operator 2026-06-08: "check if these domain tools have mCP as well ..give me table output"
> Audit date: 2026-06-08. **Source of truth**: [modelcontextprotocol.io/servers](https://modelcontextprotocol.io/servers) + per-tool docs/github.

## Confidence legend

| Symbol | Meaning |
|---|---|
| **✓ Official** | Vendor-provided OR Anthropic-official MCP server |
| **🟡 Community** | 3rd-party MCP exists · less stable · check before depending |
| **❌ None known** | No MCP at audit time · use direct API or adapter |
| **🔶 Indirect** | No native MCP but tool exposed via SQL / HTTP / generic MCP wrapper |

## 1. §91 core stack (4 tools)

| Tool | MCP? | Source | Notes |
|---|---|---|---|
| **webllm** | ❌ None | — | Browser-side runtime · not server-callable · MCP doesn't apply |
| **cdp** (Chrome DevTools Protocol) | **✓ Official** | [Microsoft `playwright-mcp`](https://github.com/microsoft/playwright-mcp) | Wraps CDP / Playwright as MCP server |
| **rag** (Chroma) | 🟡 Community | [`mcp-chroma`](https://github.com/chroma-core/chroma/tree/main/chromadb/mcp) experimental | Chroma team has experimental MCP |
| **langgraph** | ❌ None (host) | — | LangGraph is the orchestrator · it CALLS MCP servers · doesn't expose itself as one |

## 2. Agent / RPA OSS (7 tools)

| Tool | MCP? | Source | Notes |
|---|---|---|---|
| **browser-use** | ❌ None | — | Use via subprocess or REST · alternative: playwright-mcp |
| **skyvern** | ❌ None | — | REST API at port 8000 · wrap in custom MCP if needed |
| **ui-tars** | 🟡 Community | OpenAI-compatible endpoint via vLLM | Any OpenAI-compatible client works |
| **openadapt** | ❌ None | — | Python lib · use as adapter |
| **omniparser** | ❌ None | — | HTTP endpoint · wrap in MCP |
| **openhands** | 🔶 Indirect | OpenHands has its own agent framework | Not MCP-native · uses CodeAct |
| **agentops** | ❌ None | — | SDK pattern · decorators · no MCP needed |

## 3. Voice / Audio (11 tools)

| Tool | MCP? | Source | Notes |
|---|---|---|---|
| **pipecat** | ❌ None | — | Python framework · embeds tools rather than exposing as MCP |
| **livekit** | ❌ None | — | LiveKit Agents SDK is not MCP-native · uses its own plugin system |
| **retell-ai** | ❌ None | SaaS REST API only | Wrap in custom MCP server |
| **vapi** | ❌ None | SaaS REST API only | Wrap in custom MCP server |
| **coqui-tts** | ❌ None | — | Python CLI / lib · wrap |
| **cartesia** | ❌ None | SaaS REST API | Wrap in MCP if you need |
| **piper-tts** | ❌ None | — | CLI / lib · wrap |
| **elevenlabs** | **✓ Official** | [`elevenlabs-mcp`](https://github.com/elevenlabs/elevenlabs-mcp) | Official ElevenLabs MCP server (released early 2026) |
| **deepgram** | 🟡 Community | Deepgram REST has MCP wrappers in HF spaces · not official | Wrap their SDK |
| **assemblyai** | 🟡 Community | Same as Deepgram pattern | Wrap their SDK |
| **speechbrain** | ❌ None | — | Research toolkit · wrap |

## 4. Image generation / editing (5 tools)

| Tool | MCP? | Source | Notes |
|---|---|---|---|
| **gimp** | ❌ None | — | Desktop app · use Script-Fu / Python-Fu for automation |
| **fooocus** | ❌ None | — | Web UI · wrap with REST adapter |
| **invokeai** | 🟡 Community | InvokeAI has REST API · community MCPs exist | Has REST API at :9090/api |
| **stable-diffusion-webui** | 🟡 Community | [Several](https://github.com/AUTOMATIC1111/stable-diffusion-webui/discussions) wrappers · `sdwebui-mcp` etc. | A1111 has API · community MCP |
| **comfyui** | 🟡 Community | [`comfyui-mcp-server`](https://github.com/joenorton/comfyui-mcp-server) community impl | Has REST API · several community MCPs exist |

## 5. Survey / Forms (5 tools)

| Tool | MCP? | Source | Notes |
|---|---|---|---|
| **limesurvey** | ❌ None | — | LimeSurvey RemoteControl JSON-RPC · wrap |
| **formbricks** | ❌ None | — | REST API · wrap |
| **surveyjs** | ❌ None | — | JS library · client-side · no server to MCP |
| **ohmyform** | ❌ None | — | REST API · wrap |
| **yakforms** | ❌ None | — | REST API · wrap |

## 6. Email / Newsletter / Marketing (7 tools)

| Tool | MCP? | Source | Notes |
|---|---|---|---|
| **listmonk** | ❌ None | — | REST API at :9000/api/ · wrap |
| **postal** | ❌ None | — | Mail server · SMTP + REST · wrap |
| **mailtrain** | ❌ None | — | REST API at :3000/api/ · wrap |
| **keila** | ❌ None | — | REST API · wrap |
| **sendportal** | ❌ None | — | REST API · wrap |
| **mautic** | 🟡 Community | Some experimental Mautic-MCP exist on GitHub | Has OAuth2 REST API · stable target for MCP |
| **dittofeed** | ❌ None | — | REST API at :3000 · wrap |

## 7. Analytics · BI · Workflow · Social (4 tools · NEW)

| Tool | MCP? | Source | Notes |
|---|---|---|---|
| **matomo** | ❌ None | — | REST + JSON API · wrap |
| **metabase** | 🔶 Indirect | Anthropic-official [`postgres-mcp` / `sqlite-mcp`](https://github.com/modelcontextprotocol/servers) | Metabase queries SQL · use SQL-MCP servers instead |
| **activepieces** | 🔶 Indirect | Activepieces IS workflow-automation (Zapier-like) · doesn't need MCP · CAN call MCP servers as steps | It's an MCP host candidate |
| **mixpost** | ❌ None | — | Self-host social tool · REST + OAuth |

## Summary

| Category | Total tools | ✓ Official MCP | 🟡 Community MCP | 🔶 Indirect (SQL/HTTP) | ❌ None | % covered |
|---|---|---|---|---|---|---|
| §91 core | 4 | 1 | 1 | 0 | 2 | 50% |
| Agent/RPA | 7 | 0 | 1 | 1 | 5 | 29% |
| Voice/Audio | 11 | 1 | 2 | 0 | 8 | 27% |
| Image gen | 5 | 0 | 3 | 0 | 2 | 60% |
| Survey/Forms | 5 | 0 | 0 | 0 | 5 | 0% |
| Email/Marketing | 7 | 0 | 1 | 0 | 6 | 14% |
| Analytics/BI/Workflow | 4 | 0 | 0 | 2 | 2 | 50% |
| **TOTAL** | **43** | **2** | **8** | **3** | **30** | **30% MCP-reachable** |

## Tools with ✓ Official MCP (2)

| Tool | Repo | Quick start |
|---|---|---|
| **cdp** | `microsoft/playwright-mcp` | `npx -y @playwright/mcp@latest` |
| **elevenlabs** | `elevenlabs/elevenlabs-mcp` | `pip install elevenlabs-mcp` |

## Tools with strong 🟡 community MCP (8 viable)

- **rag** (Chroma) · experimental MCP from Chroma team
- **ui-tars** · via OpenAI-compatible client
- **stable-diffusion-webui** · `sdwebui-mcp` community
- **comfyui** · `comfyui-mcp-server` community
- **invokeai** · community wrappers
- **deepgram** · community wrappers
- **assemblyai** · community wrappers
- **mautic** · experimental community

## Tools that COMPOSE with MCP without being MCP servers (3)

- **metabase** · use `postgres-mcp` or `sqlite-mcp` against the same DB Metabase queries
- **activepieces** · IS the workflow host · CAN call MCP servers as workflow steps · MCP client not MCP server
- **openhands** · own CodeAct framework · use direct integration

## Tools needing a custom MCP wrapper (30)

For these tools you need a small custom MCP server: ~50 lines of Python that wraps their existing REST/CLI/SDK behind the MCP protocol. Pattern:

```python
# Custom MCP wrapper template (~50 lines) for any REST tool
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("my-tool-mcp")

@mcp.tool()
def my_action(input: str) -> str:
    """Wraps tool's REST endpoint as MCP tool."""
    # ... call tool's REST · return result
    return result

if __name__ == "__main__":
    mcp.run()
```

Reference impl: `~/.claude/templates/webllm-cdp-rag-langgraph/mcp-wrapper-template/` (TODO).

## Recommendations

| Goal | What to do |
|---|---|
| **Need MCP NOW for browser** | Use `playwright-mcp` (replaces CDP wrapper) |
| **Need MCP NOW for voice/TTS** | Use `elevenlabs-mcp` |
| **Need MCP NOW for DB/BI** | Use Anthropic `postgres-mcp` or `sqlite-mcp` |
| **Want MCP for any other tool** | Write 50-line wrapper using `mcp.server.fastmcp` |
| **MCP discovery** | Browse [modelcontextprotocol.io/servers](https://modelcontextprotocol.io/servers) before building |

## Composes with

§64.40 (10-layer agentic · MCP is layer 6/7 substrate) · §64.43 #5 Blackboard pattern · §64.44 (tool inventory · MCP availability fits here) · §88 G18 (testing matrix · MCP testing class) · §90 · §91 (LangGraph DAG can call MCP servers as tools).

## Caveat

MCP ecosystem is fast-moving (mid-2026). Re-audit quarterly. Reference: [modelcontextprotocol.io/servers](https://modelcontextprotocol.io/servers) catalog is the authoritative list.

## 8. Spec-Driven Development Frameworks (5 tools · added 2026-06-08)

| Tool | MCP? | Source | Notes |
|---|---|---|---|
| **gsd** | ❌ None | — | CLI tool · methodology · wrap via subprocess if agent needs to drive spec gen |
| **bmad** | ❌ None | — | In-repo `_bmad/` config-based; resolve_config.py provides JSON output usable by any agent |
| **spec-kit** | ❌ None | — | GitHub framework · YAML contracts · CLI-driven · wrap if needed |
| **superpowers** | 🔶 Indirect | Anthropic Claude Code plugin (not MCP server) | Skills load into Claude itself, NOT exposed as MCP · accessible only inside Claude Code |
| **openspec** | ❌ None | — | CLI tool · operates on spec files · subprocess wrap |

### Why none of these have MCP servers

These are **methodology frameworks** that operate on files (specs / YAML / config) — not RPC services. They make more sense AS clients OF MCP servers (e.g., spec-kit calls postgres-mcp to validate spec → DB schema match) than AS MCP servers themselves.

### Updated coverage summary

| Category | Total | ✓ Official | 🟡 Community | 🔶 Indirect | ❌ None | % covered |
|---|---|---|---|---|---|---|
| §91 core | 4 | 1 | 1 | 0 | 2 | 50% |
| Agent/RPA | 7 | 0 | 1 | 1 | 5 | 29% |
| Voice/Audio | 11 | 1 | 2 | 0 | 8 | 27% |
| Image gen | 5 | 0 | 3 | 0 | 2 | 60% |
| Survey/Forms | 5 | 0 | 0 | 0 | 5 | 0% |
| Email/Marketing | 7 | 0 | 1 | 0 | 6 | 14% |
| Analytics/BI/Workflow | 4 | 0 | 0 | 2 | 2 | 50% |
| **Spec-Driven Dev** | **5** | **0** | **0** | **1** | **4** | **20%** |
| **TOTAL** | **48** | **2** | **8** | **4** | **34** | **29% MCP-reachable** |
