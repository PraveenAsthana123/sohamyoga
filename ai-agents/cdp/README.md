# CDP · Chrome DevTools Protocol

Programmatic browser control (DOM · screenshot · click · execute JS).
Server-side via headless Chrome on `:9222`. Per §91.

| File | Purpose |
|---|---|
| `deep/backend/cdp_manager.py` | Python wrapper over CDP WebSocket |
| `deep/frontend/useCDPSession.js` | React hook · WebSocket bridge |
| `deep/docs/` | Architecture · CDP method reference |
| `deep/examples/` | Sample workflows |
| `deep/scripts/` | Docker compose for headless Chrome |
| `deep/tests/` | Mock browser tests |

## Install
- Docker: chrome service in `docker-compose.yml` (port 9222)
- Backend: `pip install websockets httpx`
