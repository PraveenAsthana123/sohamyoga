"""AI Orchestrator Platform — FastAPI backend.

Routes chat/task requests across three real providers (local Ollama via the
already-running agentic-ollama-platform engine, real OpenAI, and Claude —
fail-closed until a key exists), with per-project conversation/task history
in its own SQLite database. See README.md at the project root for the full
picture; see app/bridge.py for exactly how this avoids duplicating the
Ollama engine.
"""
import base64
import hashlib
import secrets
import time
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import attachments, auth, config, db, fsops, health, providers, router

# Cache entries never expire on their own (None) -- an exact repeat of the
# same provider+model+prompt should always be free; the /cache/clear
# endpoint below is the manual invalidation path if a model gets swapped.
CACHE_MAX_AGE_SECONDS = None


def _cache_key(provider: str, model: str, prompt: str) -> str:
    return hashlib.sha256(f"{provider}\x00{model}\x00{prompt}".encode("utf-8")).hexdigest()

app = FastAPI(title="AI Orchestrator Platform", version="0.1.0")

# Order matters: CORSMiddleware must be OUTERMOST (added last) so an OPTIONS
# preflight from a browser gets CORS-handled and short-circuited before ever
# reaching AuthMiddleware -- otherwise preflight requests (which never carry
# the session cookie) would be rejected with 401 instead of getting proper
# CORS headers. See app/auth.py for why this can't just be a FastAPI
# dependency (WebSocket routes don't run HTTP dependencies).
app.add_middleware(auth.AuthMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _warm_all_models():
    """Cold start (disk -> VRAM, or first request into a fresh process) is
    what makes the FIRST call to a given model take 18-80s instead of under
    a second. Warms every model this app can route to, in the background, so
    that first real user request doesn't pay that cost:
      - Ollama small model first (fast, cheap), THEN the large one (slower,
        ~7.6B) with a short stagger between them -- not all at once, so this
        doesn't spike CPU/memory harder than necessary on a machine already
        at ~94% swap.
      - Each llama.cpp instance (own process per model -- see
        providers.LLAMACPP_MODELS) and the single-model LocalAI/LM Studio
        servers: for these, "cold start" only really happens once per
        process lifetime, but a throwaway request here means it's already
        paid before a real user hits it.
    Best-effort and non-blocking: runs in a background thread, never delays
    server startup, and silently skips whatever isn't reachable yet."""
    import threading

    def _warm_one(base_url, model, keep_alive=None):
        try:
            providers._call_openai_compatible(base_url, model, "hi", timeout=120.0, keep_alive=keep_alive)
        except Exception:
            pass

    def _warm_all():
        _warm_one(config.OLLAMA_URL, providers.OLLAMA_SMALL_MODEL, providers.OLLAMA_KEEP_ALIVE)
        _warm_one(config.OLLAMA_URL, providers.OLLAMA_LARGE_MODEL, providers.OLLAMA_KEEP_ALIVE)
        for model, url in providers.LLAMACPP_MODELS.items():
            _warm_one(url, model)
        _warm_one(config.LOCALAI_URL, providers.LOCAL_OPENAI_COMPATIBLE["localai"][1])
        _warm_one(config.LMSTUDIO_URL, providers.LOCAL_OPENAI_COMPATIBLE["lmstudio"][1])

    threading.Thread(target=_warm_all, daemon=True).start()


@app.on_event("startup")
def _startup():
    if not config.AUTH_PASSWORD:
        raise RuntimeError(
            "ORCH_AUTH_PASSWORD is not set -- refusing to start. This app is reachable over "
            "the internet via the Cloudflare tunnel; running without a password would leave "
            "every local model it can call open to anyone with the tunnel URL. Set "
            "ORCH_AUTH_PASSWORD in backend/.env."
        )
    db.init()
    _warm_all_models()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    password: str


@app.post("/auth/login")
def auth_login(req: LoginRequest, response: Response):
    if not secrets.compare_digest(req.password, config.AUTH_PASSWORD):
        raise HTTPException(401, "incorrect password")
    sid = auth.create_session()
    # secure=False on purpose: this backend is always spoken to over plain
    # http locally (by the Vite proxy or a direct localhost browser) even
    # when the *browser's* connection to the tunnel is https -- a Secure
    # cookie would still reach the browser fine over the tunnel, but would
    # silently fail to be stored during local http://127.0.0.1 dev/testing.
    # SameSite=Lax is enough on a single-origin app with no cross-site POSTs.
    response.set_cookie(
        auth.SESSION_COOKIE, sid, max_age=auth.SESSION_TTL_SECONDS,
        httponly=True, samesite="lax", secure=False, path="/",
    )
    return {"ok": True}


@app.get("/auth/status")
def auth_status(request: Request):
    return {"authenticated": auth.session_valid(request.cookies.get(auth.SESSION_COOKIE))}


@app.post("/auth/logout")
def auth_logout(request: Request, response: Response):
    auth.destroy_session(request.cookies.get(auth.SESSION_COOKIE))
    response.delete_cookie(auth.SESSION_COOKIE, path="/")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Health / providers
# ---------------------------------------------------------------------------

@app.get("/health")
def get_health():
    statuses = health.check_all()
    for p, s in statuses.items():
        db.record_health(p, s["status"], s.get("detail", ""))
    return {
        "ok": True,
        "server_time": time.time(),
        "providers": statuses,
    }


@app.get("/providers")
def get_providers():
    statuses = health.check_all()
    return [
        {
            "provider": p,
            "default_model": providers.default_model(p),
            # Ollama specifically runs a two-layer default (see
            # providers._pick_ollama_default) -- surfaced here so the sidebar
            # can show both tiers instead of implying only one model exists.
            "large_model": providers.OLLAMA_LARGE_MODEL if p == "ollama" else None,
            "table_model": providers.OLLAMA_TABLE_MODEL if p == "ollama" else None,
            "vision_model": providers.OLLAMA_VISION_MODEL if p == "ollama" else None,
            "status": statuses[p]["status"],
            "detail": statuses[p]["detail"],
        }
        for p in ("ollama", "localai", "llamacpp", "lmstudio", "openai", "claude")
    ]


@app.get("/personas")
def get_personas():
    """Just the label + prompt text for each persona key -- a system-prompt
    swap prepended to the message (see _persona_preamble), not a separate
    agent/pipeline."""
    return [{"key": k, "prompt": v} for k, v in config.PERSONAS.items()]


@app.get("/integrations")
def get_integrations():
    """Other local tools on this machine (OpenClaw, Paperclip) -- real
    reachability check, not routed through this app's chat/task pipeline.
    Their URLs are LOCAL to this machine; opening them from a browser on a
    different device (e.g. through the Cloudflare tunnel) will not work."""
    return health.check_external_tools()


@app.get("/models/{provider}")
def get_models(provider: str):
    """Real, live model list per provider -- not a hardcoded/assumed list.
    Ollama alone typically has dozens of pulled models; localai/llamacpp/
    lmstudio each serve whatever single model they were started with.
    `tags` combines real per-model metadata for ollama (parameter_size,
    context_length, and capabilities straight from Ollama's own /api/show --
    see providers.model_tags_real) with a name-parsed heuristic for the
    single-model OpenAI-compatible backends, which expose no equivalent
    introspection endpoint. Each tag's `source` field says which one it is."""
    import urllib.request as _u
    import json as _j
    urls = {"ollama": config.OLLAMA_URL, "localai": config.LOCALAI_URL,
            "llamacpp": config.LLAMACPP_URL, "lmstudio": config.LMSTUDIO_URL}
    if provider not in urls:
        raise HTTPException(400, f"no live model list for provider '{provider}' (cloud providers use one configured model)")
    try:
        if provider == "ollama":
            with _u.urlopen(f"{urls[provider]}/api/tags", timeout=8) as resp:
                data = _j.loads(resp.read().decode("utf-8"))
            names = sorted(m["name"] for m in data.get("models", []))
        elif provider == "llamacpp":
            # Friendly names we assign (providers.LLAMACPP_MODELS), not
            # llama-server's own /v1/models id -- that's the raw GGUF blob
            # path on disk, unreadable to a human. Each name maps to its own
            # instance/port; see config.LLAMACPP_EXTRA_URL's docstring.
            names = list(providers.LLAMACPP_MODELS.keys())
        else:
            with _u.urlopen(f"{urls[provider]}/v1/models", timeout=8) as resp:
                data = _j.loads(resp.read().decode("utf-8"))
            names = [m.get("id") for m in data.get("data", [])]
        return {
            "provider": provider,
            "models": names,
            "tags": {n: providers.model_tags_real(provider, n) for n in names},
            "performance": db.model_performance(provider),
        }
    except Exception as e:
        raise HTTPException(502, f"{provider} unreachable at {urls[provider]}: {e}")


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@app.get("/projects")
def get_projects():
    return db.list_projects()


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

class CreateConversationRequest(BaseModel):
    project: str
    title: Optional[str] = None
    context_path: Optional[str] = None  # "<root_key>:<rel_path>" — see _apply_context below


@app.post("/conversations")
def create_conversation(req: CreateConversationRequest):
    cid = db.create_conversation(req.project, req.title, req.context_path)
    return db.get_conversation(cid)


@app.get("/conversations")
def get_conversations(project: Optional[str] = None):
    return db.list_conversations(project)


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int):
    convo = db.get_conversation(conversation_id)
    if not convo:
        raise HTTPException(404, "conversation not found")
    convo["messages"] = db.list_messages(conversation_id)
    return convo


class SetContextRequest(BaseModel):
    context_path: Optional[str] = None  # "<root_key>:<rel_path>", or null to clear


@app.patch("/conversations/{conversation_id}/context")
def set_conversation_context(conversation_id: int, req: SetContextRequest):
    """'Assign work to a project' (build brief item 2): a conversation can
    carry a concrete working-directory/file-path context on top of its
    project tag — this is what lets a file found via /fs/search actually
    steer subsequent provider calls (see _context_preamble below), not just
    decorate the UI."""
    convo = db.get_conversation(conversation_id)
    if not convo:
        raise HTTPException(404, "conversation not found")
    if req.context_path:
        root_key, _, rel_path = req.context_path.partition(":")
        try:
            fsops._resolve(root_key, rel_path or ".")
        except fsops.FsError as e:
            raise HTTPException(e.status, str(e))
    db.set_conversation_context(conversation_id, req.context_path)
    return db.get_conversation(conversation_id)


@app.post("/conversations/{conversation_id}/share")
def share_conversation(conversation_id: int):
    """Generates (or returns the existing) share token for this
    conversation -- an explicit, per-conversation opt-in. The resulting
    /share/{token} link is readable by anyone who has it, with NO login
    required (see auth.py's OPEN_PATH_PREFIXES) -- sharing is deliberate,
    not reversible by anything short of re-sharing (see unshare below)."""
    convo = db.get_conversation(conversation_id)
    if not convo:
        raise HTTPException(404, "conversation not found")
    token = convo.get("share_token") or secrets.token_urlsafe(24)
    db.set_share_token(conversation_id, token)
    return {"share_token": token}


@app.post("/conversations/{conversation_id}/unshare")
def unshare_conversation(conversation_id: int):
    convo = db.get_conversation(conversation_id)
    if not convo:
        raise HTTPException(404, "conversation not found")
    db.set_share_token(conversation_id, None)
    return {"ok": True}


@app.get("/share/{token}")
def get_shared_conversation(token: str):
    """PUBLIC, unauthenticated, read-only. Returns ONLY what a shared link
    should: this one conversation's title + messages -- no provider config,
    no other conversations, no way to send a new message through this route."""
    convo = db.get_conversation_by_share_token(token)
    if not convo:
        raise HTTPException(404, "no conversation shared under this link (never shared, or unshared since)")
    return {
        "title": convo["title"],
        "created_at": convo["created_at"],
        "messages": db.list_messages(convo["id"]),
    }


def _context_preamble(convo: dict) -> str:
    """Real (not cosmetic) use of the assigned context: prepended to every
    prompt sent to a provider for this conversation, so 'assign this file to
    a task' actually changes what the model is told to work on."""
    context_path = convo.get("context_path")
    if not context_path:
        return ""
    root_key, _, rel_path = context_path.partition(":")
    return (f"[Working context — project '{convo['project_key']}', "
            f"path '{rel_path or '.'}' under workspace root '{root_key}'. "
            f"Treat this as the subject/location of the request below.]\n\n")


def _persona_preamble(persona: str | None) -> str:
    """A system-prompt swap, prepended the same way _context_preamble is --
    NOT a separate agent/pipeline, just framing text ahead of the real
    message. Unknown/None persona keys are silently treated as 'none'
    (no framing) rather than erroring, since this is a UI convenience."""
    text = config.PERSONAS.get(persona or "none")
    return f"[{text}]\n\n" if text else ""


def _apply_attachments(prompt: str, attachment_ids: list, provider: str, model: str):
    """Folds attachments into a prompt/images pair. Text attachments get
    inlined as prompt text; images only get passed through as images_b64 if
    the resolved model actually reports vision in its capabilities (real
    Ollama metadata, not a guess) -- otherwise the model would silently
    receive text-only content while the user thinks the image was seen, so
    that case is called out in the prompt instead. Returns
    (augmented_prompt, images_b64, notes) where notes is a list of strings
    describing what happened to each attachment, for transparency."""
    if not attachment_ids:
        return prompt, None, []

    can_vision = False
    if provider == "ollama":
        can_vision = "vision" in providers.ollama_model_info(model).get("capabilities", [])

    prefix_parts = []
    images_b64 = []
    notes = []
    for aid in attachment_ids:
        try:
            att = attachments.get_attachment(aid)
        except attachments.AttachmentError as e:
            notes.append(f"attachment {aid}: {e}")
            continue
        if att["is_text"] and att["extracted_text"] is not None:
            prefix_parts.append(f"[Attached file: {att['filename']}]\n{att['extracted_text']}\n")
            notes.append(f"{att['filename']}: text inlined ({att['size']} bytes)")
        elif att["is_image"]:
            if can_vision:
                with open(att["stored_path"], "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("ascii")
                images_b64.append((att["mime_type"] or "image/png", b64))
                notes.append(f"{att['filename']}: sent as image to {model}")
            else:
                prefix_parts.append(f"[Attached image: {att['filename']} -- current model '{model}' has no vision capability, image was NOT read]\n")
                notes.append(f"{att['filename']}: NOT read -- {model} has no vision capability")
        else:
            prefix_parts.append(f"[Attached file: {att['filename']} ({att['mime_type']}, {att['size']} bytes) -- content not extracted, file type not supported for text extraction]\n")
            notes.append(f"{att['filename']}: not extracted (unsupported type)")

    augmented = ("".join(prefix_parts) + prompt) if prefix_parts else prompt
    return augmented, (images_b64 or None), notes


class PostMessageRequest(BaseModel):
    content: str
    provider_override: Optional[str] = None
    model: Optional[str] = None
    attachment_ids: list[int] = []
    persona: Optional[str] = None


@app.post("/conversations/{conversation_id}/messages")
def post_message(conversation_id: int, req: PostMessageRequest):
    """Non-streaming REST fallback for sending a message. The WebSocket
    endpoint below is the primary chat-UI path; this exists so the platform
    is fully usable (and scriptable/testable) without a WS client."""
    convo = db.get_conversation(conversation_id)
    if not convo:
        raise HTTPException(404, "conversation not found")

    user_message_id = db.add_message(conversation_id, "user", req.content)
    for aid in req.attachment_ids:
        db.link_message_attachment(user_message_id, aid)

    decision = router.route(req.content, req.provider_override)
    provider = decision["provider"]
    # resolve_model (not default_model) so a long prompt is logged/cached
    # under the LARGE ollama tier it will actually get, not the small one.
    model = providers.resolve_model(provider, req.content, req.model)
    context_path = convo.get("context_path")
    task_id = db.start_task(conversation_id, convo["project_key"], provider, model, req.content,
                             decision["reason"], context_path)

    prompt = _persona_preamble(req.persona) + _context_preamble(convo) + req.content
    prompt, images_b64, attachment_notes = _apply_attachments(prompt, req.attachment_ids, provider, model)
    # Attachments (and persona) make this call effectively unique even if the
    # text repeats -- fold both into the cache key so they don't collide with
    # a plain/no-persona/no-attachment call to the same text.
    cache_key = _cache_key(provider, model, prompt + "\x00" + ",".join(map(str, req.attachment_ids)) + "\x00" + (req.persona or ""))
    cached = db.cache_get(cache_key, CACHE_MAX_AGE_SECONDS) if not images_b64 else None
    t0 = time.time()
    if cached:
        output = cached["output"]
        duration_ms = 0.0
        db.complete_task(task_id, output, duration_ms)
    else:
        try:
            output = providers.call_provider(provider, prompt, model=model, images_b64=images_b64)
        except providers.ProviderError as e:
            duration_ms = round((time.time() - t0) * 1000, 1)
            db.fail_task(task_id, str(e), duration_ms)
            raise HTTPException(502, {"provider": e.provider, "error": str(e), "routing_reason": decision["reason"]})
        duration_ms = round((time.time() - t0) * 1000, 1)
        db.complete_task(task_id, output, duration_ms)
        if not images_b64:  # don't cache image calls under a text-only key
            db.cache_set(cache_key, provider, model, prompt, output)

    db.add_message(conversation_id, "assistant", output, provider=provider, model=model, duration_ms=duration_ms)

    return {
        "provider": provider,
        "model": model,
        "routing_reason": decision["reason"],
        "output": output,
        "duration_ms": duration_ms,
        "task_id": task_id,
        "cached": bool(cached),
        "attachment_notes": attachment_notes,
    }


# ---------------------------------------------------------------------------
# Attachments (desktop file upload / clipboard paste)
# ---------------------------------------------------------------------------

@app.post("/attachments")
async def upload_attachment(file: UploadFile):
    content = await file.read()
    try:
        return attachments.save_upload(file.filename or "upload", content)
    except attachments.AttachmentError as e:
        raise HTTPException(e.status, str(e))


@app.get("/attachments/{attachment_id}")
def get_attachment_meta(attachment_id: int):
    try:
        return attachments.get_attachment(attachment_id)
    except attachments.AttachmentError as e:
        raise HTTPException(e.status, str(e))


@app.get("/attachments/{attachment_id}/raw")
def get_attachment_raw(attachment_id: int):
    try:
        att = attachments.get_attachment(attachment_id)
    except attachments.AttachmentError as e:
        raise HTTPException(e.status, str(e))
    return FileResponse(att["stored_path"], media_type=att["mime_type"] or "application/octet-stream",
                         filename=att["filename"])


@app.get("/messages/{message_id}/attachments")
def get_message_attachments(message_id: int):
    return db.get_message_attachments(message_id)


# ---------------------------------------------------------------------------
# Tasks (history)
# ---------------------------------------------------------------------------

@app.get("/tasks")
def get_tasks(project: Optional[str] = None, limit: int = 100):
    return db.list_tasks(project, limit)


@app.get("/tasks/{task_id}")
def get_task(task_id: int):
    t = db.get_task(task_id)
    if not t:
        raise HTTPException(404, "task not found")
    return t


# ---------------------------------------------------------------------------
# Response cache
# ---------------------------------------------------------------------------

@app.get("/cache/stats")
def cache_stats():
    return db.cache_stats()


@app.post("/cache/clear")
def cache_clear():
    db.cache_clear()
    return db.cache_stats()


# ---------------------------------------------------------------------------
# Filesystem workspace: project search, doc/PDF viewer, code editor.
# Every path here is scoped to fsops._ROOTS (built from
# config.KNOWN_PROJECTS' root_dir) and re-validated inside fsops on every
# call — see fsops.py's module docstring for the traversal defense. Any
# FsError becomes the HTTP status it carries (400 for bad input/traversal,
# 404 for missing, 413 for too-large) with fsops' own message, never a
# generic/opaque failure.
# ---------------------------------------------------------------------------

def _fs_error(e: fsops.FsError):
    raise HTTPException(e.status, str(e))


@app.get("/fs/roots")
def fs_roots():
    return fsops.list_roots()


@app.get("/fs/list")
def fs_list(root: str, path: str = "."):
    try:
        return fsops.list_dir(root, path)
    except fsops.FsError as e:
        _fs_error(e)


@app.get("/fs/search")
def fs_search(root: str, q: str, content: bool = False, limit: Optional[int] = None):
    try:
        return fsops.search(root, q, content=content, limit=limit)
    except fsops.FsError as e:
        _fs_error(e)


@app.get("/fs/read")
def fs_read(root: str, path: str):
    try:
        return fsops.read_text(root, path)
    except fsops.FsError as e:
        _fs_error(e)


@app.get("/fs/raw")
def fs_raw(root: str, path: str):
    try:
        abs_path, media_type = fsops.read_raw_path(root, path)
    except fsops.FsError as e:
        _fs_error(e)
        return  # unreachable, keeps type checkers happy
    return FileResponse(str(abs_path), media_type=media_type, filename=abs_path.name)


class WriteFileRequest(BaseModel):
    root: str
    path: str
    content: str


@app.put("/fs/write")
def fs_write(req: WriteFileRequest):
    try:
        return fsops.write_text(req.root, req.path, req.content)
    except fsops.FsError as e:
        _fs_error(e)


# ---------------------------------------------------------------------------
# WebSocket streaming chat
# ---------------------------------------------------------------------------
# HONEST LIMITATION (documented, not hidden): the underlying provider calls
# (bridge.call_ollama / call_openai / call_claude) are synchronous,
# non-streaming HTTP calls — this preserves the existing, already-audited
# agentic-ollama-platform call path (cache + persistence + quality scoring)
# unchanged, per the brief's "do not duplicate the engine" instruction.
# What streams over this WebSocket is the FINAL response text broken into
# chunks with small delays, so the chat UI still feels incremental — it is
# NOT token-level model streaming. True token streaming would require a
# separate, unaudited fast-path around ollama_client.call_ollama, which was
# judged out of scope for this build (see final report).

@app.websocket("/ws/conversations/{conversation_id}")
async def ws_chat(websocket: WebSocket, conversation_id: int):
    await websocket.accept()
    convo = db.get_conversation(conversation_id)
    if not convo:
        await websocket.send_json({"type": "error", "error": "conversation not found"})
        await websocket.close()
        return

    try:
        while True:
            payload = await websocket.receive_json()
            content = payload.get("content", "")
            override = payload.get("provider_override")
            model = payload.get("model")
            attachment_ids = payload.get("attachment_ids") or []
            persona = payload.get("persona")
            if not content.strip():
                continue

            user_message_id = db.add_message(conversation_id, "user", content)
            for aid in attachment_ids:
                db.link_message_attachment(user_message_id, aid)
            await websocket.send_json({"type": "user_message", "content": content})

            decision = router.route(content, override)
            provider = decision["provider"]
            # resolve_model (not default_model) so a long prompt is logged/cached
            # under the LARGE ollama tier it will actually get, not the small one.
            chosen_model = providers.resolve_model(provider, content, model)
            await websocket.send_json({
                "type": "routing", "provider": provider, "model": chosen_model,
                "reason": decision["reason"],
            })

            context_path = convo.get("context_path")
            task_id = db.start_task(conversation_id, convo["project_key"], provider, chosen_model,
                                     content, decision["reason"], context_path)
            prompt = _persona_preamble(persona) + _context_preamble(convo) + content
            prompt, images_b64, attachment_notes = _apply_attachments(prompt, attachment_ids, provider, chosen_model)
            if attachment_notes:
                await websocket.send_json({"type": "attachment_notes", "notes": attachment_notes})
            cache_key = _cache_key(provider, chosen_model, prompt + "\x00" + ",".join(map(str, attachment_ids)) + "\x00" + (persona or ""))
            cached = db.cache_get(cache_key, CACHE_MAX_AGE_SECONDS) if not images_b64 else None
            t0 = time.time()
            if cached:
                output = cached["output"]
                duration_ms = 0.0
                db.complete_task(task_id, output, duration_ms)
            else:
                try:
                    output = providers.call_provider(provider, prompt, model=chosen_model, images_b64=images_b64)
                except providers.ProviderError as e:
                    duration_ms = round((time.time() - t0) * 1000, 1)
                    db.fail_task(task_id, str(e), duration_ms)
                    await websocket.send_json({
                        "type": "error", "provider": e.provider, "error": str(e), "task_id": task_id,
                    })
                    continue
                duration_ms = round((time.time() - t0) * 1000, 1)
                db.complete_task(task_id, output, duration_ms)
                if not images_b64:
                    db.cache_set(cache_key, provider, chosen_model, prompt, output)

            db.add_message(conversation_id, "assistant", output, provider=provider, model=chosen_model, duration_ms=duration_ms)

            await websocket.send_json({"type": "assistant_start", "provider": provider, "model": chosen_model,
                                        "task_id": task_id, "cached": bool(cached)})
            # Chunked delivery of the real, already-complete response (see note above).
            chunk_size = 40
            for i in range(0, len(output), chunk_size):
                await websocket.send_json({"type": "assistant_chunk", "text": output[i:i + chunk_size]})
            await websocket.send_json({
                "type": "assistant_end", "duration_ms": duration_ms, "task_id": task_id, "cached": bool(cached),
            })
    except WebSocketDisconnect:
        return
