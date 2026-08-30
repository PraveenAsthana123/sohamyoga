"""Unified call surface over the three providers. Every function here calls
straight into the real, already-existing engine code (see bridge.py) — no
provider logic is reimplemented, only adapted to a common
`(text, model) -> str` shape the router/API layer can use uniformly.
"""
from . import bridge


class ProviderError(RuntimeError):
    """Wraps a provider-specific failure with the provider name attached, so
    the API layer can report exactly which provider failed and why — never a
    generic 'something went wrong'."""

    def __init__(self, provider: str, message: str):
        super().__init__(message)
        self.provider = provider


def call_provider(provider: str, prompt: str, model: str = None) -> str:
    """Real call, no fabrication, no fallback-to-fake-text. Raises
    ProviderError on any failure (including the fail-closed Claude case)."""
    if provider == "ollama":
        try:
            # task_type="general" -> ollama_client.route_model picks MODEL_MAP["general"]
            # unless a caller overrides via `model` (not currently exposed in the UI,
            # kept for API completeness / future project-specific model pinning).
            return bridge.call_ollama(prompt, task_type="general", cache=False)
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
    raise ProviderError(provider, f"unknown provider '{provider}'")


def default_model(provider: str) -> str:
    if provider == "ollama":
        return bridge.route_model("general")
    if provider == "openai":
        import os
        return os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    if provider == "claude":
        import os
        return os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5")
    return "unknown"
