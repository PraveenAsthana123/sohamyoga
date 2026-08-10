# Using local Ollama directly

## Already installed on this machine

- Ollama server with 39 local models.
- Global `oll` director command at `~/.local/bin/oll`.
- VS Code and Continue configured for Ollama chat, edit, autocomplete and embeddings.
- Aider for local autonomous code editing.
- SohamYoga MCP bridge configured in VS Code and Codex.
- Persistent systemd user services for the worker, API gateway and watchdog.

## Terminal

```bash
oll "your request"       # mandatory plan -> jobs -> monitor -> final response
oll status               # recent jobs
oll health               # runtime health
oll events 30            # lifecycle events
oll chat                  # explicit direct chat without a plan
oll code "coding task"   # Aider + local coding model; may edit the repository
```

## Editors

- VS Code Continue: select a configured Qwen coder model; no cloud key is required.
- Aider: `oll code "task"` or `aider --model ollama_chat/qwen2.5-coder:latest`.
- Codex and Claude keep their own primary model providers. After restart they can invoke the `soham-ollama-director` MCP tools to delegate work locally, but MCP does not replace their core model or guarantee operation after their client authentication/token limit ends.
- When cloud clients are unavailable, use the independent `oll` terminal command directly.

## Desktop MCP tools

- `ollama_plan`
- `ollama_status`
- `ollama_run`
- `ollama_health`

Restart VS Code and start a new Codex session after configuration changes so they reload MCP servers.

## Services

```bash
systemctl --user status soham-ollama-worker
systemctl --user status soham-ollama-gateway
systemctl --user status soham-ollama-watchdog.timer
curl http://127.0.0.1:8091/health
```

To keep user services alive after logout/reboot, run once with administrator permission:

```bash
sudo loginctl enable-linger "$USER"
```

Do not load all 39 models simultaneously. The gateway exposes all installed models, while role routing loads only the appropriate model. This avoids VRAM exhaustion and reduces cold-start thrashing.
