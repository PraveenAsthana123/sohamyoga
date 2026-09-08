#!/usr/bin/env python3
"""Resource-aware health and cold-start maintenance for local AI services."""

from __future__ import annotations

import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request


OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11435").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_SMALL_MODEL", "llama3.2:1b")
OLLAMA_KEEP_ALIVE = os.environ.get("OLLAMA_KEEP_ALIVE", "30m")
STATE_DIR = Path(os.environ.get(
    "PRAVEENCHATBOT_STATE_DIR",
    str(Path.home() / ".local/state/praveenchatbot"),
))

SERVICES = {
    "ollama": f"{OLLAMA_URL}/api/tags",
    "lmstudio": "http://127.0.0.1:8083/v1/models",
    "localai": "http://127.0.0.1:8081/v1/models",
    "llamacpp": "http://127.0.0.1:8082/v1/models",
    "paperclip": "http://127.0.0.1:3100/api/health",
    "openclaw": "http://127.0.0.1:18889/",
}


def request_json(url: str, body: dict | None = None, timeout: float = 5.0):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"} if data else {},
        method="POST" if data else "GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
        content_type = response.headers.get("Content-Type", "")
        return response.status, json.loads(raw) if "json" in content_type else None


def probe_services() -> dict:
    results = {}
    for name, url in SERVICES.items():
        started = time.monotonic()
        try:
            status, _ = request_json(url)
            results[name] = {
                "status": "connected" if 200 <= status < 400 else "error",
                "http_status": status,
                "latency_ms": round((time.monotonic() - started) * 1000, 1),
            }
        except Exception as exc:
            results[name] = {
                "status": "down",
                "error": str(exc)[:300],
                "latency_ms": round((time.monotonic() - started) * 1000, 1),
            }
    return results


def maintain_ollama() -> dict:
    """Warm the preferred model without evicting another active model."""
    try:
        _, payload = request_json(f"{OLLAMA_URL}/api/ps")
        loaded = [item.get("name") or item.get("model") for item in payload.get("models", [])]
        if loaded and OLLAMA_MODEL not in loaded:
            return {"action": "skipped", "reason": "another model is active", "loaded": loaded}

        started = time.monotonic()
        request_json(
            f"{OLLAMA_URL}/api/generate",
            {"model": OLLAMA_MODEL, "prompt": "", "stream": False, "keep_alive": OLLAMA_KEEP_ALIVE},
            timeout=120,
        )
        return {
            "action": "keep_alive_refreshed" if loaded else "preloaded",
            "model": OLLAMA_MODEL,
            "keep_alive": OLLAMA_KEEP_ALIVE,
            "duration_ms": round((time.monotonic() - started) * 1000, 1),
        }
    except Exception as exc:
        return {"action": "failed", "model": OLLAMA_MODEL, "error": str(exc)[:500]}


def main() -> int:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    result = {
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "services": probe_services(),
        "ollama_maintenance": maintain_ollama(),
    }
    snapshot = STATE_DIR / "local-ai-health.json"
    events = STATE_DIR / "local-ai-maintenance.jsonl"
    snapshot.write_text(json.dumps(result, indent=2) + "\n")
    with events.open("a") as handle:
        handle.write(json.dumps(result, separators=(",", ":")) + "\n")
    print(json.dumps(result, indent=2))
    return 0 if result["ollama_maintenance"]["action"] != "failed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
