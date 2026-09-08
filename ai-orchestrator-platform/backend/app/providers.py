"""Unified call surface over all providers. The three cloud/local-first
providers (ollama/openai/claude) call straight into the real, already-existing
engine code (see bridge.py) — no logic reimplemented there, only adapted.

localai/llamacpp/lmstudio are locally-run, OpenAI-compatible HTTP servers
(no vault secrets, no auth) added 2026-09-02 so this app can address every
local inference backend already running on this machine, not just Ollama.
They share one generic OpenAI-compatible chat-completions caller below rather
than three near-identical copies.
"""
import json
import urllib.error
import urllib.request

from . import bridge, config

LOCAL_OPENAI_COMPATIBLE = {
    "localai": (config.LOCALAI_URL, "qwen2.5-coder-3b"),
    "llamacpp": (config.LLAMACPP_URL, "qwen2.5-coder-3b"),
    "lmstudio": (config.LMSTUDIO_URL, "qwen/qwen2.5-coder-3b"),
}

# llama.cpp model -> which llama-server INSTANCE (its own process/port) serves
# it -- see config.LLAMACPP_EXTRA_URL's docstring for why this can't just be
# one URL with a model param like Ollama. The friendly names here are ours,
# not what llama-server's own /v1/models reports (that's the raw blob path on
# disk, not something a human would recognize) -- llama-server doesn't
# validate the "model" field in a request against what it's actually serving,
# so using a friendly name here is safe, not a mismatch.
LLAMACPP_MODELS = {
    "qwen2.5-coder-3b": config.LLAMACPP_URL,
    "llama3.2:1b": config.LLAMACPP_EXTRA_URL,
}

# Two-layer Ollama default when the caller doesn't pick a model explicitly:
# a SMALL model for ordinary short chat messages (fast, well under a second)
# and a LARGE model for long/complex queries (the underlying engine's old
# "general" default, ~7B -- more capable, slower). See _pick_ollama_default()
# and router.LONG_TASK_CHAR_THRESHOLD for the length cutoff. Both
# overridable via env, same pattern as the rest of this file.
import os as _os
OLLAMA_SMALL_MODEL = _os.environ.get("OLLAMA_SMALL_MODEL", "llama3.2:1b")
OLLAMA_LARGE_MODEL = _os.environ.get("OLLAMA_LARGE_MODEL", "qwen2.5:latest")
# Extra named defaults for the Settings "task scenario" picker -- table
# scenario reuses the large general model (same reasoning router.py's own
# TABLE_KEYWORDS rule uses: "ollama general model handles structured-text
# tasks fine"); vision needs an explicitly vision-capable model, which
# small/large alone don't guarantee.
OLLAMA_TABLE_MODEL = _os.environ.get("OLLAMA_TABLE_MODEL", OLLAMA_LARGE_MODEL)
OLLAMA_VISION_MODEL = _os.environ.get("OLLAMA_VISION_MODEL", "qwen2.5vl:latest")


def _pick_ollama_default(prompt: str) -> str:
    from . import router  # local import: router.py never imports providers.py, so this is one-directional
    return OLLAMA_LARGE_MODEL if len(prompt or "") > router.LONG_TASK_CHAR_THRESHOLD else OLLAMA_SMALL_MODEL


# Rough parameter-count classifier for the model PICKER's "(small)"/"(large)"
# tags -- parsed from Ollama tag names like "qwen2.5-coder:14b", not measured.
# A tag with no parseable size (embeddings, "latest", "local", etc.) is
# reported as "unknown" rather than guessed, per this codebase's no-fabrication
# discipline (see router.py's own honesty note).
import re as _re
_SIZE_RE = _re.compile(r"(\d+(?:\.\d+)?)\s*b\b", _re.IGNORECASE)
SMALL_LARGE_CUTOFF_B = 4.0  # <=3B tiers count as "small" on this GPU; 7B+ as "large"


def model_tier(model_name: str) -> str:
    m = _SIZE_RE.search(model_name)
    if not m:
        return "unknown"
    size_b = float(m.group(1))
    return "small" if size_b <= SMALL_LARGE_CUTOFF_B else "large"


# Modality tag, parsed from the model NAME only (substring match) -- not from
# any verified capability probe. "text" is the fallback, not a confirmed
# capability; a model whose name gives no hint either way is still "text"
# since that's the overwhelmingly common case among locally-pulled models.
_VISION_HINTS = ("vl", "llava", "vision")
_CODE_HINTS = ("coder", "code", "starcoder")
_EMBED_HINTS = ("embed",)
_SAFETY_HINTS = ("guard",)


def model_modality(model_name: str) -> str:
    name = model_name.lower()
    if any(h in name for h in _VISION_HINTS):
        return "vision"
    if any(h in name for h in _EMBED_HINTS):
        return "embedding"
    if any(h in name for h in _SAFETY_HINTS):
        return "safety"
    if any(h in name for h in _CODE_HINTS):
        return "code"
    return "text"


def model_tags(model_name: str) -> dict:
    return {"tier": model_tier(model_name), "modality": model_modality(model_name)}


# Real per-model metadata from Ollama's own /api/show -- parameter_size and
# context_length here are numbers Ollama itself reports from the model file,
# not a guess from the tag string. Cached in-process: this is static per
# pulled model version, and re-fetching all 39 on every /models/ollama poll
# would be wasteful (each call is ~15-20ms, so 39 of them adds up over time).
_OLLAMA_INFO_CACHE: dict = {}


def ollama_model_info(model_name: str) -> dict:
    if model_name in _OLLAMA_INFO_CACHE:
        return _OLLAMA_INFO_CACHE[model_name]
    info = {"parameter_size": None, "context_length": None, "capabilities": [], "quantization": None, "family": None}
    try:
        body = json.dumps({"name": model_name}).encode("utf-8")
        req = urllib.request.Request(f"{config.OLLAMA_URL}/api/show", data=body,
                                      headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        details = data.get("details") or {}
        info["parameter_size"] = details.get("parameter_size")
        info["quantization"] = details.get("quantization_level")
        info["family"] = details.get("family")
        info["capabilities"] = data.get("capabilities") or []
        model_info = data.get("model_info") or {}
        ctx_key = f"{info['family']}.context_length" if info["family"] else None
        if ctx_key and ctx_key in model_info:
            info["context_length"] = model_info[ctx_key]
        else:
            # family-prefixed key didn't match (name variant) -- fall back to
            # the first key that ends in ".context_length" rather than
            # silently reporting nothing.
            for k, v in model_info.items():
                if k.endswith(".context_length"):
                    info["context_length"] = v
                    break
    except Exception:
        pass  # unreachable/unknown model -- info stays all-None, honest about not knowing rather than guessing
    _OLLAMA_INFO_CACHE[model_name] = info
    return info


def _param_size_to_b(parameter_size: str) -> float | None:
    """'1.2B' -> 1.2, '137M' -> 0.137. None if unparseable."""
    if not parameter_size:
        return None
    m = _re.match(r"([\d.]+)\s*([BMK])", parameter_size.strip(), _re.IGNORECASE)
    if not m:
        return None
    value, unit = float(m.group(1)), m.group(2).upper()
    return {"B": value, "M": value / 1000, "K": value / 1_000_000}[unit]


def model_tags_real(provider: str, model_name: str) -> dict:
    """Best available tagging: real Ollama /api/show metadata when the
    provider is ollama (parameter_size, context_length, and capabilities are
    all Ollama-reported, not guessed); the name-heuristic (model_tags) for
    the single-model OpenAI-compatible backends, which have no equivalent
    introspection endpoint. `source` says which one produced this so the UI
    can be honest about it rather than presenting a guess as a measurement."""
    if provider != "ollama":
        tags = model_tags(model_name)
        tags["source"] = "name-heuristic"
        tags["parameter_size"] = None
        tags["context_length"] = None
        tags["capabilities"] = []
        return tags

    info = ollama_model_info(model_name)
    caps = info["capabilities"]
    if "vision" in caps:
        modality = "vision"
    elif "embedding" in caps:
        modality = "embedding"
    elif "safety" in model_modality(model_name):  # capabilities don't flag this; name-check is the only signal
        modality = "safety"
    elif model_modality(model_name) == "code":  # capabilities don't distinguish "code" either -- name-check
        modality = "code"
    else:
        modality = "text"

    size_b = _param_size_to_b(info["parameter_size"])
    if size_b is None:
        tier = "unknown"
    else:
        tier = "small" if size_b <= SMALL_LARGE_CUTOFF_B else "large"

    return {
        "tier": tier,
        "modality": modality,
        "source": "ollama-api-show",
        "parameter_size": info["parameter_size"],
        "context_length": info["context_length"],
        "capabilities": caps,
    }


# How long Ollama keeps a model resident in VRAM after a call before
# unloading it. Cold start (disk -> VRAM) is what makes a call take
# 18-80s instead of under a second -- this is the actual fix for that,
# not just a routing workaround. Matches the shared engine's own
# OLLAMA_KEEP_ALIVE default (see agentic-ollama-platform/app/ollama_client.py)
# so both call paths agree on how long a model stays warm.
import os as _os2
OLLAMA_KEEP_ALIVE = _os2.environ.get("OLLAMA_KEEP_ALIVE", "30m")


def _call_openai_compatible(base_url: str, model: str, prompt: str, timeout: float = 120.0,
                             keep_alive: str = None, images_b64: list = None) -> str:
    """Real HTTP call to a local OpenAI-compatible /v1/chat/completions
    endpoint. No fabrication, no fallback text — raises on any failure.
    `keep_alive` is an Ollama-specific extension field; harmless to include
    for the other OpenAI-compatible servers, which ignore unknown fields.
    `images_b64` is a list of (mime_type, base64_data) pairs, using the
    standard OpenAI vision content-array shape -- if the target model isn't
    vision-capable, the server errors rather than silently ignoring the
    image, so callers should check capabilities first (see attachments.py /
    main.py) instead of relying on this to fail gracefully."""
    if images_b64:
        content = [{"type": "text", "text": prompt}] + [
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}} for mime, b64 in images_b64
        ]
    else:
        content = prompt
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
        "stream": False,
    }
    if keep_alive:
        payload["keep_alive"] = keep_alive
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


class ProviderError(RuntimeError):
    """Wraps a provider-specific failure with the provider name attached, so
    the API layer can report exactly which provider failed and why — never a
    generic 'something went wrong'."""

    def __init__(self, provider: str, message: str):
        super().__init__(message)
        self.provider = provider


def call_provider(provider: str, prompt: str, model: str = None, images_b64: list = None) -> str:
    """Real call, no fabrication, no fallback-to-fake-text. Raises
    ProviderError on any failure (including the fail-closed Claude case).
    `images_b64`: see _call_openai_compatible -- only wired up for ollama
    below; the other local backends serve one fixed non-vision coder model
    each, and cloud vision support is out of scope for now (honest gap, not
    silently dropped -- main.py checks capabilities before calling with
    images so a non-vision model errors clearly instead of ignoring them)."""
    if provider == "ollama":
        try:
            # explicit model requested -> talk to Ollama's own OpenAI-compatible
            # endpoint directly so the caller can pick ANY of the 39 pulled
            # models. No explicit model -> two-layer default: small/fast model
            # for ordinary messages, large model for long/complex ones (see
            # _pick_ollama_default) -- also via the direct endpoint, not the
            # shared engine's fixed "general" mapping, so the length-aware
            # choice is actually honored rather than overridden.
            chosen = model or _pick_ollama_default(prompt)
            return _call_openai_compatible(config.OLLAMA_URL, chosen, prompt,
                                            keep_alive=OLLAMA_KEEP_ALIVE, images_b64=images_b64)
        except Exception as e:  # circuit breaker / network / model-missing
            raise ProviderError("ollama", f"Ollama call failed: {e}") from e
    if provider == "openai":
        try:
            return bridge.call_openai(prompt, model=model)
        except bridge.OpenAINotConfiguredError as e:
            raise ProviderError("openai", str(e)) from e
        except Exception as e:
            raise ProviderError("openai", f"OpenAI call failed: {e}") from e
    if provider == "claude":
        try:
            return bridge.call_claude(prompt, model=model)
        except bridge.AnthropicNotConfiguredError as e:
            raise ProviderError("claude", str(e)) from e
        except Exception as e:
            raise ProviderError("claude", f"Claude call failed: {e}") from e
    if provider in LOCAL_OPENAI_COMPATIBLE:
        base_url, default = LOCAL_OPENAI_COMPATIBLE[provider]
        chosen = model or default
        if provider == "llamacpp" and chosen in LLAMACPP_MODELS:
            base_url = LLAMACPP_MODELS[chosen]  # route to the specific instance that actually serves this model
        try:
            return _call_openai_compatible(base_url, chosen, prompt)
        except urllib.error.URLError as e:
            raise ProviderError(provider, f"{provider} unreachable at {base_url}: {e}") from e
        except Exception as e:
            raise ProviderError(provider, f"{provider} call failed: {e}") from e
    raise ProviderError(provider, f"unknown provider '{provider}'")


def resolve_model(provider: str, prompt: str, explicit: str = None) -> str:
    """The SINGLE source of truth for 'which model will actually be used' --
    callers must use this (not default_model()) whenever they need to log,
    cache-key, or display the model BEFORE calling call_provider, so that
    value can't drift from what call_provider itself picks. default_model()
    alone is prompt-length-blind and would report the small tier even for a
    long prompt that's about to get the large one."""
    if explicit:
        return explicit
    if provider == "ollama":
        return _pick_ollama_default(prompt)
    return default_model(provider)


def default_model(provider: str) -> str:
    if provider == "ollama":
        return OLLAMA_SMALL_MODEL
    if provider == "openai":
        import os
        return os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    if provider == "claude":
        import os
        return os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5")
    if provider in LOCAL_OPENAI_COMPATIBLE:
        return LOCAL_OPENAI_COMPATIBLE[provider][1]
    return "unknown"


def list_ollama_models() -> list:
    """Real query of every model actually pulled into the Ollama instance
    this app talks to — not a hardcoded list, so it stays correct as models
    are added/removed."""
    req = urllib.request.Request(f"{config.OLLAMA_URL}/api/tags")
    with urllib.request.urlopen(req, timeout=8) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return sorted(m["name"] for m in data.get("models", []))
