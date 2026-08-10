# Local agent platforms

## Endpoints

- SohamYoga operations centre: `http://localhost:8085/admin/operations-center`
- Paperclip: `http://127.0.0.1:3200`
- OpenClaw: `http://127.0.0.1:18889`
- Ollama director health: `http://127.0.0.1:8091/health`

Paperclip runs in trusted, loopback-only mode and uses its own embedded PostgreSQL database. OpenClaw is loopback-only and its default model is `ollama/qwen3:8b`. These addresses are intentionally not exposed to the public network.

All service ports are user-configurable in `~/.config/sohamyoga/ports.env`. After changing a port, restart the affected service. OpenClaw additionally requires `openclaw gateway install --force --port "$SOHAM_OPENCLAW_PORT"` to regenerate its service definition.

## Service commands

```bash
systemctl --user status soham-paperclip openclaw-gateway soham-ollama-worker soham-ollama-gateway
systemctl --user restart soham-paperclip openclaw-gateway
journalctl --user -u soham-paperclip -f
journalctl --user -u openclaw-gateway -f
```

Submit local work from any terminal with:

```bash
oll "Create a campaign plan for a dental customer"
```

## Paperclip database

Paperclip applies its migrations during startup and performs hourly backups. Create an immediate backup with:

```bash
cd /mnt/deepa/sohamyoga/integrations/paperclip
pnpm db:backup
```

## Harness AI activation

Harness is a hosted account integration, not a local Ollama replacement. Full activation requires a Harness account with AI Agents enabled, a project/org scope, an API key or service account, and a supported model connector. Keep those values in the secret store or environment; do not commit them. Until supplied, the operations centre reports Harness as awaiting account connection.

## Social developer accounts

OAuth code, callbacks, encrypted credential storage, refresh and health checks can be implemented locally, but each social network still requires its owner to create/verify a developer application, accept its legal terms and approve requested permissions. CAPTCHA, identity and business-verification steps cannot be automated safely.
