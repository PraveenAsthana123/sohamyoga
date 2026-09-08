# SohamYoga ContextForge federation

This deployment runs IBM ContextForge as a separate, authenticated control
plane on the existing SohamYoga Docker network.

The image is pinned to digest
`sha256:89c3df1d31ed3c9eeabe720f26b632d03abf53fba8b041e2542b2f2d0c2832c7`
(IBM source revision `f909289b2f62a98e2076357bb79d12e80e4a7fed`). IBM's
documented RC and numbered tags were unavailable from GHCR during setup, so the
published `latest` image was pulled once and converted to an immutable digest.

## Start and verify

```bash
./deploy/contextforge/bootstrap.sh
docker compose -f docker-compose.contextforge.yml up -d
./deploy/contextforge/healthcheck.sh
```

Admin UI: `http://127.0.0.1:4444/admin`. The bootstrap email and generated
password are stored in the mode-600 ignored file
`deploy/contextforge/.env.contextforge.local`.

## Federation policy

- Authentication is mandatory for the Admin API and MCP endpoints.
- Public visibility, Basic auth, and query-string credentials are disabled.
- Strong JWT and encryption secrets are generated independently.
- ContextForge binds to loopback; expose it through TLS and SSO before remote use.
- The local SQLite deployment intentionally uses one gateway worker. Move the
  ContextForge database to PostgreSQL before enabling replicas or multi-node use.
- SohamYoga write tools retain their existing approval checks. ContextForge is
  an additional registry, policy, rate-limit, and observability layer, not a
  way to bypass application authorization.
- Register only genuine Streamable HTTP, SSE, WebSocket, or MCP servers under
  Gateways. The current `/api/mcp/social` route is an application HTTP facade,
  not a protocol-compliant upstream MCP server.

After adding a compliant upstream, register it in the Admin UI under Gateways,
use the container-network URL (for example `http://service-name:port/mcp`), and
create a private virtual server containing only approved tools.

## Known issue: volume ownership (fixed 2026-09-02)

The image runs as uid 10001 (`app`), but a freshly created named Docker
volume is root-owned by default. Without the `contextforge-init` one-shot
service in the compose file, the app can never open its SQLite file at
`/data/contextforge.db` -- and the failure mode is silent: the container
logs "Server is ready," reports `Up`, but every DB-touching request
(including `/health`) hangs forever at 0% CPU rather than erroring. `docker
compose up` now runs `contextforge-init` (a `busybox chown -R 10001:10001
/data`) before the gateway starts, so this can't recur on a fresh volume.
If you ever see this again: `docker exec sohamyoga-contextforge touch
/data/testfile` returning `Permission denied` confirms it; re-run `docker
compose -f docker-compose.contextforge.yml up -d contextforge-init` to fix.
