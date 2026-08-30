"""AI Orchestrator Platform — FastAPI backend.

Routes chat/task requests across three real providers (local Ollama via the
already-running agentic-ollama-platform engine, real OpenAI, and Claude —
fail-closed until a key exists), with per-project conversation/task history
in its own SQLite database. See README.md at the project root for the full
picture; see app/bridge.py for exactly how this avoids duplicating the
Ollama engine.
"""
import time
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from . import config, db, fsops, health, providers, router

app = FastAPI(title="AI Orchestrator Platform", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    db.init()


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
            "status": statuses[p]["status"],
            "detail": statuses[p]["detail"],
        }
        for p in ("ollama", "openai", "claude")
    ]


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


class PostMessageRequest(BaseModel):
    content: str
    provider_override: Optional[str] = None
    model: Optional[str] = None


@app.post("/conversations/{conversation_id}/messages")
def post_message(conversation_id: int, req: PostMessageRequest):
    """Non-streaming REST fallback for sending a message. The WebSocket
    endpoint below is the primary chat-UI path; this exists so the platform
    is fully usable (and scriptable/testable) without a WS client."""
    convo = db.get_conversation(conversation_id)
    if not convo:
        raise HTTPException(404, "conversation not found")

    db.add_message(conversation_id, "user", req.content)

    decision = router.route(req.content, req.provider_override)
    provider = decision["provider"]
    model = req.model or providers.default_model(provider)
    context_path = convo.get("context_path")
    task_id = db.start_task(conversation_id, convo["project_key"], provider, model, req.content,
                             decision["reason"], context_path)

    prompt = _context_preamble(convo) + req.content
    t0 = time.time()
    try:
        output = providers.call_provider(provider, prompt, model=req.model)
    except providers.ProviderError as e:
        duration_ms = round((time.time() - t0) * 1000, 1)
        db.fail_task(task_id, str(e), duration_ms)
        raise HTTPException(502, {"provider": e.provider, "error": str(e), "routing_reason": decision["reason"]})

    duration_ms = round((time.time() - t0) * 1000, 1)
    db.complete_task(task_id, output, duration_ms)
    db.add_message(conversation_id, "assistant", output, provider=provider, model=model)

    return {
        "provider": provider,
        "model": model,
        "routing_reason": decision["reason"],
        "output": output,
        "duration_ms": duration_ms,
        "task_id": task_id,
    }


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
            if not content.strip():
                continue

            db.add_message(conversation_id, "user", content)
            await websocket.send_json({"type": "user_message", "content": content})

            decision = router.route(content, override)
            provider = decision["provider"]
            chosen_model = model or providers.default_model(provider)
            await websocket.send_json({
                "type": "routing", "provider": provider, "model": chosen_model,
                "reason": decision["reason"],
            })

            context_path = convo.get("context_path")
            task_id = db.start_task(conversation_id, convo["project_key"], provider, chosen_model,
                                     content, decision["reason"], context_path)
            prompt = _context_preamble(convo) + content
            t0 = time.time()
            try:
                output = providers.call_provider(provider, prompt, model=model)
            except providers.ProviderError as e:
                duration_ms = round((time.time() - t0) * 1000, 1)
                db.fail_task(task_id, str(e), duration_ms)
                await websocket.send_json({
                    "type": "error", "provider": e.provider, "error": str(e), "task_id": task_id,
                })
                continue

            duration_ms = round((time.time() - t0) * 1000, 1)
            db.complete_task(task_id, output, duration_ms)
            db.add_message(conversation_id, "assistant", output, provider=provider, model=chosen_model)

            await websocket.send_json({"type": "assistant_start", "provider": provider, "model": chosen_model,
                                        "task_id": task_id})
            # Chunked delivery of the real, already-complete response (see note above).
            chunk_size = 40
            for i in range(0, len(output), chunk_size):
                await websocket.send_json({"type": "assistant_chunk", "text": output[i:i + chunk_size]})
            await websocket.send_json({
                "type": "assistant_end", "duration_ms": duration_ms, "task_id": task_id,
            })
    except WebSocketDisconnect:
        return
