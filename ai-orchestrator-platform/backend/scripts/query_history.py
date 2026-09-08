#!/usr/bin/env python3
"""Read-only CLI over praveenchatbot's own prompt/response history, for
other AI tools/CLIs on this machine (Claude Code, Codex, ad-hoc scripts) to
query without going through the HTTP API or knowing the schema.

The database is a plain SQLite file at data/orchestrator.db, WAL mode, so
concurrent reads from another process are always safe -- this script never
writes. It's genuinely the same data the praveenchatbot UI shows in its
Task History / Dashboard tabs, not a separate export.

Usage:
  python3 query_history.py recent [--limit 20] [--provider ollama]
  python3 query_history.py search "keyword" [--limit 20]
  python3 query_history.py conversation <id>
  python3 query_history.py stats

All output is JSON on stdout (one line per record for recent/search, a
single object for conversation/stats) so it's easy to pipe into `jq` or
parse from another tool.
"""
import argparse
import json
import os
import sqlite3
import sys

DB_PATH = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "data", "orchestrator.db"))


def _conn():
    if not os.path.exists(DB_PATH):
        print(json.dumps({"error": f"no database at {DB_PATH} -- has the backend run at least once?"}), file=sys.stderr)
        sys.exit(1)
    c = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=10)
    c.row_factory = sqlite3.Row
    return c


def cmd_recent(args):
    with _conn() as c:
        q = "SELECT id, provider, model, status, input, output, duration_ms, created_at FROM tasks"
        params = []
        if args.provider:
            q += " WHERE provider = ?"
            params.append(args.provider)
        q += " ORDER BY id DESC LIMIT ?"
        params.append(args.limit)
        for row in c.execute(q, params):
            print(json.dumps(dict(row)))


def cmd_search(args):
    with _conn() as c:
        rows = c.execute(
            """SELECT id, provider, model, status, input, output, duration_ms, created_at FROM tasks
               WHERE input LIKE ? OR output LIKE ? ORDER BY id DESC LIMIT ?""",
            (f"%{args.keyword}%", f"%{args.keyword}%", args.limit),
        )
        for row in rows:
            print(json.dumps(dict(row)))


def cmd_conversation(args):
    with _conn() as c:
        convo = c.execute("SELECT * FROM conversations WHERE id = ?", (args.id,)).fetchone()
        if not convo:
            print(json.dumps({"error": f"no conversation {args.id}"}), file=sys.stderr)
            sys.exit(1)
        messages = c.execute("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id", (args.id,)).fetchall()
        print(json.dumps({**dict(convo), "messages": [dict(m) for m in messages]}))


def cmd_stats(_args):
    with _conn() as c:
        row = c.execute(
            """SELECT provider, model, COUNT(*) calls, ROUND(AVG(duration_ms),1) avg_ms
               FROM tasks WHERE status='completed' AND duration_ms > 0
               GROUP BY provider, model ORDER BY calls DESC"""
        ).fetchall()
        print(json.dumps([dict(r) for r in row]))


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)

    p_recent = sub.add_parser("recent", help="Most recent tasks (prompt/response pairs)")
    p_recent.add_argument("--limit", type=int, default=20)
    p_recent.add_argument("--provider", default=None)
    p_recent.set_defaults(func=cmd_recent)

    p_search = sub.add_parser("search", help="Search input/output text")
    p_search.add_argument("keyword")
    p_search.add_argument("--limit", type=int, default=20)
    p_search.set_defaults(func=cmd_search)

    p_convo = sub.add_parser("conversation", help="Full message history for one conversation")
    p_convo.add_argument("id", type=int)
    p_convo.set_defaults(func=cmd_conversation)

    p_stats = sub.add_parser("stats", help="Calls/avg latency grouped by provider+model")
    p_stats.set_defaults(func=cmd_stats)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
