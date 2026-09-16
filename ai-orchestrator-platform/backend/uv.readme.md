# UV Quick Reference

UV replaces pip + venv + pip-tools with a single Rust-based tool (10-100x faster installs).

## Common Commands

```bash
uv sync              # install all deps into .venv (like npm install)
uv add <pkg>         # add dependency + update uv.lock
uv remove <pkg>      # remove dependency + update uv.lock
uv run <cmd>         # run command in .venv (no activation needed)
uv python pin 3.13   # pin Python version in .python-version
uv lock              # update lockfile without installing
uv tree              # show dependency tree
uv pip list          # list installed packages
```

## Running the Backend

```bash
# Option 1: via run.sh (recommended)
./run.sh

# Option 2: directly
uv run uvicorn app.main:app --host 127.0.0.1 --port 8100

# Option 3: with reload (dev mode)
uv run uvicorn app.main:app --host 127.0.0.1 --port 8100 --reload
```

## Running Tests

```bash
uv run pytest tests/ -v
uv run pytest tests/test_agents.py -v   # agents only
```

## Adding Optional Deps (LangFlow visual builder)

```bash
uv add --optional langflow langflow>=1.0.0
# Then start LangFlow:
./scripts/start-langflow.sh
```

## Key Files

- `pyproject.toml` — dependency spec (edit this, not requirements.txt)
- `uv.lock` — auto-generated lockfile (commit this for reproducibility)
- `.python-version` — pinned Python version
- `.env` — local env vars (copy from .env.example, never commit)
