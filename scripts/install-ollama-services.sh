#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_SOURCE="$PROJECT_ROOT/deploy/systemd"
UNIT_TARGET="${HOME}/.config/systemd/user"

mkdir -p "$UNIT_TARGET"
install -m 0644 "$UNIT_SOURCE/soham-ollama-worker.service" "$UNIT_TARGET/"
install -m 0644 "$UNIT_SOURCE/soham-ollama-gateway.service" "$UNIT_TARGET/"
install -m 0644 "$UNIT_SOURCE/soham-ollama-watchdog.service" "$UNIT_TARGET/"
install -m 0644 "$UNIT_SOURCE/soham-ollama-watchdog.timer" "$UNIT_TARGET/"

systemctl --user daemon-reload
systemctl --user enable --now soham-ollama-worker.service
systemctl --user enable --now soham-ollama-gateway.service
systemctl --user enable --now soham-ollama-watchdog.timer

echo "Installed persistent Ollama worker, gateway, and self-healing timer."
echo "Optional after sudo authentication: sudo loginctl enable-linger ${USER}"
