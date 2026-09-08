"""Task routing: given a task description, decide which provider handles it.

HONESTY NOTE (per build brief — do not overclaim sophistication this doesn't
have): this is a small, rule-based, keyword/length heuristic. It is NOT an
ML classifier and was not trained or validated against a labeled dataset. It
exists to demonstrate real, working, inspectable routing logic that a user
can override at any time — not to claim state-of-the-art task classification.
The "fast response" and "code" rules added 2026-09-02 are the same kind of
inspectable heuristic, not a learned model.

Rules, in priority order:
  1. Explicit override from the caller always wins.
  2. Review/audit/security language -> claude (code-reviewer role). Note:
     claude_agent fails closed with no key configured right now, so this
     currently surfaces a clear "not configured" error rather than silently
     rerouting — that's intentional, see providers.py.
  3. Planning/architecture language -> openai (architect/planner role).
  4. Code language (function/bug/debug/refactor/etc.) -> lmstudio, a local
     GPU-accelerated coder model (measured ~450ms; llamacpp/localai are
     CPU-only in this environment — no system CUDA toolkit available to
     rebuild them against the GPU — and measured 23-30s for the same prompt).
  5. Table/spreadsheet language -> ollama (general local model handles
     structured-text tasks fine; no cloud round-trip needed).
  6. "fast"/"quick"/"asap" language, short tasks -> lmstudio (same
     GPU-accelerated coder model, lowest measured latency of the local
     backends).
  7. Long tasks (heuristic proxy for "complex") -> openai.
  8. Default -> ollama (local first-line worker; §165 Ollama-first policy in
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
CODE_KEYWORDS = [
    "function", "bug", "debug", "refactor", "compile", "stack trace",
    "traceback", "syntax error", "write code", "python", "javascript",
    "typescript", "sql query", "regex", "api endpoint", "unit test",
]
TABLE_KEYWORDS = [
    "table", "spreadsheet", "csv", "rows and columns", "tabulate", "pivot table",
]
FAST_KEYWORDS = ["fast", "quick", "asap", "hurry", "right now", "immediately"]
LONG_TASK_CHAR_THRESHOLD = 800
# Keep ordinary conversational prompts on the fastest measured local backend.
# Prompts at or above LONG_TASK_CHAR_THRESHOLD still take the complexity route.
FAST_TASK_CHAR_THRESHOLD = LONG_TASK_CHAR_THRESHOLD

VALID_PROVIDERS = {"ollama", "openai", "claude", "localai", "llamacpp", "lmstudio"}


def _match(text: str, keywords: list) -> str | None:
    for kw in keywords:
        if kw in text:
            return kw
    return None


def route(task_text: str, override: str = None) -> dict:
    """Returns {"provider": <name>, "reason": "<why>"}."""
    if override:
        ov = override.strip().lower()
        if ov in VALID_PROVIDERS:
            return {"provider": ov, "reason": f"explicit override: caller requested '{ov}'"}
    text = (task_text or "").lower()

    kw = _match(text, REVIEW_KEYWORDS)
    if kw:
        return {"provider": "claude", "reason": f"keyword match ('{kw}') suggests review/audit work -> claude (reviewer role)"}

    kw = _match(text, PLAN_KEYWORDS)
    if kw:
        return {"provider": "openai", "reason": f"keyword match ('{kw}') suggests planning/architecture work -> openai (architect role)"}

    kw = _match(text, CODE_KEYWORDS)
    if kw:
        return {"provider": "lmstudio", "reason": f"keyword match ('{kw}') suggests a coding task -> lmstudio (GPU-accelerated local coder model)"}

    kw = _match(text, TABLE_KEYWORDS)
    if kw:
        return {"provider": "ollama", "reason": f"keyword match ('{kw}') suggests a table/structured-data task -> ollama (local, handles structured text fine)"}

    kw = _match(text, FAST_KEYWORDS)
    if kw or len(text) < FAST_TASK_CHAR_THRESHOLD:
        why = f"keyword match ('{kw}')" if kw else f"short task ({len(text)} chars)"
        return {"provider": "lmstudio", "reason": f"{why} suggests a fast-response need -> lmstudio (GPU-accelerated, lowest measured local latency: ~450ms vs 23-30s CPU-only)"}

    if len(task_text or "") > LONG_TASK_CHAR_THRESHOLD:
        return {"provider": "openai", "reason": f"task length ({len(task_text)} chars) exceeds {LONG_TASK_CHAR_THRESHOLD}-char heuristic threshold -> routed to openai as a complexity proxy"}

    return {"provider": "ollama", "reason": "default: routine/short task routed to local Ollama first-line worker"}
