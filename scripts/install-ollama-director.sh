#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$PROJECT_ROOT/agentic-ollama-platform/oll.py"
BIN_DIR="${HOME}/.local/bin"
TARGET="$BIN_DIR/oll"

mkdir -p "$BIN_DIR"
if [[ -e "$TARGET" && ! -L "$TARGET" ]]; then
  BACKUP="$TARGET.before-director"
  if [[ ! -e "$BACKUP" ]]; then
    mv "$TARGET" "$BACKUP"
    echo "Saved previous command at $BACKUP"
  else
    rm "$TARGET"
  fi
fi
ln -sfn "$SOURCE" "$TARGET"
chmod +x "$SOURCE"

echo "Installed Ollama director: $TARGET -> $SOURCE"
echo "Run: oll \"your request\""
echo "Direct chat remains available with: oll chat"
