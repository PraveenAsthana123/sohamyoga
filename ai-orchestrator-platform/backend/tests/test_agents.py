"""Agent system test cases.

Tests cover:
1. SQLite schema creation
2. Run logging
3. Recent run retrieval
4. Agent registry completeness
5. Tool: generate_social_post (Ollama, skip if down)
6. Tool: classify_review_sentiment (with keyword fallback)
7. API: GET /api/agents — list all agents
8. API: POST /api/agents/content_agent/run
9. API: GET /api/agents/test-cases
10. API: GET /api/agents/langsmith-config

Run with:
    uv run pytest tests/test_agents.py -v
"""

import json
import os
import sqlite3
import sys
import tempfile
import time
from typing import Generator
from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# Ensure the backend package is on sys.path
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ---------------------------------------------------------------------------
# Patch the DB_PATH to a temp file so tests don't clobber production data
# ---------------------------------------------------------------------------

_TMP_DB = tempfile.mktemp(suffix=".db", prefix="test_agents_")


@pytest.fixture(autouse=True)
def _patch_db_path(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    """Redirect all registry DB operations to a fresh temp DB per test session."""
    import app.agents.registry as reg

    monkeypatch.setattr(reg, "DB_PATH", _TMP_DB)
    yield
    # cleanup after the full test session
    if os.path.exists(_TMP_DB):
        try:
            os.unlink(_TMP_DB)
        except OSError:
            pass


# ---------------------------------------------------------------------------
# 1. Schema creation
# ---------------------------------------------------------------------------


def test_schema_creation() -> None:
    """ensure_schema() must create all 3 required tables in SQLite."""
    from app.agents.registry import ensure_schema

    ensure_schema()

    conn = sqlite3.connect(_TMP_DB)
    tables = {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }
    conn.close()

    assert "agent_run" in tables, "agent_run table missing"
    assert "agent_test_case" in tables, "agent_test_case table missing"
    assert "agent_test_result" in tables, "agent_test_result table missing"


# ---------------------------------------------------------------------------
# 2. Log agent run
# ---------------------------------------------------------------------------


def test_log_agent_run() -> None:
    """log_agent_run() must insert a row and return a positive integer id."""
    from app.agents.registry import ensure_schema, log_agent_run

    ensure_schema()
    run_id = log_agent_run("content_agent", "Generate a test post", status="pending")

    assert isinstance(run_id, int), f"Expected int, got {type(run_id)}"
    assert run_id > 0, f"Expected positive id, got {run_id}"

    conn = sqlite3.connect(_TMP_DB)
    row = conn.execute(
        "SELECT agent_name, task_input, status FROM agent_run WHERE id=?", (run_id,)
    ).fetchone()
    conn.close()

    assert row is not None, "Row not found after insert"
    assert row[0] == "content_agent"
    assert row[2] == "pending"


# ---------------------------------------------------------------------------
# 3. Get recent runs
# ---------------------------------------------------------------------------


def test_get_recent_runs() -> None:
    """get_recent_runs() must return a list (possibly empty or non-empty)."""
    from app.agents.registry import ensure_schema, get_recent_runs, log_agent_run

    ensure_schema()
    # Insert a run so we have at least one
    log_agent_run("analytics_agent", "test task", status="success")
    runs = get_recent_runs(limit=10)

    assert isinstance(runs, list), "Expected list"
    assert len(runs) >= 1, "Expected at least 1 run after insert"
    assert "agent_name" in runs[0], "Run row missing agent_name key"
    assert "status" in runs[0], "Run row missing status key"


# ---------------------------------------------------------------------------
# 4. Agent registry completeness
# ---------------------------------------------------------------------------


def test_agent_registry_completeness() -> None:
    """AGENT_REGISTRY must contain exactly the 5 expected agents with required keys."""
    from app.agents.registry import AGENT_REGISTRY

    required_agents = {
        "supervisor",
        "content_agent",
        "analytics_agent",
        "review_agent",
        "scheduling_agent",
    }
    registered = set(AGENT_REGISTRY.keys())
    missing = required_agents - registered
    assert not missing, f"Missing agents in registry: {missing}"

    for name, meta in AGENT_REGISTRY.items():
        assert "desc" in meta, f"Agent '{name}' missing 'desc'"
        assert "model" in meta, f"Agent '{name}' missing 'model'"
        assert "tools" in meta, f"Agent '{name}' missing 'tools'"
        assert meta["model"], f"Agent '{name}' has empty model"


# ---------------------------------------------------------------------------
# 5. Tool: generate_social_post (skip if Ollama is down)
# ---------------------------------------------------------------------------


def _ollama_is_up() -> bool:
    """Return True if Ollama is reachable at localhost:11434."""
    import httpx

    try:
        resp = httpx.get("http://localhost:11434/api/tags", timeout=3.0)
        return resp.status_code == 200
    except Exception:
        return False


def _ollama_has_llama32() -> bool:
    """Return True if llama3.2 model is pulled in Ollama."""
    import httpx

    try:
        resp = httpx.get("http://localhost:11434/api/tags", timeout=3.0)
        models = [m["name"] for m in resp.json().get("models", [])]
        return any("llama3.2" in m for m in models)
    except Exception:
        return False


@pytest.mark.skipif(
    not _ollama_has_llama32(),
    reason="llama3.2 model not pulled in Ollama — skipping live tool test (run: ollama pull llama3.2)"
)
def test_tool_generate_social_post_returns_string() -> None:
    """generate_social_post must return a non-empty string when llama3.2 is available."""
    from app.agents.tools import generate_social_post

    result = generate_social_post.invoke(  # type: ignore[attr-defined]
        {"platform": "instagram", "topic": "morning yoga for beginners"}
    )
    assert isinstance(result, str), f"Expected str, got {type(result)}"
    assert len(result) > 10, "Result too short — probably an error"
    assert "ollama_unavailable" not in result, "Tool returned unavailability notice"


# ---------------------------------------------------------------------------
# 6. Tool: classify_review_sentiment (keyword fallback path)
# ---------------------------------------------------------------------------


def test_tool_classify_sentiment_keyword_fallback() -> None:
    """classify_review_sentiment must return sentiment + confidence even if Ollama is down."""
    from app.agents.tools import classify_review_sentiment

    # Force Ollama to appear down by patching _call_ollama
    with patch("app.agents.tools._call_ollama", return_value="__OLLAMA_DOWN__"):
        result = classify_review_sentiment.invoke(  # type: ignore[attr-defined]
            {"text": "Amazing class! The instructor was wonderful."}
        )

    assert isinstance(result, dict), f"Expected dict, got {type(result)}"
    assert "sentiment" in result, "Result missing 'sentiment'"
    assert "confidence" in result, "Result missing 'confidence'"
    assert result["sentiment"] in {"positive", "neutral", "negative"}, (
        f"Invalid sentiment: {result['sentiment']}"
    )
    assert 0.0 <= result["confidence"] <= 1.0, f"Confidence out of range: {result['confidence']}"


def test_tool_classify_sentiment_negative_keyword() -> None:
    """Keyword fallback must correctly flag negative text even without Ollama."""
    from app.agents.tools import classify_review_sentiment

    with patch("app.agents.tools._call_ollama", return_value="__OLLAMA_DOWN__"):
        result = classify_review_sentiment.invoke(  # type: ignore[attr-defined]
            {"text": "Terrible, awful experience. Worst class I have ever attended."}
        )
    assert result["sentiment"] == "negative", (
        f"Expected negative, got {result['sentiment']}"
    )


# ---------------------------------------------------------------------------
# 7. API: GET /api/agents — list all agents
# ---------------------------------------------------------------------------


@pytest.fixture
def client():
    """Create a TestClient for the FastAPI app with a valid test session.

    Calls ensure_schema() after the DB_PATH monkeypatch is applied so the
    test DB (not production) has the seeded test cases.
    """
    from fastapi.testclient import TestClient
    import app.auth as auth_module
    import app.agents.registry as reg
    from app.main import app

    # ensure_schema() is called at module import time in agents_router.py using
    # the *real* DB_PATH, before monkeypatch can intercept it. Re-call it here
    # after monkeypatch has redirected DB_PATH to the temp file.
    reg.ensure_schema()

    # Create a valid session directly (bypasses password check — test-only)
    sid = auth_module.create_session()
    c = TestClient(app, raise_server_exceptions=False)
    c.cookies.set(auth_module.SESSION_COOKIE, sid)
    return c


def test_api_agents_list(client) -> None:
    """GET /api/agents must return a list of 5 agents."""
    resp = client.get("/api/agents")
    assert resp.status_code == 200, f"Status {resp.status_code}: {resp.text[:200]}"
    data = resp.json()
    assert isinstance(data, list), "Expected list response"
    assert len(data) == 5, f"Expected 5 agents, got {len(data)}"
    names = {a["name"] for a in data}
    expected = {"supervisor", "content_agent", "analytics_agent", "review_agent", "scheduling_agent"}
    assert names == expected, f"Agent names mismatch. Got: {names}"


# ---------------------------------------------------------------------------
# 8. API: POST /api/agents/content_agent/run
# ---------------------------------------------------------------------------


def test_api_agents_run_content(client) -> None:
    """POST /api/agents/content_agent/run must return run_id and status."""
    with patch("app.agents.tools._call_ollama", return_value="A great yoga post for you! #yoga #wellness"):
        resp = client.post(
            "/api/agents/content_agent/run",
            json={"task": "Generate an Instagram post about morning yoga", "context": {"platform": "instagram"}},
        )
    assert resp.status_code == 200, f"Status {resp.status_code}: {resp.text[:400]}"
    data = resp.json()
    assert "run_id" in data, f"Missing run_id in response: {data}"
    assert "status" in data, f"Missing status in response: {data}"
    assert isinstance(data["run_id"], int), "run_id should be an integer"
    assert data["status"] in {"success", "failed"}, f"Unexpected status: {data['status']}"


# ---------------------------------------------------------------------------
# 9. API: GET /api/agents/test-cases
# ---------------------------------------------------------------------------


def test_api_test_cases_endpoint(client) -> None:
    """GET /api/agents/test-cases must return a list of test case dicts."""
    resp = client.get("/api/agents/test-cases")
    assert resp.status_code == 200, f"Status {resp.status_code}: {resp.text[:200]}"
    data = resp.json()
    assert isinstance(data, list), "Expected list"
    # After ensure_schema() seeds 15 test cases
    assert len(data) >= 15, f"Expected at least 15 seeded test cases, got {len(data)}"
    if data:
        row = data[0]
        assert "agent_name" in row, "Missing agent_name"
        assert "test_name" in row, "Missing test_name"
        assert "status" in row, "Missing status"


# ---------------------------------------------------------------------------
# 10. API: GET /api/agents/langsmith-config
# ---------------------------------------------------------------------------


def test_api_langsmith_config(client) -> None:
    """GET /api/agents/langsmith-config must return a dict with 'configured' bool."""
    resp = client.get("/api/agents/langsmith-config")
    assert resp.status_code == 200, f"Status {resp.status_code}: {resp.text[:200]}"
    data = resp.json()
    assert isinstance(data, dict), "Expected dict response"
    assert "configured" in data, "Missing 'configured' key"
    assert isinstance(data["configured"], bool), "configured should be bool"
    assert "tracing_enabled" in data, "Missing 'tracing_enabled' key"
    assert "project" in data, "Missing 'project' key"
    assert "endpoint" in data, "Missing 'endpoint' key"
