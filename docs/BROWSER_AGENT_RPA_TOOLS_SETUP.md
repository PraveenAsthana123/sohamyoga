# Browser / Agent / RPA Tool Setup · §91 alternates + complements

> Per operator 2026-06-08: "setup tool ..browser use, skyvern oss, ui-tras, openadapt, opminparser [OmniParser], openhands, agentops oss sdk"

Each tool below complements the canonical §91 stack (WebLLM + CDP + RAG + LangGraph) at a different layer. **Pick by use case** · not all need to be installed at once.

## At-a-glance comparison

| Tool | Layer | License | Best for | Replaces |
|---|---|---|---|---|
| **Browser-Use** | CDP agent · Playwright wrapper | MIT (OSS) | LLM-driven browser automation w/ vision | CDP raw bindings |
| **Skyvern OSS** | RPA browser agent · vision-first | AGPL-3.0 | Enterprise RPA w/ LLM fallback | UiPath / Automation Anywhere |
| **UI-TARS** | Vision-language model for GUI | Apache-2.0 (model) | OCR-free UI understanding | OmniParser + CV stack |
| **OpenAdapt** | Desktop+browser process recorder/replayer | MIT (OSS) | Record human workflows for training | Manual scripting · Macro recorders |
| **OmniParser** | Parses GUI screenshots → structured DOM | MIT (OSS · Microsoft) | Feeds vision-language agents | Manual DOM extraction |
| **OpenHands** | Autonomous coding agent · CodeAct framework | MIT (OSS) | Multi-step coding tasks · DevOps | Cursor / Cline |
| **AgentOps OSS SDK** | Agent observability / trace / cost | MIT (OSS) | Production agent monitoring | Langfuse · Phoenix |

---

## 1. Browser-Use

**Stack position**: drop-in alternative to raw CDP (cdp_manager.py from §91).

```bash
# Backend install
pip install browser-use playwright
playwright install chromium  # ~120 MB

# Or via uv:
uv pip install browser-use
```

### Integration pattern (replaces §91 cdp_manager.py)

```python
# backend/webllm_cdp_rag_langgraph/cdp_manager_browseruse.py
from browser_use import Agent, Browser
from langchain_openai import ChatOpenAI

async def navigate_and_extract(goal: str, url: str):
    browser = Browser()
    agent = Agent(
        task=f"Go to {url} and {goal}",
        llm=ChatOpenAI(model="gpt-4o-mini"),  # or LiteLLM proxy
        browser=browser,
    )
    result = await agent.run()
    return result
```

### Composing with §91

- Use Browser-Use INSTEAD of raw CDP for higher-level interactions
- Continue using LangGraph for orchestration
- WebLLM bridge still serves LLM-in-browser inference

### Top-1% gates

- Per-action audit row (§38.3) wraps Browser-Use task execution
- Per-tenant browser session isolation (§41.3)
- Screenshot DLP per §76 (G14 edge cases)

---

## 2. Skyvern OSS

**Stack position**: full RPA replacement · LLM + vision agent · production-grade.

```bash
# Docker (recommended)
git clone https://github.com/Skyvern-AI/skyvern.git
cd skyvern
docker compose up -d

# Verify
curl http://localhost:8000/api/v1/tasks
```

### Integration pattern (alongside §91)

```python
# Skyvern as a fallback tool when WebLLM+CDP cannot complete a task
import httpx

async def skyvern_task(url: str, navigation_goal: str):
    resp = await httpx.AsyncClient().post(
        "http://localhost:8000/api/v1/tasks",
        json={"url": url, "navigation_goal": navigation_goal},
    )
    return resp.json()
```

### When to use

| Use Skyvern when... | Use §91 (Browser-Use/CDP) when... |
|---|---|
| Need RPA workflow w/ scheduling | Realtime interactive agent |
| Complex multi-form filling | Single-page query |
| Visual-only websites (no API) | Standard HTML |
| Production scale + audit | Prototyping / one-off |

---

## 3. UI-TARS (ByteDance)

**Stack position**: Vision-language model · replaces OCR+CV stack · understands UI directly.

```bash
# Model weights (HuggingFace · ~7B parameters)
git lfs install
git clone https://huggingface.co/bytedance-research/UI-TARS-7B-DPO ~/models/ui-tars

# Serve via vLLM
pip install vllm
python -m vllm.entrypoints.openai.api_server \
  --model ~/models/ui-tars \
  --port 8002 \
  --max-model-len 8192
```

### Integration pattern

```python
# backend/webllm_cdp_rag_langgraph/ui_tars_client.py
from openai import OpenAI

ui_tars = OpenAI(base_url="http://localhost:8002/v1", api_key="dummy")

async def parse_screenshot(screenshot_b64: str, instruction: str) -> dict:
    """UI-TARS converts a screenshot + instruction into actionable coordinates."""
    response = ui_tars.chat.completions.create(
        model="ui-tars",
        messages=[
            {"role": "system", "content": "You are a GUI agent."},
            {"role": "user", "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"}},
                {"type": "text", "text": instruction}
            ]}
        ]
    )
    return response.choices[0].message.content
```

### Composing with §91

- Replace OmniParser + Tesseract OCR in `cdp_manager.py.extract_dom()`
- UI-TARS returns `(action, x, y)` tuples directly
- Far better than LLM + OCR + manual coordinate calculation

### Top-1% gates

- Per-screenshot DLP scan before sending to UI-TARS
- Action confidence threshold ≥ 0.7 · else HITL
- §38.3 audit row includes prompt + image hash + action

---

## 4. OpenAdapt

**Stack position**: process recorder · captures human workflows for agent training.

```bash
pip install openadapt
openadapt record  # starts recording desktop + browser
# Perform a workflow manually
openadapt visualize  # see the captured trajectory
openadapt replay  # auto-replay (LLM-augmented)
```

### Integration pattern

```python
# backend/webllm_cdp_rag_langgraph/openadapt_replay.py
from openadapt.records import get_latest_recording
from openadapt.replay import ReplayManager

def replay_for_learning(recording_id: int):
    """Replay a captured human workflow as agent training data."""
    recording = get_latest_recording(recording_id)
    manager = ReplayManager(strategy="LLM")
    manager.replay(recording)
    return manager.audit_log
```

### When to use

- Train agents via demonstration (no labeled data needed)
- Capture compliance/audit-required workflows
- Build domain-specific agent datasets

### Composing with §91

- OpenAdapt feeds RAG with operator-recorded workflows
- LangGraph DAG can call OpenAdapt for hard tasks ("learn from this demo")

---

## 5. OmniParser (Microsoft)

**Stack position**: parses GUI screenshots into structured representation · pre-processing for vision agents.

```bash
git clone https://github.com/microsoft/OmniParser.git
cd OmniParser
pip install -r requirements.txt

# Download weights
huggingface-cli download microsoft/OmniParser \
  --local-dir ./weights/

# Serve via FastAPI wrapper
python serve.py --port 8003
```

### Integration pattern

```python
# backend/webllm_cdp_rag_langgraph/omniparser_client.py
import httpx

async def parse_screenshot(screenshot_b64: str) -> list[dict]:
    """Returns list of {bbox, label, description, type} per UI element."""
    response = await httpx.AsyncClient().post(
        "http://localhost:8003/parse",
        json={"image_b64": screenshot_b64},
    )
    return response.json()["elements"]
```

### Composing with §91

- Run BEFORE WebLLM reasoning · gives WebLLM structured DOM-equivalent
- Faster than full OCR · 50x smaller than UI-TARS

### When to use vs UI-TARS

| OmniParser | UI-TARS |
|---|---|
| Structured output (bbox + labels) | End-to-end action prediction |
| Small (~200 MB) | Large (~7 GB) |
| CPU-friendly | Needs GPU |
| Use as pre-processor | Use as action predictor |

---

## 6. OpenHands

**Stack position**: autonomous coding agent · for multi-step DevOps/code tasks.

```bash
# Docker (recommended for sandboxing)
docker pull docker.all-hands.dev/all-hands-ai/openhands:0.10
docker run -it --rm \
  -p 3000:3000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --add-host host.docker.internal:host-gateway \
  -e SANDBOX_RUNTIME_CONTAINER_IMAGE=docker.all-hands.dev/all-hands-ai/runtime:0.10-nikolaik \
  --name openhands-app \
  docker.all-hands.dev/all-hands-ai/openhands:0.10

# Open http://localhost:3000
```

### Integration pattern

```python
# backend/webllm_cdp_rag_langgraph/openhands_client.py
import httpx

async def delegate_to_openhands(task: str) -> dict:
    """For agentic tasks that involve code execution + multi-step planning."""
    resp = await httpx.AsyncClient().post(
        "http://localhost:3000/api/conversation",
        json={"message": task, "language": "python"},
    )
    return resp.json()
```

### When to use

- Multi-step code generation/execution
- Server administration tasks
- Code review + refactoring agents
- DevOps automation

### Composing with §91

- §91 handles browser tasks · OpenHands handles code tasks
- LangGraph DAG can dispatch to either based on goal classification

---

## 7. AgentOps OSS SDK

**Stack position**: observability / tracing / cost monitoring across all the above tools.

```bash
pip install agentops

# Get API key (free tier · no auth needed for OSS endpoints)
export AGENTOPS_API_KEY="dev"
```

### Integration pattern

```python
# backend/webllm_cdp_rag_langgraph/agentops_decorators.py
import agentops
from agentops import track_agent, record_tool

agentops.init(default_tags=["webllm-cdp-rag-langgraph"])

@track_agent(name="claim-validation-agent")
class ClaimValidationAgent:
    @record_tool(tool_name="cdp_navigate")
    async def navigate(self, url):
        # Calls cdp_manager.navigate
        pass

    @record_tool(tool_name="webllm_prompt")
    async def reason(self, prompt):
        # Calls web_llm_bridge.prompt
        pass
```

### What you get

- Per-agent execution trace · drill-down into each tool call
- Cost tracking (token counts · LLM dollar cost)
- Latency per node in LangGraph DAG
- Error rates · retry counts
- Export to OTel · Datadog · Honeycomb

### Composing with §91

- Wrap LangGraph DAG nodes with `@record_tool` decorator
- AgentOps dashboard becomes the §88 reporting-notification-agent surface
- Cost + latency feed into §82.7 drift monitoring

---

## Recommended integration matrix

| §91 layer | Default | OSS alternative |
|---|---|---|
| LLM (in-browser) | WebLLM (Llama-3.1-8B-MLC) | — (browser-only · no swap) |
| LLM (server fallback) | Ollama/vLLM | OpenAI · Anthropic via LiteLLM |
| Browser control | CDP raw + Playwright | **Browser-Use** OR **Skyvern** OR **OpenHands** |
| Vision parsing | (none in §91 default) | **OmniParser** OR **UI-TARS** |
| Agent orchestration | LangGraph | CrewAI · AutoGen · LangChain |
| Retrieval | Chroma | Qdrant · Weaviate · pgvector |
| Workflow durability | Postgres checkpointer | Temporal |
| Observability | (none in §91 default) | **AgentOps** · Langfuse · Phoenix · OpenLLMetry |
| Process recording | (manual) | **OpenAdapt** |

## Per-tool readiness checklist

| Tool | Install | Server needed | GPU | License | Production-ready |
|---|---|---|---|---|---|
| Browser-Use | `pip install browser-use playwright` | No | No (or 4 GB for vision) | MIT | ✓ |
| Skyvern OSS | docker compose up | Yes (port 8000) | No | AGPL-3.0 | ✓ |
| UI-TARS | vLLM serve | Yes (port 8002) | Yes (16 GB VRAM) | Apache-2.0 | ⚠️ Beta |
| OpenAdapt | `pip install openadapt` | No | No | MIT | ⚠️ Alpha |
| OmniParser | python serve.py | Yes (port 8003) | Optional (faster) | MIT | ✓ |
| OpenHands | docker run | Yes (port 3000) | No | MIT | ✓ |
| AgentOps SDK | `pip install agentops` | No (cloud) OR self-host | No | MIT | ✓ |

## Adoption order (operator recommendation)

1. **AgentOps SDK first** · zero risk · gives you observability into the rest you add
2. **Browser-Use** · lower-friction replacement for raw CDP for ~80% of use cases
3. **OmniParser** · adds vision capability cheap
4. **Skyvern** · when ready for full RPA workflows w/ scheduling
5. **OpenAdapt** · for compliance-recorded workflows + training data
6. **UI-TARS** · when GPU available and OCR-free vision needed
7. **OpenHands** · for code-agent tasks separate from browser-agent tasks

---

# Hybrid use cases · per-department · operator-readable table

> Per operator: "how many hybrid usecase ..which you map by department ...give me list in table"

## 5 hybrid types (recap)

| Type | Stack |
|---|---|
| **H1** | ML + RAG (XGBoost + Vector DB + LLM with citations) |
| **H2** | DL + RAG (CNN/RNN + Vector DB + LLM) |
| **H3** | CV + RAG (Segmentation/Detection + Vector DB + LLM) |
| **H4** | ML + CV + NLP + RAG (multi-modal claim assistant) |
| **H5** | Agentic + RAG + MCP + Workflow (§64.40 10-layer + Temporal) |

## Per-department coverage · 21 depts × 5 types = 94 mapped cells

| Dept ID | Dept Name | H1 | H2 | H3 | H4 | H5 | Total |
|---|---|---|---|---|---|---|---|
| 1 | Product Management | ✓ | ✓ | — | ✓ | ✓ | **4** |
| 3 | Sales & Distribution | ✓ | ✓ | — | ✓ | ✓ | **4** |
| 4 | Underwriting | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 5 | Policy Administration | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 6 | Billing & Collections | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| **7** | **Claims (canonical)** | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 8 | SIU / Fraud | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 9 | Customer Service | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 10 | Actuarial | ✓ | ✓ | — | ✓ | ✓ | **4** |
| 11 | Reinsurance | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 12 | Compliance & Regulatory | ✓ | ✓ | — | ✓ | ✓ | **4** |
| 13 | Legal | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 14 | Finance & Accounting | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 15 | Enterprise Risk Mgmt (ERM) | ✓ | ✓ | — | ✓ | ✓ | **4** |
| 16 | Human Resources | ✓ | ✓ | — | ✓ | ✓ | **4** |
| 17 | Procurement & Vendor Mgmt | ✓ | ✓ | ✓ | ✓ | ✓ | **5** |
| 18 | Data & Analytics | ✓ | ✓ | — | ✓ | ✓ | **4** |
| 19 | IT / Cloud / Infrastructure | ✓ | ✓ | — | ✓ | ✓ | **4** |
| 20 | Cybersecurity / Fraud Defense | ✓ | ✓ | — | ✓ | ✓ | **4** |
| 21 | Sales / Broker / Agency Partner | ✓ | ✓ | — | ✓ | ✓ | **4** |
| 22 | Product Innovation & Digital | ✓ | ✓ | — | ✓ | ✓ | **4** |
| **TOTAL** | **21 depts** | **21** | **21** | **10** | **21** | **21** | **94** |

## Coverage interpretation

| Hybrid type | Depts using | % of 21 |
|---|---|---|
| H1 (ML + RAG) | 21 | **100%** |
| H2 (DL + RAG) | 21 | **100%** |
| H4 (Full multi-modal) | 21 | **100%** |
| H5 (Agentic + RAG + MCP + Workflow) | 21 | **100%** |
| H3 (CV + RAG) | 10 | **48%** |

**H3 is sparse** because depts with no pixel data (Actuarial · Compliance · ERM · HR · Analytics · IT · Cyber · Partner · Product Innovation) can't use CV.

## Top 5 most-covered depts (5/5)

1. **Dept 7 Claims** — canonical · all 5 hybrid types (see §90 Block F)
2. **Dept 4 Underwriting** — pricing + photo + reg-citations + counterfactual + agent
3. **Dept 5 Policy Administration** — policy LLM + signature CV + segmentation + multi-modal renewal + agentic
4. **Dept 6 Billing & Collections** — payment seq + check CV + invoice CV + multi-modal collections + agentic dunning
5. **Dept 8 SIU** — fraud score + tampering CV + injury seg + GNN multi-modal + investigation agent

## Complete cell list

For per-cell specifics (algorithm · key data · pipeline) see [`docs/HYBRID_USE_CASES_PER_DEPARTMENT.md`](HYBRID_USE_CASES_PER_DEPARTMENT.md) which has all 94 cells with architecture + pipeline + workflow tool callouts.

## Composes with

§39 (RAG architecture) · §47 (architecture · 4-layer rollback) · §48 (XAI · citations mandatory) · §64.40 (H5 agentic stack) · §64.43 #5 Blackboard + #10 Reflection · §64.44 (tool inventory · this doc extends it) · §76 (RAI 5-pillar) · §79 (RAG production catalog) · §80 (agentic 13-phase) · §87 (vector ingest cron) · §88 (default testing) · §90 (Block F) · §91 (WebLLM+CDP+RAG+LangGraph stack as default H5 substrate).
