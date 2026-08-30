#!/bin/sh
set -eu
cd "$(dirname "$0")"
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python 'faster-whisper==1.2.1'
install -d "$HOME/.local/bin" "$HOME/.local/share/applications"
ln -sfn "$(pwd)/voice-terminal" "$HOME/.local/bin/voice-terminal"
install -m 0755 voice-terminal.desktop "$HOME/.local/share/applications/voice-terminal.desktop"
desktop_dir="$(xdg-user-dir DESKTOP 2>/dev/null || printf '%s/Desktop' "$HOME")"
if [ -d "$desktop_dir" ]; then
  install -m 0755 voice-terminal.desktop "$desktop_dir/Voice Terminal.desktop"
  gio set "$desktop_dir/Voice Terminal.desktop" metadata::trusted true 2>/dev/null || true
fi
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
printf 'Installed: %s\n' "$HOME/.local/bin/voice-terminal"
