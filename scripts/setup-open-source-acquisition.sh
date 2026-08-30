#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK="$ROOT/infrastructure/acquisition-crawler"
URL=""; MAX_PAGES=50; BUILD=1
usage(){ echo "Usage: $0 --url https://company.example [--max-pages 1-200] [--no-build]"; }
while (($#));do case "$1" in --url) URL="${2:-}";shift 2;;--max-pages) MAX_PAGES="${2:-}";shift 2;;--no-build) BUILD=0;shift;;-h|--help)usage;exit 0;;*)echo "Unknown option: $1" >&2;usage;exit 2;;esac;done
[[ "$URL" =~ ^https?:// ]]||{ echo "A public http(s) company URL is required." >&2;exit 2; }
[[ "$MAX_PAGES" =~ ^[0-9]+$ ]]&&((MAX_PAGES>=1&&MAX_PAGES<=200))||{ echo "--max-pages must be 1-200." >&2;exit 2; }
mkdir -p "$STACK/data"
if((BUILD));then docker compose -f "$STACK/docker-compose.yml" build;fi
echo "Crawling public same-origin pages only; robots.txt and rate limits are enforced."
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"
CRAWL_RUN_ID="$RUN_ID" CRAWL_MAX_PAGES="$MAX_PAGES" docker compose -f "$STACK/docker-compose.yml" run --rm crawler "$URL"
echo "Dataset written under: $STACK/data/crawlee/datasets/run-$RUN_ID"
