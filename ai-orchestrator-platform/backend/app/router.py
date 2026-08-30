"""Task routing: given a task description, decide Ollama vs OpenAI vs Claude.

HONESTY NOTE (per build brief — do not overclaim sophistication this doesn't
have): this is a small, rule-based, keyword/length heuristic. It is NOT an
ML classifier and was not trained or validated against a labeled dataset. It
exists to demonstrate real, working, inspectable routing logic that a user
can override at any time — not to claim state-of-the-art task classification.

Rules, in priority order:
  1. Explicit override from the caller always wins.
  2. Review/audit/security language -> claude (code-reviewer role). Note:
     claude_agent fails closed with no key configured right now, so this
     currently surfaces a clear "not configured" error rather than silently
     rerouting — that's intentional, see providers.py.
  3. Planning/architecture language -> openai (architect/planner role).
  4. Long tasks (heuristic proxy for "complex") -> openai.
  5. Default -> ollama (local first-line worker; §165 Ollama-first policy in
     agentic-ollama-platform).
"""
import re

REVIEW_KEYWORDS = [
    "review", "audit", "security", "vulnerability", "vulnerabilities",
    "risk assessment", "code review", "correctness", "is this safe",
]
PLAN_KEYWORDS = [
    "architecture", "architect", "design a", "design the", "roadmap",
    "strategy", "plan for", "planning", "high-level approach", "trade-off", "tradeoff",
]
LONG_TASK_CHAR_THRESHOLD = 800

VALID_PROVIDERS = {"ollama", "openai", "claude"}


def route(task_text: str, override: str = None) -> dict:
    """Returns {"provider": "ollama"|"openai"|"claude", "reason": "<why>"}."""
    if override:
        ov = override.strip().lower()
        if ov in VALID_PROVIDERS:
            return {"provider": ov, "reason": f"explicit override: caller requested '{ov}'"}
    text = (task_text or "").lower()

    for kw in REVIEW_KEYWORDS:
        if kw in text:
            return {"provider": "claude", "reason": f"keyword match ('{kw}') suggests review/audit work -> claude (reviewer role)"}

    for kw in PLAN_KEYWORDS:
        if kw in text:
            return {"provider": "openai", "reason": f"keyword match ('{kw}') suggests planning/architecture work -> openai (architect role)"}

    if len(task_text or "") > LONG_TASK_CHAR_THRESHOLD:
        return {"provider": "openai", "reason": f"task length ({len(task_text)} chars) exceeds {LONG_TASK_CHAR_THRESHOLD}-char heuristic threshold -> routed to openai as a complexity proxy"}

    return {"provider": "ollama", "reason": "default: routine/short task routed to local Ollama first-line worker"}
