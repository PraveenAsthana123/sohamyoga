#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
if [[ "${DRY_RUN:-0}" == "1" ]];then echo "[dry-run] $ROOT/scripts/setup-mautic-campaign-manager.sh";exit 0;fi
exec "$ROOT/scripts/setup-mautic-campaign-manager.sh" "$@"
