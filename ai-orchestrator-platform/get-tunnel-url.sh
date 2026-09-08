#!/usr/bin/env bash
# Quick tunnels get a fresh https://<random>.trycloudflare.com URL every
# time the tunnel restarts -- this prints whatever the CURRENT one is by
# reading it back out of the running service's log.
set -euo pipefail
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /home/praveen/.local/state/praveenchatbot/tunnel.log | tail -1
