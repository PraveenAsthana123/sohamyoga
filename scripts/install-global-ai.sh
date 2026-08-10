#!/usr/bin/env bash
set -euo pipefail
ROOT="/mnt/deepa/sohamyoga"
mkdir -p "$HOME/.local/bin" "$HOME/.config/sohamyoga"
ln -sfn "$ROOT/scripts/soham-ai" "$HOME/.local/bin/soham-ai"
ln -sfn "$ROOT/agentic-ollama-platform/oll.py" "$HOME/.local/bin/oll"
ln -sfn "$ROOT/scripts/paperclipai-global" "$HOME/.local/bin/paperclipai"
ln -sfn "$ROOT/scripts/setup-social-developer-apps.sh" "$HOME/.local/bin/soham-social-setup"
ln -sfn "$ROOT/scripts/check-meta-publishing.sh" "$HOME/.local/bin/soham-meta-check"
chmod +x "$ROOT/scripts/soham-ai" "$ROOT/scripts/paperclipai-global" "$ROOT/scripts/setup-social-developer-apps.sh" "$ROOT/scripts/setup-meta-publishing-runtime.sh" "$ROOT/scripts/check-meta-publishing.sh" "$ROOT/scripts/install-global-ai.sh" "$ROOT/agentic-ollama-platform/oll.py"
install -m 0644 "$ROOT/agentic-ollama-platform/OLLAMA_GLOBAL_POLICY.md" "$HOME/.config/sohamyoga/OLLAMA_GLOBAL_POLICY.md"
install -m 0644 "$ROOT/docs/ollama-launch-and-test-guide.md" "$HOME/.config/sohamyoga/OLLAMA_USAGE.md"
grep -q 'HOME/.local/bin' "$HOME/.profile" 2>/dev/null || printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.profile"
echo 'Installed: oll, soham-ai, soham-social-setup, and Paperclip CLI (when available).'
echo 'Run: source ~/.profile && soham-ai doctor'
