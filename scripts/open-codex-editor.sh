#!/usr/bin/env bash
set -euo pipefail

readonly PROJECT_DIR="/mnt/deepa/sohamyoga"
readonly USER_DATA_DIR="/home/praveen/.config/Code-SohamYoga-Codex"
readonly EXTENSIONS_DIR="/home/praveen/.vscode-sohamyoga-codex/extensions"

export PATH="/home/praveen/.npm-global/bin:/home/praveen/.local/bin:${PATH}"

exec /usr/bin/code \
  --new-window \
  --user-data-dir "${USER_DATA_DIR}" \
  --extensions-dir "${EXTENSIONS_DIR}" \
  "${PROJECT_DIR}"
