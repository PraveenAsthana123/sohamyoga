"""Multi-agent supervisor using LangGraph.

Coordinator routes tasks to specialized sub-agents:
- content_agent   : generates/adapts social media content via Ollama
- analytics_agent : summarizes platform analytics data
- review_agent    : classifies and responds to reviews via sentiment analysis
- scheduling_agent: picks optimal post times from analytics
- research_agent  : (planned) web research + RAG retrieval

Architecture
------------
1. SupervisorNode reads the task and picks the best sub-agent.
2. The chosen sub-agent runs its LangChain tools.
3. Results bubble back to the supervisor for a final synthesis response.

Graceful degradation
--------------------
- If Ollama is unreachable, every agent node returns a structured error dict
  rather than raising an exception — the API layer converts this to a 200
  response with {status: "ollama_unavailable"} so the frontend can show a
  helpful message instead of a 500.
- If LANGCHAIN_API_KEY is not set, LangSmith tracing is silently disabled
  (no crash, no log spam).
"""

import json
import os
import time
from typing import Annotated, Any, Literal, TypedDict

import httpx
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_ollama import ChatOllama

from .tools import (
    adapt_content_for_platform,
    analyze_platform_performance,
    classify_review_sentiment,
    generate_social_post,
    get_best_posting_time,
)

# ---------------------------------------------------------------------------
# LangSmith — enabled only when the key is present (no crash if missing)
# ---------------------------------------------------------------------------

try:
    import langsmith  # type: ignore[import-not-found]

    _LS_AVAILABLE = True
except ImportError:
    _LS_AVAILABLE = False

_OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
_OLLAMA_MODEL = "llama3.2"


# ---------------------------------------------------------------------------
# LangGraph state
# ---------------------------------------------------------------------------


class AgentState(TypedDict):
    """Shared state passed through the LangGraph graph.

    Fields
    ------
    task : str
        The original user task description.
    context : dict
        Any additional context key-value pairs provided by the caller.
    chosen_agent : str
        Which sub-agent the supervisor selected.
    agent_output : str
        The raw output from the chosen sub-agent.
    final_output : str
        The supervisor-synthesised final response.
    error : str | None
        Non-None if an unrecoverable error occurred.
    langsmith_run_id : str | None
        Run ID returned by LangSmith if tracing is enabled.
    """

    task: str
    context: dict
    chosen_agent: str
    agent_output: str
    final_output: str
    error: str | None
    langsmith_run_id: str | None


# ---------------------------------------------------------------------------
# Helper — call Ollama without the LangChain wrapper (used for supervisor routing)
# ---------------------------------------------------------------------------


def _call_ollama_raw(prompt: str, system: str = "") -> str:
    """Direct Ollama call for the supervisor routing step.

    Returns '__OLLAMA_DOWN__' if the server is unreachable so callers can
    branch gracefully.

    Args:
        prompt: Task description passed to the model.
        system: Optional system message.

    Returns:
        Model response string.
    """
    payload: dict[str, Any] = {
        "model": _OLLAMA_MODEL,
        "prompt": f"{system}\n\n{prompt}" if system else prompt,
        "stream": False,
    }
    try:
        resp = httpx.post(f"{_OLLAMA_BASE}/api/generate", json=payload, timeout=60.0)
        resp.raise_for_status()
        return resp.json().get("response", "").strip()
    except httpx.ConnectError:
        return "__OLLAMA_DOWN__"
    except Exception as exc:
        return f"__OLLAMA_ERROR__: {exc}"


# ---------------------------------------------------------------------------
# Sub-agent runner — wraps each tool set as an agent node function
# ---------------------------------------------------------------------------


def _content_agent_run(task: str, context: dict) -> str:
    """Run the content agent — generate or adapt social posts.

    Args:
        task: Natural language task description.
        context: Optional dict with keys like platform, topic, source_platform.

    Returns:
        Generated content string.
    """
    platform = context.get("platform", "instagram")
    topic = context.get("topic", task)
    source_platform = context.get("source_platform")

    if source_platform:
        original_content = context.get("content", task)
        target_platform = context.get("target_platform", platform)
        return adapt_content_for_platform.invoke(  # type: ignore[attr-defined]
            {"content": original_content, "source_platform": source_platform, "target_platform": target_platform}
        )
    return generate_social_post.invoke(  # type: ignore[attr-defined]
        {"platform": platform, "topic": topic, "tone": context.get("tone", "professional")}
    )


def _analytics_agent_run(task: str, context: dict) -> str:
    """Run the analytics agent — summarise platform performance.

    Args:
        task: Natural language task description.
        context: Optional dict with keys like platform, days.

    Returns:
        JSON string of analytics summary.
    """
    platform = context.get("platform", "instagram")
    days = int(context.get("days", 7))
    perf = analyze_platform_performance.invoke({"platform": platform, "days": days})  # type: ignore[attr-defined]
    timing = get_best_posting_time.invoke({"platform": platform})  # type: ignore[attr-defined]
    return json.dumps({"performance": perf, "best_time": timing}, default=str)


def _review_agent_run(task: str, context: dict) -> str:
    """Run the review agent — classify sentiment and generate a response.

    Args:
        task: Natural language task description.
        context: Optional dict with key 'text' containing the review.

    Returns:
        JSON string with sentiment classification and suggested response.
    """
    text = context.get("text", task)
    result = classify_review_sentiment.invoke({"text": text})  # type: ignore[attr-defined]
    return json.dumps(result, default=str)


def _scheduling_agent_run(task: str, context: dict) -> str:
    """Run the scheduling agent — find best posting windows.

    Args:
        task: Natural language task description.
        context: Optional dict with key 'platform'.

    Returns:
        JSON string with posting time recommendations.
    """
    platform = context.get("platform", "instagram")
    result = get_best_posting_time.invoke({"platform": platform})  # type: ignore[attr-defined]
    return json.dumps(result, default=str)


# Map agent names to their runner functions
_AGENT_RUNNERS: dict[str, Any] = {
    "content_agent": _content_agent_run,
    "analytics_agent": _analytics_agent_run,
    "review_agent": _review_agent_run,
    "scheduling_agent": _scheduling_agent_run,
}


# ---------------------------------------------------------------------------
# LangGraph node functions
# ---------------------------------------------------------------------------


def supervisor_node(state: AgentState) -> AgentState:
    """Supervisor node — routes the task to the most appropriate sub-agent.

    Uses Ollama to classify the task intent. Falls back to content_agent
    if Ollama is unreachable.

    Args:
        state: Current graph state.

    Returns:
        Updated state with chosen_agent populated.
    """
    system = (
        "You are a task router for a digital marketing AI platform for a yoga studio. "
        "Given a task description, choose the best agent to handle it.\n\n"
        "Available agents:\n"
        "- content_agent: writing social media posts, generating captions, adapting content\n"
        "- analytics_agent: performance data, metrics, analytics summaries, reach/engagement stats\n"
        "- review_agent: customer reviews, sentiment, review responses\n"
        "- scheduling_agent: best time to post, posting schedule, calendar planning\n\n"
        "Reply with ONLY the agent name — nothing else."
    )
    response = _call_ollama_raw(state["task"], system)
    if response.startswith("__OLLAMA"):
        # Graceful fallback — default to content_agent
        chosen = "content_agent"
    else:
        # Extract just the agent name from potentially verbose response
        chosen = "content_agent"
        for name in _AGENT_RUNNERS:
            if name in response.lower():
                chosen = name
                break
    return {**state, "chosen_agent": chosen}


def agent_node(state: AgentState) -> AgentState:
    """Runs the sub-agent selected by the supervisor node.

    Args:
        state: Current graph state with chosen_agent populated.

    Returns:
        Updated state with agent_output populated.
    """
    agent_name = state.get("chosen_agent", "content_agent")
    runner = _AGENT_RUNNERS.get(agent_name, _content_agent_run)
    try:
        output = runner(state["task"], state.get("context", {}))
    except Exception as exc:
        output = json.dumps({
            "status": "agent_error",
            "agent": agent_name,
            "error": str(exc),
        })
    return {**state, "agent_output": str(output)}


def synthesis_node(state: AgentState) -> AgentState:
    """Synthesises the sub-agent output into a final user-facing response.

    Keeps the agent output as-is if Ollama is unavailable — the raw output
    is still useful, just not polished.

    Args:
        state: Current graph state with agent_output populated.

    Returns:
        Updated state with final_output populated.
    """
    system = (
        "You are a helpful AI assistant for a yoga studio. "
        "Summarise and present the following agent output clearly to the user."
    )
    prompt = (
        f"Task: {state['task']}\n\n"
        f"Agent ({state.get('chosen_agent', 'unknown')}) output:\n{state['agent_output']}\n\n"
        "Provide a clear, helpful summary for the user."
    )
    response = _call_ollama_raw(prompt, system)
    if response.startswith("__OLLAMA"):
        final = state["agent_output"]
    else:
        final = response
    return {**state, "final_output": final}


# ---------------------------------------------------------------------------
# Build and run the LangGraph supervisor graph
# ---------------------------------------------------------------------------


def _build_graph():  # type: ignore[return]
    """Build the LangGraph StateGraph.

    Returns:
        Compiled graph or None if langgraph is not installed.
    """
    try:
        from langgraph.graph import END, START, StateGraph  # type: ignore[import-not-found]
    except ImportError:
        return None

    graph = StateGraph(AgentState)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("agent", agent_node)
    graph.add_node("synthesis", synthesis_node)

    graph.add_edge(START, "supervisor")
    graph.add_edge("supervisor", "agent")
    graph.add_edge("agent", "synthesis")
    graph.add_edge("synthesis", END)

    return graph.compile()


# Module-level compiled graph — None if langgraph not installed
_GRAPH = _build_graph()


def run_supervisor(task: str, context: dict | None = None) -> dict:
    """Entry point — run the full supervisor pipeline for a task.

    Uses LangGraph if available, falls back to a direct sequential call
    so the system works without langgraph installed.

    Args:
        task: Natural language task description.
        context: Optional structured context (platform, topic, etc.).

    Returns:
        Dict with keys: chosen_agent, agent_output, final_output,
        latency_ms, langsmith_run_id (if tracing enabled).
    """
    ctx = context or {}
    t0 = time.time()

    initial_state: AgentState = {
        "task": task,
        "context": ctx,
        "chosen_agent": "",
        "agent_output": "",
        "final_output": "",
        "error": None,
        "langsmith_run_id": None,
    }

    if _GRAPH is not None:
        # LangGraph path
        final_state = _GRAPH.invoke(initial_state)
    else:
        # Fallback sequential path
        s = supervisor_node(initial_state)
        s = agent_node(s)
        s = synthesis_node(s)
        final_state = s

    latency_ms = int((time.time() - t0) * 1000)

    return {
        "chosen_agent": final_state.get("chosen_agent", "unknown"),
        "agent_output": final_state.get("agent_output", ""),
        "final_output": final_state.get("final_output", ""),
        "latency_ms": latency_ms,
        "langsmith_run_id": final_state.get("langsmith_run_id"),
        "error": final_state.get("error"),
    }
