# Local coding when cloud quota is exhausted

Verified September 8, 2026. Local inference uses your hardware, without a cloud token allowance. Local models still have context limits and can be slow.

## VS Code terminal: local file-editing mode

Added September 9, 2026. When the cloud CLI reports a session limit, exit it with Ctrl+C and run:

```bash
/home/praveen/.local/bin/ollama-code
```

Or use **Terminal > Run Task > Ollama: Local Coding**. The terminal profile dropdown also contains **Ollama Local Coding**. This starts an independent Aider session backed entirely by Ollama11435. Your existing cloud conversation is not transferred automatically: provide the current goal, relevant files, and next step.

- `/add path/to/file` includes a file for editing.
- `/ask Explain this function` asks without editing.
- Give a specific change request to edit selected files.
- `/diff` reviews changes; `/run <test command>` runs your chosen check.
- `/clear` clears chat when context gets too large; `/drop path/to/file` removes unnecessary files.
- `/exit` ends local coding.
- `ollama-code --strong` selects the installed larger7B model; it needs more memory and may be slower.

The launcher uses a fixed8192-token context,2048-token output budget, whole-file edits, no automatic commits, no repository map, and local per-project history under ~/.local/state/ollama-code. Start with one or two small files. Cloud SDK keys are not needed. This changes the terminal workflow, not the model inside the existing cloud extension session.

## Quick code chat

```bash
source /home/praveen/venv-ardupilot/bin/activate
/home/praveen/.local/bin/ai-code-fast
```

This uses the existing qwen2.5-coder:3b on Ollama port 11435. It generates code in chat; it does not edit project files. `/bye` exits. `ai-code` uses the larger qwen2.5-coder:latest model.

## Edit selected project files with Aider

Aider 0.86.2 is already installed. Launch from the project directory:

```bash
source /home/praveen/venv-ardupilot/bin/activate
cd /mnt/deepa/sohamyoga
export OLLAMA_API_BASE=http://127.0.0.1:11435
/home/praveen/.local/bin/aider --model ollama_chat/qwen2.5-coder:3b --no-auto-commits
```

Use `/add path/to/file`, request one small change, inspect `/diff`, then run the relevant tests. Prefer one or two files per task. This launch command is based on Aider's documented Ollama support; a full automated file-edit task has not been verified in this audit.

## OpenClaw

Dashboard: http://127.0.0.1:18889/

Existing default model: ollama/qwen3:8b. The native Ollama endpoint is now explicitly configured as http://127.0.0.1:11435, without /v1. The config validated and the running gateway hot-reloaded it. OpenClaw infer model run with ollama/qwen2.5-coder:3b returned ok:true, transport:local, and OK. In a fresh chat, select a local model using `/model ollama/qwen2.5-coder:3b` if offered. Full agent/tool reliability is not established by a direct inference test. The current default workspace is not assumed to be this repository: give the exact project path and constrain the task.

CLI location (not currently on the normal PATH):

```bash
source /home/praveen/venv-ardupilot/bin/activate
/home/praveen/.nvm/versions/node/v22.22.2/bin/node /mnt/deepa/openclaw/cli/node_modules/openclaw/dist/index.js tui
```

## Existing servers

- Ollama 11435: fuller existing local model library; 3B coding test succeeded in about 27 seconds.
- Ollama 11434: separate smaller library; earlier 7B test timed out after 50 seconds.
- llama.cpp 8082: OpenAI-compatible API and web UI; short code test succeeded in about 38 seconds. http://127.0.0.1:8082/
- llama.cpp 8084: model listing responded; generation not tested.
- LiteLLM 4400: existing gateway advertises fast/code/strong routes to Ollama11435. Listing verified, generation through this gateway not tested in this audit.
- OmniRoute 20128: running; free cloud routes are not equivalent to offline local inference.
- ZCode AppImage and launcher exist; its model configuration is not verified.

## Limits and continuity

Installed gateways do not automatically switch an existing cloud coding session. Start a local session explicitly and provide the goal, files changed, failing test and next step. Context-window exhaustion requires a shorter context or a new session even locally. The host was under substantial RAM/swap pressure during this audit; adding more gateways does not make inference faster. The 3B model is a practical starting point for small tasks, not a claim of cloud-model-equivalent coding quality.

Sources: https://aider.chat/docs/llms/ollama.html and https://docs.openclaw.ai/providers/ollama
