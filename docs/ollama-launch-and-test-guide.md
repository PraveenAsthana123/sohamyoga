# Ollama launch and test guide

All commands work from any directory after running `bash /mnt/deepa/sohamyoga/scripts/install-global-ai.sh` once.

## One-command control

```bash
soham-ai start
soham-ai status
soham-ai urls
soham-ai open
soham-ai test-all
soham-ai doctor
```

## Chat, code, plans and jobs

```bash
soham-ai chat
soham-ai chat "Write a dental campaign headline"
soham-ai code "Review this file and propose a safe fix" app.py
soham-ai plan "Test all APIs and prepare a failure report"
soham-ai job "Build and test the current project"
soham-ai jobs
soham-ai run
soham-ai warm code
soham-ai models
```

`job` creates a persistent plan, routes specialist tasks to suitable local models, monitors execution, verifies results and prints the final response. `plan` queues without waiting. The systemd worker continues scheduled work after the terminal closes.

## Browser UIs

```bash
soham-ai portal
soham-ai paperclip
soham-ai openclaw
```

- SohamYoga Operations Centre: unified models, workflows, integrations, dashboards and voice/typed job submission.
- Database Schema Catalogue: live tables, columns, primary/foreign keys and views.
- Paperclip: organizations of agents, goals, roles, tickets, budgets, approvals and heartbeats.
- OpenClaw: assistant/chat gateway using the local `ollama/qwen3:8b` model.

Ports are controlled by `~/.config/sohamyoga/ports.env`.

Choose all ports yourself with one command (frontend, backend, Paperclip, OpenClaw, gateway):

```bash
soham-ai configure-ports 18085 15070 13200 18889 18091
```

The command rejects duplicate, reserved, invalid, or occupied ports, rewrites the private port file, regenerates OpenClaw configuration, and restarts the stack. The Operations Centre reads these values dynamically; it does not keep separate hardcoded links.

The schema catalogue is administrator-only. Sign in through the SohamYoga portal first; unauthenticated API requests intentionally return HTTP 401.

## VS Code and coding agent

```bash
cd /path/to/any/project
soham-ai vscode
soham-ai aider
```

VS Code has the `soham-ollama-director` MCP server and Continue Ollama models configured globally. Aider uses `qwen2.5-coder:14b` locally.

## MCP

```bash
soham-ai mcp-test
```

Tools exposed: `ollama_plan`, `ollama_status`, `ollama_run`, and `ollama_health`. MCP makes tools available to compatible AI clients; it is not itself a chat UI and tool execution should retain human approval for sensitive actions.

## Slack

Create a Slack app, enable Socket Mode, grant `app_mentions:read`, `chat:write`, `im:history`, `im:read`, and `im:write`, and subscribe to `app_mention` and `message.im`. Save tokens locally:

```bash
mkdir -p ~/.config/sohamyoga
nano ~/.config/sohamyoga/integrations.env
chmod 600 ~/.config/sohamyoga/integrations.env
```

File contents:

```bash
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_APP_TOKEN=xapp-your-token
```

Launch with `soham-ai slack`. Socket Mode does not require a public inbound URL.

## Logs and recovery

```bash
journalctl --user -u soham-ollama-worker -f
journalctl --user -u soham-ollama-gateway -f
journalctl --user -u openclaw-gateway -f
journalctl --user -u soham-paperclip -f
systemctl --user restart soham-ollama-worker soham-ollama-gateway
oll heal
```
