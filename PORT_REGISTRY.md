# Port Registry — sohamyoga workspace (and neighboring projects on this machine)

**MANDATORY.** Before starting any dev server, docker-compose stack, or picking a port for
a new service anywhere in `/mnt/deepa/sohamyoga` (or a sibling project sharing this machine),
run `scripts/check-port-registry.sh <port>` first. If the port is taken, pick the next free
one, add a row here, and update whatever config references it (`.env`, `next dev -p`,
`docker-compose.yml`, `playwright.config.ts` `SOHAM_BASE_URL`, etc.) in the same change.

Generated from live `ss -tlnp` + `docker ps` output on 2026-09-01 — this is a real snapshot,
not a guess. Re-verify before trusting an old entry; ports get reassigned.

## Root cause this registry exists to prevent (2026-09-01 incident)

`sohamyoga-frontend`'s local dev workflow (`npm run dev` / `next dev`) has always defaulted
to port **8085** — the SAME port `docker-compose.yml` maps `sohamyoga-nginx` to
(`"8085:80"`, proxying to the **containerized** `sohamyoga-frontend`/`sohamyoga-backend`
stack, port 3010/5070 internally — a separate deployment from the local dev server).
Whenever the docker-compose stack is brought up while a local dev server is also running
on 8085, one of them silently loses the port (`EADDRINUSE`) and every subsequent
`curl`/Playwright run against 8085 silently hits whichever process actually won the bind —
which may be a stale/different build with different routes, producing confusing 404s that
look like application bugs but are a port collision. **Fix**: local dev now defaults to
**8095** (not 8085) to structurally avoid this — see `sohamyoga-frontend/package.json`.

## sohamyoga workspace — fixed/compose ports (docker-compose.yml)

| Port | Service | Container | Notes |
|---|---|---|---|
| 8085 | nginx (reverse proxy) | sohamyoga-nginx | Proxies to containerized frontend/backend. **Do not run local `next dev` on this port.** |
| 443 | nginx (TLS) | sohamyoga-nginx | |
| 3110→3010 | frontend (containerized build) | sohamyoga-frontend | Distinct from the local `npm run dev` process — a separate, often-stale build |
| 5070 | backend (.NET API) | sohamyoga-backend | |
| 5437→5432 | Postgres (sohamyoga) | sohamyoga-postgres | The real DB every app/job/test in this repo uses |
| 15081→3000 | Postiz (public API) | sohamyoga_postiz | `POSTIZ_PUBLIC_API_BASE` default |
| 15080→5000 | Postiz (internal) | sohamyoga_postiz | |
| 18233→8233 | Postiz Temporal | sohamyoga_postiz_temporal | |
| 18181→80 | Activepieces | sohamyoga-activepieces | |
| 18090→80 | Mautic | sohamyoga-mautic | |
| 18200→8200 | OpenBao (secrets) | sohamyoga-openbao | |
| 18080→8080 | Skyvern UI | soham-skyvern-skyvern-ui-1 | |
| 19090→9090 | Skyvern UI (alt) | soham-skyvern-skyvern-ui-1 | |
| 18000→8000 | Skyvern API | soham-skyvern-skyvern-1 | |
| 16080→6080 | Skyvern (VNC) | soham-skyvern-skyvern-1 | |
| 15060→5060 | Asterisk (SIP) | asterisk-asterisk-1 | |
| 16000–16049→10000–10049/udp | Asterisk (RTP) | asterisk-asterisk-1 | |

## sohamyoga workspace — local dev-server ports (npm run dev, not docker)

| Port | Project | Notes |
|---|---|---|
| **8095** | sohamyoga-frontend (local dev) | **New default as of 2026-09-01**, moved off 8085 to avoid the nginx collision above |
| 8086 | market-research-portal (local dev) | `MRP_PORT` env var, defaults to 8086 |
| 15070 | SohamYoga.Web (.NET backend, local dev) | `dotnet run --urls http://127.0.0.1:15070`; this is what `NEXT_PUBLIC_API_URL`/`INTERNAL_API_URL` in `sohamyoga-frontend/.env.local` actually point to — distinct from the containerized backend on 5070. Was missing from this registry until found live 2026-09-01 while diagnosing a CORS bug (`Cors:AllowedOrigins` in `appsettings.json` must include whatever port the frontend dev server runs on, e.g. `http://127.0.0.1:8095`). |

## Neighboring projects on this same machine (not sohamyoga, but share the port space)

| Port | Project | Notes |
|---|---|---|
| 8090 | voice-agent-platform | local `next dev` |
| 8092 | password-manager | local `next dev` |
| 5439→5432 | password-manager Postgres | passwordmanager-postgres container |
| 5438→5432 | voice-agent-platform Postgres | voiceagent-postgres container |
| 4200 | unidentified — root-owned `next start` process (PID 1230426 at last check) | Investigate before reusing; not part of sohamyoga |
| 13000 | epilepsy-open-webui (Ollama chat portal) | Must stay running per Local AI Portal Uptime policy |
| 11434 | Ollama | Shared local model server |

## Never assume — always re-verify

This file can go stale the moment someone runs `docker-compose up` or starts a new dev
server. Before trusting any row above, re-run:

```bash
ss -tlnp 2>/dev/null | awk 'NR>1{print $4}' | grep -oE '[0-9]+$' | sort -un
docker ps --format "{{.Names}}\t{{.Ports}}"
```

and reconcile. Update this file whenever you observe drift — that is the whole point of
the registry.
