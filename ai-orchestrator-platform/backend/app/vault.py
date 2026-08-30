"""Thin re-export of the vault-read helper that already lives in
agentic-ollama-platform/app/vault_client.py (itself a Python port of the
proven sohamyoga-frontend/src/lib/openbao.ts REST pattern). Kept as its own
module here only so backend code can `from .vault import vault_read` without
knowing about the bridge/sys.path plumbing."""
from .bridge import config  # noqa: F401  (ensures sys.path is wired first)
import vault_client  # noqa: E402  (agentic-ollama-platform/app/vault_client.py)

vault_read = vault_client.vault_read
