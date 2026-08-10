#!/usr/bin/env bash
set -u

CODEX_BIN="/home/praveen/.vscode/extensions/openai.chatgpt-26.727.40816-linux-x64/bin/linux-x86_64/codex"
PLUGINS=(canva heygen github posthog sentry)

if [[ ! -x "$CODEX_BIN" ]]; then
  echo "Codex executable not found: $CODEX_BIN" >&2
  exit 1
fi

echo "Using: $($CODEX_BIN --version)"
echo "Installing into user profile: /home/praveen/.codex"

failed=0
for plugin in "${PLUGINS[@]}"; do
  echo
  echo "Installing ${plugin}@openai-curated..."
  if ! "$CODEX_BIN" plugin add "${plugin}@openai-curated" --json; then
    echo "FAILED: ${plugin}" >&2
    failed=1
  fi
done

echo
echo "Current plugin status:"
"$CODEX_BIN" plugin list

if (( failed )); then
  echo "One or more installations failed. Copy the complete error output." >&2
  exit 1
fi

echo
echo "Installation completed. Restart VS Code/Codex and authorize each connector."
