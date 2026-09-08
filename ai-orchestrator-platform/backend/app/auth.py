"""Cookie-session auth gate for the whole app now that it's reachable over
the internet via the Cloudflare tunnel (see systemd unit
praveenchatbot-tunnel.service). Deliberately simple for a single-operator
personal tool: sessions are a random token kept in an in-memory set, not a
JWT or a DB table -- restarting the backend just means logging in again,
which is an acceptable cost here in exchange for not adding a real session
store. Implemented as a raw ASGI middleware (not BaseHTTPMiddleware) because
BaseHTTPMiddleware does not run for WebSocket scopes, and the chat WebSocket
needs to be gated exactly like every HTTP route.
"""
import secrets
import time

SESSION_COOKIE = "pcb_session"
SESSION_TTL_SECONDS = 30 * 24 * 3600  # 30 days -- log in once per machine/browser

OPEN_PATHS = {"/auth/login", "/auth/status", "/auth/logout"}
# Prefix, not exact-match: the token is dynamic (GET /share/<token>) so it
# can't live in OPEN_PATHS. Read-only by construction -- see main.py's
# get_shared_conversation, which is the only handler under this prefix and
# never accepts writes.
OPEN_PATH_PREFIXES = ("/share/",)


def _is_open(path: str) -> bool:
    return path in OPEN_PATHS or path.startswith(OPEN_PATH_PREFIXES)

_sessions: dict[str, float] = {}  # session_id -> created_at (epoch seconds)


def create_session() -> str:
    sid = secrets.token_urlsafe(32)
    _sessions[sid] = time.time()
    return sid


def destroy_session(sid: str | None):
    if sid:
        _sessions.pop(sid, None)


def session_valid(sid: str | None) -> bool:
    if not sid:
        return False
    created = _sessions.get(sid)
    if created is None:
        return False
    if time.time() - created > SESSION_TTL_SECONDS:
        del _sessions[sid]
        return False
    return True


def _parse_cookies(header_value: bytes) -> dict:
    cookies = {}
    for part in header_value.decode("latin1").split(";"):
        if "=" in part:
            k, _, v = part.strip().partition("=")
            cookies[k] = v
    return cookies


class AuthMiddleware:
    """Raw ASGI middleware so both HTTP and WebSocket scopes are gated."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket") or _is_open(scope["path"]):
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        cookies = _parse_cookies(headers.get(b"cookie", b""))
        if session_valid(cookies.get(SESSION_COOKIE)):
            await self.app(scope, receive, send)
            return

        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 4401})
            return

        await send({
            "type": "http.response.start",
            "status": 401,
            "headers": [(b"content-type", b"application/json")],
        })
        await send({"type": "http.response.body", "body": b'{"detail":"not authenticated"}'})
