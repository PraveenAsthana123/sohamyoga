"""Real, live health checks for each provider. NEVER report "connected"
without having actually verified it this call — the exact anti-fabrication
discipline the build brief calls out (sohamyoga-frontend's /admin/integrations
previously faked connection status for unconfigured services and had to be
rewired to real checks; this module is built correctly from the start).

Status vocabulary (deliberately more granular than up/down, because a
"present but out of quota" key is a materially different state from "not
configured" or "network unreachable" and collapsing them would itself be a
small fabrication):
  ollama:  "connected" | "down"
  openai / claude:  "connected" | "no_key" | "quota_exceeded" | "unreachable" | "error"
"""
import json
import time
import urllib.error
import urllib.request

from . import bridge, config
from .vault import vault_read

_CACHE_TTL_SECONDS = 30
_cache = {}  # provider -> (checked_at, result_dict)


def _cached(provider):
    hit = _cache.get(provider)
    if hit and (time.time() - hit[0]) < _CACHE_TTL_SECONDS:
        return hit[1]
    return None


def _store(provider, result):
    _cache[provider] = (time.time(), result)
    return result


def check_ollama(force: bool = False):
    if not force:
        hit = _cached("ollama")
        if hit:
            return hit
    up = bridge.ollama_up()
    result = {
        "provider": "ollama",
        "status": "connected" if up else "down",
        "detail": f"local daemon at {bridge.ollama_client.OLLAMA}" if up else "no response from local Ollama daemon",
        "checked_at": time.time(),
    }
    return _store("ollama", result)


def check_openai(force: bool = False):
    if not force:
        hit = _cached("openai")
        if hit:
            return hit
    secret = vault_read("vault://secret/data/epilepsy-portal/openai")
    key = (secret or {}).get("api_key")
    if not key:
        return _store("openai", {"provider": "openai", "status": "no_key",
                                  "detail": "no readable secret at vault://secret/data/epilepsy-portal/openai",
                                  "checked_at": time.time()})
    # Cheap, real, non-billable probe: GET /v1/models (auth check, no completion tokens spent).
    req = urllib.request.Request("https://api.openai.com/v1/models",
                                  headers={"Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            resp.read(200)  # don't need the body, just confirm 200
        return _store("openai", {"provider": "openai", "status": "connected",
                                  "detail": "vault key present and authenticated against api.openai.com",
                                  "checked_at": time.time()})
    except urllib.error.HTTPError as e:
        if e.code == 429:
            body = e.read().decode(errors="replace")
            if "insufficient_quota" in body:
                return _store("openai", {"provider": "openai", "status": "quota_exceeded",
                                          "detail": "key authenticates but account has no remaining quota",
                                          "checked_at": time.time()})
            return _store("openai", {"provider": "openai", "status": "error",
                                      "detail": f"HTTP 429: {body[:200]}", "checked_at": time.time()})
        if e.code == 401:
            return _store("openai", {"provider": "openai", "status": "error",
                                      "detail": "HTTP 401 — vault key is present but invalid/revoked",
                                      "checked_at": time.time()})
        return _store("openai", {"provider": "openai", "status": "error",
                                  "detail": f"HTTP {e.code}", "checked_at": time.time()})
    except Exception as e:
        return _store("openai", {"provider": "openai", "status": "unreachable",
                                  "detail": str(e)[:200], "checked_at": time.time()})


def check_claude(force: bool = False):
    if not force:
        hit = _cached("claude")
        if hit:
            return hit
    secret = vault_read("vault://secret/data/epilepsy-portal/anthropic")
    key = (secret or {}).get("api_key")
    if not key:
        return _store("claude", {"provider": "claude", "status": "no_key",
                                  "detail": "no readable secret at vault://secret/data/epilepsy-portal/anthropic "
                                            "— claude_agent fails closed until one is written",
                                  "checked_at": time.time()})
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/models",
        headers={"x-api-key": key, "anthropic-version": "2023-06-01"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            resp.read(200)
        return _store("claude", {"provider": "claude", "status": "connected",
                                  "detail": "vault key present and authenticated against api.anthropic.com",
                                  "checked_at": time.time()})
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return _store("claude", {"provider": "claude", "status": "error",
                                      "detail": "HTTP 401 — vault key is present but invalid/revoked",
                                      "checked_at": time.time()})
        if e.code == 429:
            return _store("claude", {"provider": "claude", "status": "quota_exceeded",
                                      "detail": "key authenticates but is rate-limited/out of credit",
                                      "checked_at": time.time()})
        return _store("claude", {"provider": "claude", "status": "error",
                                  "detail": f"HTTP {e.code}", "checked_at": time.time()})
    except Exception as e:
        return _store("claude", {"provider": "claude", "status": "unreachable",
                                  "detail": str(e)[:200], "checked_at": time.time()})


def _check_local_openai_compatible(provider: str, base_url: str, force: bool = False):
    """Shared real check for the local OpenAI-compatible servers (LocalAI,
    llama.cpp server, LM Studio): GET /v1/models, connected iff it answers."""
    if not force:
        hit = _cached(provider)
        if hit:
            return hit
    req = urllib.request.Request(f"{base_url}/v1/models")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        names = [m.get("id") for m in data.get("data", [])]
        return _store(provider, {"provider": provider, "status": "connected",
                                  "detail": f"{base_url} — models: {', '.join(names) or '(none loaded)'}",
                                  "checked_at": time.time()})
    except Exception as e:
        return _store(provider, {"provider": provider, "status": "down",
                                  "detail": f"no response from {base_url}: {str(e)[:150]}",
                                  "checked_at": time.time()})


def check_localai(force: bool = False):
    return _check_local_openai_compatible("localai", config.LOCALAI_URL, force)


def check_llamacpp(force: bool = False):
    return _check_local_openai_compatible("llamacpp", config.LLAMACPP_URL, force)


def check_lmstudio(force: bool = False):
    return _check_local_openai_compatible("lmstudio", config.LMSTUDIO_URL, force)


def check_all(force: bool = False):
    return {
        "ollama": check_ollama(force),
        "openai": check_openai(force),
        "claude": check_claude(force),
        "localai": check_localai(force),
        "llamacpp": check_llamacpp(force),
        "lmstudio": check_lmstudio(force),
    }


# Other local tools running on this machine that this app doesn't route
# chat/task calls through, but that the user wants visible -- a real
# reachability check (GET, any response = up), not a fabricated status.
# NOT proxied/embedded: both are separate full apps with their own auth, and
# their "open" URL is only reachable from THIS machine, not through the
# Cloudflare tunnel from a remote browser (see main.py's /integrations note).
EXTERNAL_TOOLS = [
    {"key": "openclaw", "name": "OpenClaw", "url": "http://127.0.0.1:18889"},
    {"key": "paperclip", "name": "Paperclip", "url": "http://127.0.0.1:3100"},
]


def check_external_tool(tool: dict, force: bool = False):
    cache_key = f"ext:{tool['key']}"
    if not force:
        hit = _cached(cache_key)
        if hit:
            return hit
    try:
        req = urllib.request.Request(tool["url"], method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read(200)
        return _store(cache_key, {**tool, "status": "up", "checked_at": time.time()})
    except Exception as e:
        return _store(cache_key, {**tool, "status": "down", "detail": str(e)[:150], "checked_at": time.time()})


def check_external_tools(force: bool = False):
    return [check_external_tool(t, force) for t in EXTERNAL_TOOLS]
