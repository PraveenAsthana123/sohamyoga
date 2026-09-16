"""Agent registry — tracks all agents, their capabilities, and run history in SQLite.

Every agent run is logged here (agent_run table). Test cases and results
are stored in agent_test_case / agent_test_result tables so the admin UI
can show live pass/fail history without reading logs.
"""

import json
import os
import sqlite3
import datetime
from dataclasses import dataclass
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "../../data/agents.db")

# ---------------------------------------------------------------------------
# Agent registry — authoritative list of agents and their metadata
# ---------------------------------------------------------------------------

AGENT_REGISTRY: dict[str, dict] = {
    "supervisor": {
        "desc": "Routes tasks to specialized sub-agents via LangGraph supervisor pattern",
        "model": "llama3.2",
        "tools": ["all"],
    },
    "content_agent": {
        "desc": "Generates and adapts social media content for any platform",
        "model": "llama3.2",
        "tools": ["generate_social_post", "adapt_content_for_platform"],
    },
    "analytics_agent": {
        "desc": "Analyzes platform performance data and surfaces trends",
        "model": "llama3.2",
        "tools": ["analyze_platform_performance", "get_best_posting_time"],
    },
    "review_agent": {
        "desc": "Classifies review sentiment and generates suggested responses",
        "model": "llama3.2",
        "tools": ["classify_review_sentiment"],
    },
    "scheduling_agent": {
        "desc": "Picks optimal posting windows from historical analytics",
        "model": "llama3.2",
        "tools": ["get_best_posting_time"],
    },
}


# ---------------------------------------------------------------------------
# SQLite schema
# ---------------------------------------------------------------------------

_SCHEMA = """
CREATE TABLE IF NOT EXISTS agent_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  task_input TEXT,
  task_output TEXT,
  status TEXT DEFAULT 'pending',
  langsmith_trace_url TEXT,
  langsmith_run_id TEXT,
  tokens_used INTEGER,
  latency_ms INTEGER,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS agent_test_case (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  test_name TEXT NOT NULL,
  input TEXT,
  expected_output TEXT,
  actual_output TEXT,
  status TEXT DEFAULT 'pending',
  run_at TEXT,
  latency_ms INTEGER
);

CREATE TABLE IF NOT EXISTS agent_test_result (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  suite_name TEXT NOT NULL,
  run_at TEXT DEFAULT (datetime('now')),
  total INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  log TEXT,
  duration_ms INTEGER
);
"""

# 15 seed test cases — 3 per agent
_SEED_TEST_CASES: list[dict] = [
    # content_agent
    {
        "agent_name": "content_agent",
        "test_name": "generate_instagram_post",
        "input": json.dumps({"task": "Generate an Instagram post about yoga for beginners", "platform": "instagram"}),
        "expected_output": "A post with hashtags, under 2200 chars, engaging tone",
    },
    {
        "agent_name": "content_agent",
        "test_name": "adapt_twitter_from_instagram",
        "input": json.dumps({"task": "Adapt this Instagram post for Twitter", "source": "instagram", "target": "twitter"}),
        "expected_output": "Post under 280 chars",
    },
    {
        "agent_name": "content_agent",
        "test_name": "generate_linkedin_post",
        "input": json.dumps({"task": "Write a LinkedIn post about the benefits of yoga in the workplace"}),
        "expected_output": "Professional tone, 1000-1300 chars",
    },
    # analytics_agent
    {
        "agent_name": "analytics_agent",
        "test_name": "platform_performance_7d",
        "input": json.dumps({"task": "Summarize Instagram performance for last 7 days", "platform": "instagram", "days": 7}),
        "expected_output": "Dict with impressions, engagement_rate, top_post",
    },
    {
        "agent_name": "analytics_agent",
        "test_name": "best_posting_time_facebook",
        "input": json.dumps({"task": "What is the best time to post on Facebook?", "platform": "facebook"}),
        "expected_output": "Dict with day_of_week and hour",
    },
    {
        "agent_name": "analytics_agent",
        "test_name": "cross_platform_comparison",
        "input": json.dumps({"task": "Compare performance across Instagram, Facebook, and LinkedIn"}),
        "expected_output": "Ranked list of platforms by engagement",
    },
    # review_agent
    {
        "agent_name": "review_agent",
        "test_name": "positive_review_classification",
        "input": json.dumps({"task": "Classify this review", "text": "Amazing class! The instructor was so helpful and the yoga flow was perfect."}),
        "expected_output": "sentiment=positive, confidence>0.8",
    },
    {
        "agent_name": "review_agent",
        "test_name": "negative_review_classification",
        "input": json.dumps({"task": "Classify this review", "text": "Terrible experience. The class was overcrowded and the instructor ignored my questions."}),
        "expected_output": "sentiment=negative, confidence>0.7",
    },
    {
        "agent_name": "review_agent",
        "test_name": "neutral_review_response",
        "input": json.dumps({"task": "Generate a response to this neutral review", "text": "Class was okay. Nothing special but not bad either."}),
        "expected_output": "Polite acknowledgment, invites them back",
    },
    # scheduling_agent
    {
        "agent_name": "scheduling_agent",
        "test_name": "optimal_instagram_time",
        "input": json.dumps({"task": "When should I post on Instagram for maximum reach?", "platform": "instagram"}),
        "expected_output": "Dict with recommended_day and recommended_hour",
    },
    {
        "agent_name": "scheduling_agent",
        "test_name": "optimal_youtube_time",
        "input": json.dumps({"task": "Best time to publish YouTube videos", "platform": "youtube"}),
        "expected_output": "Dict with recommended_day and recommended_hour",
    },
    {
        "agent_name": "scheduling_agent",
        "test_name": "weekly_schedule_plan",
        "input": json.dumps({"task": "Create a weekly posting schedule for all platforms"}),
        "expected_output": "7-day schedule with platform assignments",
    },
    # supervisor
    {
        "agent_name": "supervisor",
        "test_name": "route_content_task",
        "input": json.dumps({"task": "Create a social media post about our new yoga challenge"}),
        "expected_output": "Routes to content_agent, returns generated post",
    },
    {
        "agent_name": "supervisor",
        "test_name": "route_analytics_task",
        "input": json.dumps({"task": "How did our Instagram perform last week?"}),
        "expected_output": "Routes to analytics_agent, returns summary",
    },
    {
        "agent_name": "supervisor",
        "test_name": "route_review_task",
        "input": json.dumps({"task": "Someone left a 2-star review saying the class was too advanced"}),
        "expected_output": "Routes to review_agent, returns sentiment + response",
    },
]


def _conn() -> sqlite3.Connection:
    """Return a SQLite connection to the agents DB, creating it if needed."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_schema() -> None:
    """Create all tables and seed test cases if they don't exist yet.

    Safe to call multiple times — uses CREATE TABLE IF NOT EXISTS.
    """
    with _conn() as conn:
        conn.executescript(_SCHEMA)
        # Seed test cases only if the table is empty
        count = conn.execute("SELECT COUNT(*) FROM agent_test_case").fetchone()[0]
        if count == 0:
            for tc in _SEED_TEST_CASES:
                conn.execute(
                    """INSERT INTO agent_test_case
                       (agent_name, test_name, input, expected_output, status)
                       VALUES (?, ?, ?, ?, 'pending')""",
                    (tc["agent_name"], tc["test_name"], tc["input"], tc["expected_output"]),
                )
            conn.commit()


def log_agent_run(
    agent_name: str,
    task_input: str,
    status: str = "pending",
) -> int:
    """Insert a new agent_run row and return its id.

    Args:
        agent_name: Key from AGENT_REGISTRY.
        task_input: JSON-serialisable task description or dict as string.
        status: Initial status — usually 'pending' or 'running'.

    Returns:
        The auto-incremented row id.
    """
    with _conn() as conn:
        cur = conn.execute(
            """INSERT INTO agent_run (agent_name, task_input, status, created_at)
               VALUES (?, ?, ?, datetime('now'))""",
            (agent_name, task_input, status),
        )
        conn.commit()
        return cur.lastrowid  # type: ignore[return-value]


def update_agent_run(
    run_id: int,
    *,
    status: str,
    task_output: Optional[str] = None,
    error_message: Optional[str] = None,
    tokens_used: Optional[int] = None,
    latency_ms: Optional[int] = None,
    langsmith_trace_url: Optional[str] = None,
    langsmith_run_id: Optional[str] = None,
) -> None:
    """Update an existing agent_run row after the agent completes or fails.

    Args:
        run_id: The id returned by log_agent_run().
        status: 'success' | 'failed' | 'running'.
        task_output: Serialised agent output.
        error_message: Error description if status='failed'.
        tokens_used: Token count if available.
        latency_ms: Wall-clock time in milliseconds.
        langsmith_trace_url: Public trace URL from LangSmith if tracing enabled.
        langsmith_run_id: Opaque run ID returned by LangSmith SDK.
    """
    with _conn() as conn:
        conn.execute(
            """UPDATE agent_run SET
               status=?, task_output=?, error_message=?, tokens_used=?,
               latency_ms=?, langsmith_trace_url=?, langsmith_run_id=?,
               completed_at=datetime('now')
               WHERE id=?""",
            (
                status,
                task_output,
                error_message,
                tokens_used,
                latency_ms,
                langsmith_trace_url,
                langsmith_run_id,
                run_id,
            ),
        )
        conn.commit()


def get_recent_runs(limit: int = 100) -> list[dict]:
    """Return the most recent agent_run rows as plain dicts.

    Args:
        limit: Maximum number of rows to return.

    Returns:
        List of row dicts ordered newest-first.
    """
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM agent_run ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_runs_for_agent(agent_name: str, limit: int = 20) -> list[dict]:
    """Return recent runs for a specific agent.

    Args:
        agent_name: Key from AGENT_REGISTRY.
        limit: Maximum rows.

    Returns:
        List of row dicts.
    """
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM agent_run WHERE agent_name=? ORDER BY id DESC LIMIT ?",
            (agent_name, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def get_test_cases() -> list[dict]:
    """Return all test cases."""
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM agent_test_case ORDER BY agent_name, id").fetchall()
        return [dict(r) for r in rows]


def update_test_case(
    tc_id: int,
    *,
    status: str,
    actual_output: Optional[str],
    latency_ms: Optional[int],
) -> None:
    """Record the result of running a test case.

    Args:
        tc_id: test case id.
        status: 'pass' | 'fail' | 'skip'.
        actual_output: Serialised agent output.
        latency_ms: Wall-clock ms.
    """
    with _conn() as conn:
        conn.execute(
            """UPDATE agent_test_case SET
               status=?, actual_output=?, latency_ms=?, run_at=datetime('now')
               WHERE id=?""",
            (status, actual_output, latency_ms, tc_id),
        )
        conn.commit()


def save_test_result(
    suite_name: str,
    total: int,
    passed: int,
    failed: int,
    skipped: int,
    log: str,
    duration_ms: int,
) -> int:
    """Persist a full test-suite result row.

    Args:
        suite_name: Human name for the suite.
        total / passed / failed / skipped: Counts.
        log: Full text log output.
        duration_ms: Total suite wall-clock time.

    Returns:
        Auto-increment id.
    """
    with _conn() as conn:
        cur = conn.execute(
            """INSERT INTO agent_test_result
               (suite_name, total, passed, failed, skipped, log, duration_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (suite_name, total, passed, failed, skipped, log, duration_ms),
        )
        conn.commit()
        return cur.lastrowid  # type: ignore[return-value]


def get_test_results(limit: int = 50) -> list[dict]:
    """Return recent test result rows newest-first."""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM agent_test_result ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
