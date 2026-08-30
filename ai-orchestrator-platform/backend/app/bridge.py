"""Single place that wires this NEW project onto the ALREADY-RUNNING
agentic-ollama-platform engine — imports its real modules in-process instead
of re-implementing any of the routing/queueing/calling logic. Per the build
brief: "DO NOT duplicate this engine — extend it and call into it."

Every function below is a thin pass-through to a function that already exists
and already runs in production (the soham-ollama-worker.service systemd unit
imports the exact same `agents` package). We do not touch
agentic-ollama-platform/app/ollama_client.py's MODEL_MAP or any other file in
that project.
"""
import sys

from . import config

if config.OLLAMA_PLATFORM_ROOT not in sys.path:
    sys.path.insert(0, config.OLLAMA_PLATFORM_ROOT)
_app_dir = f"{config.OLLAMA_PLATFORM_ROOT}/app"
if _app_dir not in sys.path:
    sys.path.insert(0, _app_dir)

# Real, already-running engine pieces:
import ollama_client  # noqa: E402  (agentic-ollama-platform/app/ollama_client.py)
from agents import SPECIALISTS  # noqa: E402  (agentic-ollama-platform/agents/__init__.py)
from agents.openai_agent import call_openai, OpenAINotConfiguredError  # noqa: E402
from agents.claude_agent import call_claude, AnthropicNotConfiguredError  # noqa: E402

call_ollama = ollama_client.call_ollama
ollama_up = ollama_client.ollama_up
route_model = ollama_client.route_model
MODEL_MAP = ollama_client.MODEL_MAP

__all__ = [
    "call_ollama", "ollama_up", "route_model", "MODEL_MAP", "SPECIALISTS",
    "call_openai", "OpenAINotConfiguredError",
    "call_claude", "AnthropicNotConfiguredError",
    "ollama_client",
]
