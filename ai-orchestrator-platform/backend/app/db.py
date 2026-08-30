"""SQLite state for the orchestrator platform ITSELF: conversations, messages,
tasks (one per routed model call), and model-health history. Deliberately
separate from agentic-ollama-platform/data/tasks.db, which is that project's
own queue for autonomous specialist runs — this file is the orchestrator UI's
bookkeeping (chat history + project tagging + health timeline), matching the
brief's data-model requirement: "each conversation/task is tagged with a
project ... genuinely partitioned and filterable by project in the real
database."
"""
import json
import os
import sqlite3
import time
from typing import Optional

from . import config

DB = config.DB_PATH


def conn():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    c = sqlite3.connect(DB, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c


def _add_column_if_missing(c, table: str, coldef: str):
    """coldef e.g. 'root_dir TEXT'. Idempotent — SQLite has no
    'ADD COLUMN IF NOT EXISTS', so probe pragma table_info first."""
    colname = coldef.split()[0]
    existing = {row[1] for row in c.execute(f"PRAGMA table_info({table})")}
    if colname not in existing:
        c.execute(f"ALTER TABLE {table} ADD COLUMN {coldef}")


def init():
    with conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS projects(
            key TEXT PRIMARY KEY, name TEXT, created_at REAL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS conversations(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_key TEXT NOT NULL,
            title TEXT,
            created_at REAL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS messages(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,               -- 'user' | 'assistant' | 'system'
            content TEXT NOT NULL,
            provider TEXT,                    -- 'ollama' | 'openai' | 'claude' | NULL for user msgs
            model TEXT,
            created_at REAL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS tasks(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER,
            project_key TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT,
            status TEXT NOT NULL,             -- 'running' | 'completed' | 'failed'
            input TEXT,
            output TEXT,
            error TEXT,
            routing_reason TEXT,
            duration_ms REAL,
            created_at REAL,
            completed_at REAL)""")
        c.execute("""CREATE TABLE IF NOT EXISTS model_health_history(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL,
            status TEXT NOT NULL,
            detail TEXT,
            checked_at REAL)""")

        # --- Migrations for the desktop-workspace pass (filesystem search /
        # assign-to-project / editor). Projects gain a real root_dir so a
        # project tag maps to an actual directory; conversations/tasks gain
        # context_path so "assign this file/dir to a task" is a genuine
        # column, not just the pre-existing project label string. ---
        _add_column_if_missing(c, "projects", "root_dir TEXT")
        _add_column_if_missing(c, "conversations", "context_path TEXT")
        _add_column_if_missing(c, "tasks", "context_path TEXT")

        for p in config.KNOWN_PROJECTS:
            c.execute("INSERT OR IGNORE INTO projects(key, name, created_at) VALUES (?,?,?)",
                      (p["key"], p["name"], time.time()))
            # Keep root_dir in sync with config even for rows that already
            # existed (e.g. from before this migration) — config is the
            # source of truth for known projects' roots.
            c.execute("UPDATE projects SET root_dir = ? WHERE key = ?", (p.get("root_dir"), p["key"]))


def upsert_project(key: str, name: str = None, root_dir: str = None):
    with conn() as c:
        c.execute("INSERT OR IGNORE INTO projects(key, name, created_at) VALUES (?,?,?)",
                  (key, name or key, time.time()))
        if root_dir is not None:
            c.execute("UPDATE projects SET root_dir = ? WHERE key = ?", (root_dir, key))


def list_projects():
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM projects ORDER BY name")]


def create_conversation(project_key: str, title: str = None, context_path: str = None) -> int:
    upsert_project(project_key)
    with conn() as c:
        cur = c.execute(
            "INSERT INTO conversations(project_key, title, created_at, context_path) VALUES (?,?,?,?)",
            (project_key, title or "New conversation", time.time(), context_path))
        return cur.lastrowid


def set_conversation_context(conversation_id: int, context_path: Optional[str]):
    with conn() as c:
        c.execute("UPDATE conversations SET context_path = ? WHERE id = ?", (context_path, conversation_id))


def list_conversations(project_key: str = None):
    q = "SELECT * FROM conversations"
    args = ()
    if project_key:
        q += " WHERE project_key = ?"
        args = (project_key,)
    q += " ORDER BY id DESC"
    with conn() as c:
        return [dict(r) for r in c.execute(q, args)]


def get_conversation(cid: int):
    with conn() as c:
        row = c.execute("SELECT * FROM conversations WHERE id = ?", (cid,)).fetchone()
        return dict(row) if row else None


def add_message(conversation_id: int, role: str, content: str, provider: str = None, model: str = None) -> int:
    with conn() as c:
        cur = c.execute(
            "INSERT INTO messages(conversation_id, role, content, provider, model, created_at) VALUES (?,?,?,?,?,?)",
            (conversation_id, role, content, provider, model, time.time()))
        return cur.lastrowid


def list_messages(conversation_id: int):
    with conn() as c:
        return [dict(r) for r in c.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY id", (conversation_id,))]


def start_task(conversation_id, project_key, provider, model, input_text, routing_reason, context_path=None) -> int:
    with conn() as c:
        cur = c.execute(
            """INSERT INTO tasks(conversation_id, project_key, provider, model, status, input,
               routing_reason, created_at, context_path) VALUES (?,?,?,?,'running',?,?,?,?)""",
            (conversation_id, project_key, provider, model, input_text, routing_reason, time.time(), context_path))
        return cur.lastrowid


def complete_task(task_id, output, duration_ms):
    with conn() as c:
        c.execute("""UPDATE tasks SET status='completed', output=?, duration_ms=?, completed_at=?
                     WHERE id=?""", (output, duration_ms, time.time(), task_id))


def fail_task(task_id, error, duration_ms):
    with conn() as c:
        c.execute("""UPDATE tasks SET status='failed', error=?, duration_ms=?, completed_at=?
                     WHERE id=?""", (str(error)[:2000], duration_ms, time.time(), task_id))


def list_tasks(project_key: str = None, limit: int = 100):
    q = "SELECT * FROM tasks"
    args = ()
    if project_key:
        q += " WHERE project_key = ?"
        args = (project_key,)
    q += " ORDER BY id DESC LIMIT ?"
    args = args + (limit,)
    with conn() as c:
        return [dict(r) for r in c.execute(q, args)]


def get_task(task_id: int):
    with conn() as c:
        row = c.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
        return dict(row) if row else None


def record_health(provider: str, status: str, detail: str = ""):
    with conn() as c:
        c.execute("INSERT INTO model_health_history(provider, status, detail, checked_at) VALUES (?,?,?,?)",
                  (provider, status, detail, time.time()))


def latest_health():
    with conn() as c:
        rows = c.execute("""
            SELECT h.* FROM model_health_history h
            INNER JOIN (SELECT provider, MAX(checked_at) mx FROM model_health_history GROUP BY provider) m
            ON h.provider = m.provider AND h.checked_at = m.mx
        """).fetchall()
        return {r["provider"]: dict(r) for r in rows}
